// End-to-end check of a running readwise-opds server through CrossPoint's own
// parsers: menu and shelf feeds via OpdsParser (1.6.5 release and develop), each EPUB's XML via expat and its OPF via
// ContentOpfParser, and images against what the X3 decodes well.
//
// Usage: OPDS_USERNAME=... OPDS_PASSWORD=... node scripts/verify-crosspoint.js <base-url> [books-per-shelf]
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { unzipSync } from "fflate";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const [baseUrl, bookCount = "1"] = process.argv.slice(2);
if (!baseUrl) {
  console.error("usage: node scripts/verify-crosspoint.js <base-url> [books]");
  process.exit(2);
}

const bin = execFileSync(join(here, "build-crosspoint-checks.sh"), { encoding: "utf8" }).trim().split("\n").at(-1);
const work = mkdtempSync(join(tmpdir(), "readwise-opds-verify-"));
const authorization = `Basic ${Buffer.from(`${process.env.OPDS_USERNAME}:${process.env.OPDS_PASSWORD}`).toString("base64")}`;
const failures = [];

function check(ok, message) {
  console.log(`${ok ? "PASS" : "FAIL"} ${message}`);
  if (!ok) failures.push(message);
}

function run(tool, args) {
  const result = spawnSync(join(bin, tool), args, { encoding: "utf8" });
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}`.trim() };
}

async function fetchTimed(url, headers = { authorization }) {
  const started = Date.now();
  const response = await fetch(url, { headers });
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { response, bytes, ms: Date.now() - started };
}

const PARSERS = ["opds-check-1.6.5", "opds-check"];
const SHELVES = ["Shortlist", "Later", "Archive"];

// Fetches a feed and parses it with both CrossPoint parsers; returns the
// develop parser's output (a superset of what 1.6.5 prints).
async function checkFeed(url, name) {
  const feed = await fetchTimed(url);
  check(feed.response.status === 200, `${name} responds 200 (${feed.response.status}, ${feed.ms} ms)`);
  const path = join(work, `${name.replace(/\W+/g, "-")}.xml`);
  writeFileSync(path, feed.bytes);
  let output = "";
  for (const parser of PARSERS) {
    const parsed = run(parser, [path]);
    check(parsed.ok, `${name} parses in ${parser}`);
    output = parsed.output;
  }
  return output;
}

const entriesOf = (output, kind) =>
  [...output.matchAll(new RegExp(`^${kind} +(.+?) \\| .*? \\| (https?:\\/\\/\\S+) \\|`, "gm"))].map(([, title, href]) => ({ title, href }));

const unauthenticated = await fetch(`${baseUrl}/opds`);
check(unauthenticated.status === 401, `feed without credentials is rejected (${unauthenticated.status})`);

const root = entriesOf(await checkFeed(`${baseUrl}/opds`, "root menu"), "NAV");
check(
  JSON.stringify(root.map((entry) => entry.title)) === JSON.stringify(SHELVES),
  `root menu lists ${SHELVES.join(", ")} (got ${root.map((entry) => entry.title).join(", ")})`
);

const books = [];
for (const shelf of root) {
  const output = await checkFeed(shelf.href, `${shelf.title} feed`);
  const shelfBooks = entriesOf(output, "BOOK");
  check(shelfBooks.length > 0, `${shelf.title} feed has books (${shelfBooks.length} on page 1)`);
  console.log(shelfBooks.slice(0, 3).map((book) => `    ${book.title}`).join("\n"));
  books.push(...shelfBooks.slice(0, Number(bookCount)));

  const nextPage = /^next page: (.+)$/m.exec(output)?.[1];
  if (nextPage) await checkFeed(nextPage, `${shelf.title} page 2`);
}

for (const { title, href } of books) {
  const book = await fetchTimed(href);
  const label = `"${title}"`;
  check(book.response.status === 200, `${label} downloads (${book.response.status}, ${(book.bytes.length / 1024).toFixed(0)} KB, ${book.ms} ms)`);
  if (book.response.status !== 200) continue;

  check(Buffer.from(book.bytes.subarray(30, 38)).toString() === "mimetype", `${label} starts with the mimetype entry`);

  const files = unzipSync(book.bytes);
  const dir = join(work, href.split("/").at(-1));
  const xmlPaths = [];
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    if (/\.(xhtml|opf|ncx|xml)$/.test(name)) xmlPaths.push(path);
  }

  const wellFormed = run("xml-check", xmlPaths);
  check(wellFormed.ok, `${label} XML is well-formed under expat${wellFormed.ok ? "" : `: ${wellFormed.output}`}`);
  const opf = run("opf-check", [join(dir, "OEBPS/content.opf")]);
  check(opf.ok, `${label} OPF parses in ContentOpfParser`);
  console.log(opf.output.replace(/^/gm, "    "));

  for (const name of Object.keys(files).filter((file) => file.endsWith(".jpg"))) {
    const meta = await sharp(files[name]).metadata();
    const fits = meta.format === "jpeg" && !meta.isProgressive && meta.width <= 528 && meta.height <= 792;
    check(fits, `${label} ${name} is a baseline JPEG within 528x792 (${meta.width}x${meta.height}, ${meta.channels}ch)`);
  }
}

console.log(`\n${failures.length === 0 ? "ALL PASS" : `${failures.length} FAILED`} (artifacts in ${work})`);
process.exit(failures.length === 0 ? 0 : 1);
