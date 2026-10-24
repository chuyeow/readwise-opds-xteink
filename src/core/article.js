import { parseDocument } from "htmlparser2";

import { escapeXml } from "./xml.js";

// Removed together with everything inside them.
const DROPPED = new Set([
  "script", "style", "noscript", "iframe", "object", "embed", "form", "input", "button", "select",
  "textarea", "svg", "math", "video", "audio", "canvas", "template", "link", "meta", "head",
  "title", "source", "track"
]);

const KEPT = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code", "em",
  "strong", "b", "i", "u", "s", "del", "ins", "sub", "sup", "a", "img", "figure", "figcaption",
  "br", "hr", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "dl", "dt", "dd",
  "span", "div", "small", "mark", "abbr", "cite", "q", "kbd", "samp", "var"
]);

// Block containers that only matter as blocks.
const AS_DIV = new Set(["section", "article", "main", "header", "footer", "aside", "details", "summary"]);

const VOID = new Set(["br", "hr", "img"]);

export function collectImageUrls(html, baseUrl, { max }) {
  const urls = [];
  visitElements(parseDocument(html).children, (element) => {
    if (element.name !== "img") return;
    const url = resolveUrl(element.attribs.src, baseUrl, ["http:", "https:"]);
    if (url && !urls.includes(url) && urls.length < max) urls.push(url);
  });
  return urls;
}

// `images` maps an absolute source URL to its href inside the EPUB; images
// without an entry (failed or skipped downloads) are dropped.
export function articleToXhtmlBody(html, { baseUrl, images }) {
  return serializeNodes(parseDocument(html).children, { baseUrl, images });
}

export function chapterDocument({ title, byline, sourceUrl, language, body }) {
  const source = sourceHost(sourceUrl);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">
<head>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>${escapeXml(title)}</h1>
  ${byline ? `<p class="byline">${escapeXml(byline)}</p>\n  ` : ""}${source ? `<p class="source">${escapeXml(source)}</p>\n  ` : ""}${body}
</body>
</html>
`;
}

function visitElements(nodes, visit) {
  for (const node of nodes) {
    if (node.type !== "tag" && node.type !== "script" && node.type !== "style") continue;
    if (DROPPED.has(node.name)) continue;
    visit(node);
    visitElements(node.children, visit);
  }
}

function serializeNodes(nodes, context) {
  return nodes.map((node) => serializeNode(node, context)).join("");
}

function serializeNode(node, context) {
  if (node.type === "text") return escapeXml(node.data);
  if (node.type !== "tag") return "";
  if (DROPPED.has(node.name)) return "";

  const inner = () => serializeNodes(node.children, context);

  if (node.name === "img") {
    const href = context.images.get(resolveUrl(node.attribs.src, context.baseUrl, ["http:", "https:"]));
    if (!href) return "";
    const alt = node.attribs.alt ? ` alt="${escapeXml(node.attribs.alt)}"` : "";
    return `<img src="${escapeXml(href)}"${alt}/>`;
  }

  const name = AS_DIV.has(node.name) ? "div" : node.name;
  if (!KEPT.has(name)) return inner();

  const attributes = serializeAttributes(name, node.attribs, context);
  if (VOID.has(name)) return `<${name}${attributes}/>`;
  return `<${name}${attributes}>${inner()}</${name}>`;
}

function serializeAttributes(name, attribs, context) {
  if (name === "a") {
    const href = resolveUrl(attribs.href, context.baseUrl, ["http:", "https:", "mailto:"]);
    return href ? ` href="${escapeXml(href)}"` : "";
  }
  if (name === "td" || name === "th") {
    return ["colspan", "rowspan"]
      .filter((key) => /^\d+$/.test(attribs[key] ?? ""))
      .map((key) => ` ${key}="${attribs[key]}"`)
      .join("");
  }
  return "";
}

function resolveUrl(value, baseUrl, protocols) {
  if (!value) return null;
  try {
    const url = new URL(value.trim(), baseUrl ?? undefined);
    return protocols.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function sourceHost(sourceUrl) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
