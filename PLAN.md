# Plan

Read Readwise Reader articles on an Xteink X3 – a 3.7" e-ink reader with
an ESP32-C3 – without ever copying a file by hand.

## Options

What the device and Readwise make possible, best first, as proposed in
answer to the first prompt ([PROMPTS.md](PROMPTS.md)):

1. **Device-triggered push.** A job on a computer polls the reader's web
   server (CrossPoint's `/api/status`); when the reader is in Wi-Fi transfer
   mode it pulls tagged Reader documents, builds EPUBs and `POST`s them to
   `/upload`. Zero-touch, but home network only and needs the computer awake.
2. **Hosted OPDS catalog.** A serverless function presents the Reader queue
   as an OPDS feed and builds each EPUB on request. The reader's built-in OPDS
   browser fetches whatever you pick, on any Wi-Fi. No computer in the loop.
3. **Daily digest.** One EPUB per day with the top N articles as chapters – an
   output format for 1 or 2.
4. **Read-back loop.** CrossPoint syncs progress to a KOReader-compatible
   server; archive Reader documents at 100% and push highlights back.
5. **Calibre recipe + Calibre wireless.** Works, more moving parts.

**Chosen: 2**, on CrossPoint firmware, queue = Reader Shortlist, hosted on
Vercel. Later extended to three shelves: Shortlist, Later, Archive.

## Shape

```
X3 (CrossPoint) ──OPDS/HTTPS + Basic auth──▶ Vercel function ──▶ Readwise Reader API v3
                                                  │
                                                  └──▶ article images (fetched, transcoded)
```

- `/opds` – navigation feed: Shortlist, Later, Archive.
- `/opds/<shelf>` – acquisition feed, 50 entries a page, `rel="next"` paging on
  Reader's own cursor.
- `/opds/books/<id>.epub` – fetch `html_content`, clean it to XHTML, transcode
  images, zip an EPUB 3 (with NCX fallback). Built per request; nothing stored.
- Functional core (feed XML, HTML→XHTML, EPUB zip, auth) is pure and unit
  tested; the shell does Readwise, image fetches and HTTP.

## Constraints from the firmware

Read from CrossPoint's source rather than assumed:

| Finding | Consequence |
| --- | --- |
| OPDS parser keeps at most ~62 entries per page | 50 per page |
| Acquisition = `opds-spec.org/acquisition` rel + `application/epub+zip`; a `.epub` path is preferred | open-access rel, `/opds/books/<id>.epub` |
| Basic auth only, sent only when username and password are both set | HTTP Basic, constant-time compare |
| X3 panel is 528×792 | images fit inside 528×792 |
| Progressive JPEGs decode at 1/8 scale; decoder renders 8-bit grey anyway | baseline, single-channel JPEG for every image (WebP/PNG/GIF/SVG transcoded) |
| Downloads resume with `Range`; an ignored `Range` restarts from zero | no `Range` support needed; EPUBs byte-deterministic anyway |
| Chapters, OPF and NCX are parsed with expat | strictly well-formed XHTML, invalid XML characters stripped |

Article HTML is third-party content, so image URLs that resolve to loopback,
private, link-local or CGNAT addresses are refused on every redirect hop.

## Verification

The judge is the device's own code, not a reading of it:
`scripts/verify-crosspoint.js` compiles CrossPoint's `OpdsParser` (from the
1.6.5 release and a pinned develop revision) and `ContentOpfParser` on the
host, then walks a live deployment – menu, every shelf and its next page, a
book per shelf – checking every feed parses, every EPUB's XML is well-formed
under expat, the OPF yields title/author/cover, and every image is a baseline
JPEG within 528×792.

## Next

- Archive on finish: read CrossPoint's progress sync and move finished
  documents out of the Shortlist.
- Highlights made on the device back into Readwise.
- Inbox as a fourth shelf.
