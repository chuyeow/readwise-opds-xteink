import { escapeXml } from "./xml.js";

// Reader categories whose html_content is a readable article. PDFs, video and
// audio have no EPUB-able body, and CrossPoint can't open them anyway.
const READABLE_CATEGORIES = new Set(["article", "email", "rss", "tweet", "note"]);

// Reader locations offered as shelves, in menu order.
const SHELVES = [
  { location: "shortlist", title: "Shortlist" },
  { location: "later", title: "Later" },
  { location: "archive", title: "Archive" }
];

const WORDS_PER_MINUTE = 250;
const ACQUISITION_FEED_TYPE = "application/atom+xml;profile=opds-catalog;kind=acquisition";
const NAVIGATION_FEED_TYPE = "application/atom+xml;profile=opds-catalog;kind=navigation";

export function isReadable(doc) {
  return READABLE_CATEGORIES.has(doc.category);
}

export function findShelf(location) {
  return SHELVES.find((shelf) => shelf.location === location) ?? null;
}

export function rootUrl(baseUrl) {
  return `${baseUrl}/opds`;
}

export function shelfUrl(baseUrl, shelf, cursor) {
  const url = `${baseUrl}/opds/${shelf.location}`;
  return cursor ? `${url}?cursor=${encodeURIComponent(cursor)}` : url;
}

export function bookUrl(baseUrl, id) {
  return `${baseUrl}/opds/books/${encodeURIComponent(id)}.epub`;
}

export function buildNavigationFeed({ baseUrl, updated }) {
  const entries = SHELVES.map(
    (shelf) => `  <entry>
    <title>${escapeXml(shelf.title)}</title>
    <id>urn:readwise-opds:${shelf.location}</id>
    <updated>${escapeXml(updated)}</updated>
    <link rel="subsection" type="${ACQUISITION_FEED_TYPE}" href="${escapeXml(shelfUrl(baseUrl, shelf))}"/>
  </entry>`
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:readwise-opds:root</id>
  <title>Readwise</title>
  <updated>${escapeXml(updated)}</updated>
  <link rel="self" type="${NAVIGATION_FEED_TYPE}" href="${escapeXml(rootUrl(baseUrl))}"/>
  <link rel="start" type="${NAVIGATION_FEED_TYPE}" href="${escapeXml(rootUrl(baseUrl))}"/>
${entries.join("\n")}
</feed>
`;
}

export function buildFeed({ shelf, docs, baseUrl, nextCursor, updated }) {
  const root = escapeXml(rootUrl(baseUrl));
  const next = nextCursor
    ? `\n  <link rel="next" type="${ACQUISITION_FEED_TYPE}" href="${escapeXml(shelfUrl(baseUrl, shelf, nextCursor))}"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:readwise-opds:${shelf.location}</id>
  <title>Readwise ${escapeXml(shelf.title)}</title>
  <updated>${escapeXml(updated)}</updated>
  <link rel="self" type="${ACQUISITION_FEED_TYPE}" href="${escapeXml(shelfUrl(baseUrl, shelf))}"/>
  <link rel="start" type="${NAVIGATION_FEED_TYPE}" href="${root}"/>
  <link rel="up" type="${NAVIGATION_FEED_TYPE}" href="${root}"/>${next}
${docs.map((doc) => feedEntry(doc, baseUrl)).join("\n")}
</feed>
`;
}

function feedEntry(doc, baseUrl) {
  const author = doc.author || doc.site_name;
  const summary = entrySummary(doc);

  return `  <entry>
    <title>${escapeXml(doc.title?.trim() || "Untitled")}</title>
    <id>urn:readwise:${escapeXml(doc.id)}</id>
    <updated>${escapeXml(doc.saved_at)}</updated>
    ${author ? `<author><name>${escapeXml(author)}</name></author>\n    ` : ""}${summary ? `<summary type="text">${escapeXml(summary)}</summary>\n    ` : ""}<link rel="http://opds-spec.org/acquisition/open-access" type="application/epub+zip" href="${escapeXml(bookUrl(baseUrl, doc.id))}"/>
  </entry>`;
}

function entrySummary(doc) {
  const minutes = doc.word_count ? `${Math.max(1, Math.round(doc.word_count / WORDS_PER_MINUTE))} min` : null;
  return [doc.site_name, minutes, doc.summary].filter(Boolean).join(" · ");
}
