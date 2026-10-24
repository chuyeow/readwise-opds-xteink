import assert from "node:assert/strict";
import test from "node:test";

import { buildFeed, buildNavigationFeed, findShelf, isReadable } from "../src/core/feed.js";

const baseUrl = "https://opds.example.com";
const shortlist = findShelf("shortlist");

const article = {
  id: "01m3vq8q9h6xnahpdczss343ne",
  title: "Claude’s new auto eval tool",
  author: "Hamel Husain",
  category: "article",
  site_name: "Hamel's Blog",
  word_count: 791,
  summary: "Claude’s eval tool can uncover useful issues <sometimes> & more.",
  saved_at: "2026-10-01T12:33:13.522000+00:00"
};

test("isReadable keeps text documents and drops ones CrossPoint can't open", () => {
  assert.equal(isReadable({ category: "article" }), true);
  assert.equal(isReadable({ category: "tweet" }), true);
  assert.equal(isReadable({ category: "email" }), true);
  assert.equal(isReadable({ category: "rss" }), true);
  assert.equal(isReadable({ category: "pdf" }), false);
  assert.equal(isReadable({ category: "video" }), false);
  assert.equal(isReadable({ category: "highlight" }), false);
});

test("buildFeed emits an OPDS acquisition feed with one EPUB link per document", () => {
  const xml = buildFeed({ shelf: shortlist, docs: [article], baseUrl, nextCursor: null, updated: "2026-10-24T00:00:00Z" });

  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<feed xmlns="http:\/\/www.w3.org\/2005\/Atom"/);
  assert.match(xml, /<title>Readwise Shortlist<\/title>/);
  assert.match(xml, /<updated>2026-10-24T00:00:00Z<\/updated>/);
  assert.match(xml, /<entry>\s*<title>Claude’s new auto eval tool<\/title>/);
  assert.match(xml, /<id>urn:readwise:01m3vq8q9h6xnahpdczss343ne<\/id>/);
  assert.match(xml, /<author><name>Hamel Husain<\/name><\/author>/);
  assert.match(
    xml,
    /<link rel="http:\/\/opds-spec.org\/acquisition\/open-access" type="application\/epub\+zip" href="https:\/\/opds.example.com\/opds\/books\/01m3vq8q9h6xnahpdczss343ne.epub"\/>/
  );
  assert.doesNotMatch(xml, /rel="next"/);
});

test("buildFeed escapes markup and leads the summary with site and reading time", () => {
  const xml = buildFeed({ shelf: shortlist, docs: [article], baseUrl, nextCursor: null, updated: "2026-10-24T00:00:00Z" });

  assert.match(
    xml,
    /<summary type="text">Hamel&apos;s Blog · 3 min · Claude’s eval tool can uncover useful issues &lt;sometimes&gt; &amp; more.<\/summary>/
  );
});

test("buildFeed links the next page by Readwise cursor", () => {
  const xml = buildFeed({ shelf: shortlist, docs: [article], baseUrl, nextCursor: "01k10e4j&x", updated: "2026-10-24T00:00:00Z" });

  assert.match(
    xml,
    /<link rel="next" type="application\/atom\+xml;profile=opds-catalog;kind=acquisition" href="https:\/\/opds.example.com\/opds\/shortlist\?cursor=01k10e4j%26x"\/>/
  );
});

test("buildFeed falls back to site name, then nothing, when author is missing", () => {
  const xml = buildFeed({
    shelf: shortlist,
    docs: [
      { ...article, id: "a", author: null },
      { ...article, id: "b", author: null, site_name: null, word_count: null, summary: null }
    ],
    baseUrl,
    nextCursor: null,
    updated: "2026-10-24T00:00:00Z"
  });

  assert.match(xml, /<id>urn:readwise:a<\/id>\s*<updated>[^<]+<\/updated>\s*<author><name>Hamel&apos;s Blog<\/name><\/author>/);
  assert.match(xml, /<id>urn:readwise:b<\/id>\s*<updated>[^<]+<\/updated>\s*<link /);
});

test("buildFeed uses an untitled placeholder so the device never drops an entry", () => {
  const xml = buildFeed({ shelf: shortlist, docs: [{ ...article, title: "  " }], baseUrl, nextCursor: null, updated: "2026-10-24T00:00:00Z" });

  assert.match(xml, /<title>Untitled<\/title>/);
});

test("findShelf knows Shortlist, Later and Archive, and nothing else", () => {
  assert.deepEqual(findShelf("shortlist"), { location: "shortlist", title: "Shortlist" });
  assert.deepEqual(findShelf("later"), { location: "later", title: "Later" });
  assert.deepEqual(findShelf("archive"), { location: "archive", title: "Archive" });
  assert.equal(findShelf("feed"), null);
  assert.equal(findShelf("new"), null);
});

test("buildNavigationFeed lists the three shelves as acquisition subsections", () => {
  const xml = buildNavigationFeed({ baseUrl, updated: "2026-10-24T00:00:00Z" });

  assert.match(xml, /<title>Readwise<\/title>/);
  assert.match(xml, /<link rel="self" type="application\/atom\+xml;profile=opds-catalog;kind=navigation" href="https:\/\/opds.example.com\/opds"\/>/);
  const entries = [...xml.matchAll(/<entry>\s*<title>([^<]+)<\/title>[\s\S]*?<link rel="subsection" type="application\/atom\+xml;profile=opds-catalog;kind=acquisition" href="([^"]+)"\/>/g)];
  assert.deepEqual(
    entries.map(([, title, href]) => [title, href]),
    [
      ["Shortlist", "https://opds.example.com/opds/shortlist"],
      ["Later", "https://opds.example.com/opds/later"],
      ["Archive", "https://opds.example.com/opds/archive"]
    ]
  );
});

test("buildFeed titles the feed by shelf and links back up to the root", () => {
  const xml = buildFeed({ shelf: findShelf("later"), docs: [article], baseUrl, nextCursor: "c2", updated: "2026-10-24T00:00:00Z" });

  assert.match(xml, /<id>urn:readwise-opds:later<\/id>\s*<title>Readwise Later<\/title>/);
  assert.match(xml, /<link rel="self" type="application\/atom\+xml;profile=opds-catalog;kind=acquisition" href="https:\/\/opds.example.com\/opds\/later"\/>/);
  assert.match(xml, /<link rel="start" type="application\/atom\+xml;profile=opds-catalog;kind=navigation" href="https:\/\/opds.example.com\/opds"\/>/);
  assert.match(xml, /<link rel="up" type="application\/atom\+xml;profile=opds-catalog;kind=navigation" href="https:\/\/opds.example.com\/opds"\/>/);
  assert.match(xml, /href="https:\/\/opds.example.com\/opds\/later\?cursor=c2"/);
});
