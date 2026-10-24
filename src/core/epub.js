import { strToU8, zipSync } from "fflate";

import { escapeXml } from "./xml.js";

// A fixed timestamp keeps the zip byte-identical across regenerations, so a
// download resumed against another serverless instance gets the same bytes.
const ZIP_MTIME = new Date("2020-01-01T00:00:00Z");

const STYLESHEET = `body { margin: 0; padding: 0; }
h1 { font-size: 1.4em; margin: 0 0 0.3em 0; }
p.byline, p.source { font-size: 0.85em; margin: 0; text-indent: 0; }
p.source { margin-bottom: 1.2em; }
img { max-width: 100%; }
figcaption { font-size: 0.85em; }
pre { white-space: pre-wrap; font-size: 0.85em; }
blockquote { margin: 0.5em 1em; }
`;

const CONTAINER = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;

export function buildEpub({ id, title, author, language, modified, chapter, images, cover }) {
  const files = {
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(CONTAINER),
    "OEBPS/content.opf": strToU8(contentOpf({ id, title, author, language, modified, images, cover })),
    "OEBPS/nav.xhtml": strToU8(navDocument({ title, language })),
    "OEBPS/toc.ncx": strToU8(tocNcx({ id, title })),
    "OEBPS/style.css": strToU8(STYLESHEET),
    "OEBPS/chapter.xhtml": strToU8(chapter)
  };
  if (cover) files[`OEBPS/${cover.href}`] = [cover.bytes, { level: 0 }];
  for (const image of images) files[`OEBPS/${image.href}`] = [image.bytes, { level: 0 }];

  return zipSync(files, { level: 6, mtime: ZIP_MTIME });
}

function contentOpf({ id, title, author, language, modified, images, cover }) {
  const creator = author ? `\n    <dc:creator>${escapeXml(author)}</dc:creator>` : "";
  const coverMeta = cover ? `\n    <meta name="cover" content="cover-image"/>` : "";
  const coverItem = cover
    ? `\n    <item id="cover-image" href="${escapeXml(cover.href)}" media-type="image/jpeg" properties="cover-image"/>`
    : "";
  const imageItems = images
    .map((image, index) => `\n    <item id="img-${index + 1}" href="${escapeXml(image.href)}" media-type="image/jpeg"/>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:readwise:${escapeXml(id)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>${creator}
    <dc:language>${escapeXml(language)}</dc:language>
    <meta property="dcterms:modified">${escapeXml(modified)}</meta>${coverMeta}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>${coverItem}${imageItems}
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter"/>
  </spine>
</package>
`;
}

function navDocument({ title, language }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">
<head><title>${escapeXml(title)}</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <ol><li><a href="chapter.xhtml">${escapeXml(title)}</a></li></ol>
  </nav>
</body>
</html>
`;
}

function tocNcx({ id, title }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:readwise:${escapeXml(id)}"/></head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
    <navPoint id="chapter" playOrder="1">
      <navLabel><text>${escapeXml(title)}</text></navLabel>
      <content src="chapter.xhtml"/>
    </navPoint>
  </navMap>
</ncx>
`;
}
