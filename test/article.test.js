import assert from "node:assert/strict";
import test from "node:test";

import { articleToXhtmlBody, chapterDocument, collectImageUrls } from "../src/core/article.js";

const baseUrl = "https://hamel.dev/blog/posts/claude-auto-evals/";

test("collectImageUrls resolves relative srcs, dedupes, keeps order, and caps the count", () => {
  const html = `
    <p><img src="images/a.png"><img src="https://cdn.example.com/b.jpg"></p>
    <img src="images/a.png"><img src="data:image/png;base64,AAAA"><img src="javascript:x"><img>
    <img src="//cdn.example.com/c.webp">`;

  assert.deepEqual(collectImageUrls(html, baseUrl, { max: 10 }), [
    "https://hamel.dev/blog/posts/claude-auto-evals/images/a.png",
    "https://cdn.example.com/b.jpg",
    "https://cdn.example.com/c.webp"
  ]);
  assert.deepEqual(collectImageUrls(html, baseUrl, { max: 2 }), [
    "https://hamel.dev/blog/posts/claude-auto-evals/images/a.png",
    "https://cdn.example.com/b.jpg"
  ]);
});

test("articleToXhtmlBody keeps reading structure and drops attributes and junk", () => {
  const html = `<h2 data-anchor-id="the-bad" class="x" style="color:red">The bad</h2>
    <p onclick="evil()">Hi <em>there</em> <a data-original-href="https://a.example/" href="https://a.example/">link</a></p><script>alert(1)</script><style>p{}</style><iframe src="https://yt"></iframe>
    <ul> <li>One</li> </ul><blockquote><p>Quote</p></blockquote><pre><code>a &lt; b</code></pre>`;

  const body = articleToXhtmlBody(html, { baseUrl, images: new Map() });

  assert.equal(
    body,
    `<h2>The bad</h2>
    <p>Hi <em>there</em> <a href="https://a.example/">link</a></p>
    <ul> <li>One</li> </ul><blockquote><p>Quote</p></blockquote><pre><code>a &lt; b</code></pre>`
  );
});

test("articleToXhtmlBody unwraps unknown elements and keeps their text", () => {
  const body = articleToXhtmlBody(`<section><custom-el>Inside <span>span</span></custom-el></section>`, {
    baseUrl,
    images: new Map()
  });

  assert.equal(body, `<div>Inside <span>span</span></div>`);
});

test("articleToXhtmlBody points fetched images at local files and drops the rest", () => {
  const html = `<figure><img alt="A &quot;red&quot; box" src="images/a.png"/><figcaption>Cap</figcaption></figure><p><img src="images/missing.png"></p>`;
  const images = new Map([["https://hamel.dev/blog/posts/claude-auto-evals/images/a.png", "images/img-001.jpg"]]);

  const body = articleToXhtmlBody(html, { baseUrl, images });

  assert.equal(
    body,
    `<figure><img src="images/img-001.jpg" alt="A &quot;red&quot; box"/><figcaption>Cap</figcaption></figure><p></p>`
  );
});

test("articleToXhtmlBody emits well-formed XML: void tags closed, entities decoded, bad links dropped", () => {
  const html = `<p>a&nbsp;b &copy; c<br>d e &amp; f\u0001</p><hr><td></td><a href="javascript:alert(1)">x</a><a href="/rel">y</a>`;

  const body = articleToXhtmlBody(html, { baseUrl, images: new Map() });

  assert.equal(body, `<p>a\u00a0b © c<br/>d e &amp; f</p><hr/><td></td><a>x</a><a href="https://hamel.dev/rel">y</a>`);
});

test("chapterDocument wraps the body in an XHTML page with a title header and source line", () => {
  const xhtml = chapterDocument({
    title: "Claude’s <new> tool",
    byline: "Hamel Husain · Hamel's Blog",
    sourceUrl: "https://hamel.dev/x?a=1&b=2",
    language: "en",
    body: "<p>Body</p>"
  });

  assert.match(xhtml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<!DOCTYPE html>\n<html xmlns="http:\/\/www.w3.org\/1999\/xhtml" xml:lang="en" lang="en">/);
  assert.match(xhtml, /<title>Claude’s &lt;new&gt; tool<\/title>/);
  assert.match(xhtml, /<link rel="stylesheet" type="text\/css" href="style.css"\/>/);
  assert.match(xhtml, /<h1>Claude’s &lt;new&gt; tool<\/h1>\s*<p class="byline">Hamel Husain · Hamel&apos;s Blog<\/p>/);
  assert.match(xhtml, /<p class="source">hamel.dev<\/p>/);
  assert.match(xhtml, /<p>Body<\/p>\s*<\/body>\s*<\/html>\s*$/);
});
