import assert from "node:assert/strict";
import test from "node:test";

import { strFromU8, unzipSync } from "fflate";

import { buildEpub } from "../src/core/epub.js";

const book = {
  id: "01m3vq8q9h6xnahpdczss343ne",
  title: "Claude’s new <auto> eval tool",
  author: "Hamel Husain",
  language: "en",
  modified: "2026-10-01T12:33:13Z",
  chapter: "<?xml version=\"1.0\"?><html/>",
  images: [{ href: "images/img-001.jpg", bytes: new Uint8Array([0xff, 0xd8, 0xff]) }],
  cover: { href: "images/cover.jpg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x01]) }
};

function rawEntryNames(zip) {
  // Central directory order: walk local file headers (signature PK\x03\x04).
  const names = [];
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    names.push(strFromU8(zip.subarray(offset + 30, offset + 30 + nameLength)));
    offset += 30 + nameLength + extraLength + compressedSize;
  }
  return names;
}

test("buildEpub writes an uncompressed mimetype as the first entry", () => {
  const zip = buildEpub(book);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

  assert.equal(rawEntryNames(zip)[0], "mimetype");
  assert.equal(view.getUint16(8, true), 0, "mimetype compression method must be stored");
  assert.equal(strFromU8(zip.subarray(38, 58)), "application/epub+zip");
});

test("buildEpub packages container, OPF, nav, NCX, CSS, chapter and images", () => {
  const files = unzipSync(buildEpub(book));

  assert.deepEqual(Object.keys(files).sort(), [
    "META-INF/container.xml",
    "OEBPS/chapter.xhtml",
    "OEBPS/content.opf",
    "OEBPS/images/cover.jpg",
    "OEBPS/images/img-001.jpg",
    "OEBPS/nav.xhtml",
    "OEBPS/style.css",
    "OEBPS/toc.ncx",
    "mimetype"
  ]);
  assert.match(strFromU8(files["META-INF/container.xml"]), /full-path="OEBPS\/content.opf"/);
  assert.equal(strFromU8(files["OEBPS/chapter.xhtml"]), book.chapter);
});

test("buildEpub OPF carries escaped metadata, a cover, and a single-chapter spine", () => {
  const opf = strFromU8(unzipSync(buildEpub(book))["OEBPS/content.opf"]);

  assert.match(opf, /<dc:identifier id="book-id">urn:readwise:01m3vq8q9h6xnahpdczss343ne<\/dc:identifier>/);
  assert.match(opf, /<dc:title>Claude’s new &lt;auto&gt; eval tool<\/dc:title>/);
  assert.match(opf, /<dc:creator>Hamel Husain<\/dc:creator>/);
  assert.match(opf, /<dc:language>en<\/dc:language>/);
  assert.match(opf, /<meta property="dcterms:modified">2026-10-01T12:33:13Z<\/meta>/);
  assert.match(opf, /<meta name="cover" content="cover-image"\/>/);
  assert.match(opf, /<item id="cover-image" href="images\/cover.jpg" media-type="image\/jpeg" properties="cover-image"\/>/);
  assert.match(opf, /<item id="img-1" href="images\/img-001.jpg" media-type="image\/jpeg"\/>/);
  assert.match(opf, /<spine toc="ncx">\s*<itemref idref="chapter"\/>\s*<\/spine>/);
});

test("buildEpub omits creator and cover when absent", () => {
  const files = unzipSync(buildEpub({ ...book, author: "", cover: null }));
  const opf = strFromU8(files["OEBPS/content.opf"]);

  assert.doesNotMatch(opf, /dc:creator/);
  assert.doesNotMatch(opf, /cover/);
  assert.equal(files["OEBPS/images/cover.jpg"], undefined);
});

test("buildEpub is byte-for-byte deterministic", () => {
  assert.deepEqual(buildEpub(book), buildEpub(book));
});
