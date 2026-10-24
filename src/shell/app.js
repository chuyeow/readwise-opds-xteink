import { articleToXhtmlBody, chapterDocument, collectImageUrls } from "../core/article.js";
import { isAuthorized } from "../core/auth.js";
import { buildEpub } from "../core/epub.js";
import { buildFeed, buildNavigationFeed, findShelf, isReadable } from "../core/feed.js";
import { fetchEpubImages } from "./images.js";
import { createReadwiseClient, ReadwiseError } from "./readwise.js";

const FEED_PAGE_SIZE = 50; // CrossPoint holds at most ~62 entries per page
const MAX_IMAGES = 40;
const ACQUISITION_CONTENT_TYPE = "application/atom+xml;profile=opds-catalog;kind=acquisition; charset=utf-8";
const NAVIGATION_CONTENT_TYPE = "application/atom+xml;profile=opds-catalog;kind=navigation; charset=utf-8";

export function createApp({ env, fetch = globalThis.fetch, lookup, now = () => new Date(), log = defaultLog }) {
  const readwise = createReadwiseClient({ token: env.READWISE_TOKEN, fetch });
  const credentials = { username: env.OPDS_USERNAME, password: env.OPDS_PASSWORD };

  function baseUrl(request) {
    return (env.BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  }

  async function guarded(request, handler) {
    if (!isAuthorized(request.headers.get("authorization"), credentials)) {
      return new Response("Unauthorized\n", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Readwise OPDS", charset="UTF-8"' }
      });
    }
    try {
      return await handler();
    } catch (error) {
      if (!(error instanceof ReadwiseError)) throw error;
      log({ event: "readwise_error", status: error.status });
      if (error.status === 429) {
        return new Response("Readwise rate limit, try again shortly\n", {
          status: 503,
          headers: { "Retry-After": error.retryAfter ?? "60" }
        });
      }
      return new Response(`Readwise error ${error.status}\n`, { status: 502 });
    }
  }

  return {
    // No location: the root menu of shelves. With one: that shelf's documents.
    feed(request) {
      return guarded(request, async () => {
        const params = new URL(request.url).searchParams;
        const location = params.get("location");
        const updated = now().toISOString();
        const noStore = { "Cache-Control": "private, no-store" };

        if (!location) {
          const xml = buildNavigationFeed({ baseUrl: baseUrl(request), updated });
          return new Response(xml, { headers: { "Content-Type": NAVIGATION_CONTENT_TYPE, ...noStore } });
        }

        const shelf = findShelf(location);
        if (!shelf) return new Response("Not found\n", { status: 404 });

        const cursor = params.get("cursor");
        const { docs, nextCursor } = await readwise.listLocation({ location, cursor, limit: FEED_PAGE_SIZE });
        const xml = buildFeed({ shelf, docs: docs.filter(isReadable), baseUrl: baseUrl(request), nextCursor, updated });
        log({ event: "feed", location, cursor, docs: docs.length });
        return new Response(xml, { headers: { "Content-Type": ACQUISITION_CONTENT_TYPE, ...noStore } });
      });
    },

    book(request, id) {
      return guarded(request, async () => {
        const started = Date.now();
        const doc = id ? await readwise.getDocument(id) : null;
        if (!doc || !isReadable(doc) || !doc.html_content) return new Response("Not found\n", { status: 404 });

        const epub = await buildBook(doc, { fetch, lookup, log });
        log({ event: "book", id, bytes: epub.length, ms: Date.now() - started });
        return new Response(epub, {
          headers: {
            "Content-Type": "application/epub+zip",
            "Content-Length": String(epub.length),
            "Content-Disposition": contentDisposition(`${doc.title?.trim() || "Untitled"}.epub`),
            "Cache-Control": "private, no-store"
          }
        });
      });
    }
  };
}

async function buildBook(doc, { fetch, lookup, log }) {
  const title = doc.title?.trim() || "Untitled";
  const imageUrls = collectImageUrls(doc.html_content, doc.source_url, { max: MAX_IMAGES });
  const coverUrl = doc.image_url && /^https?:/.test(doc.image_url) ? doc.image_url : null;
  const fetched = await fetchEpubImages(coverUrl ? [...imageUrls, coverUrl] : imageUrls, { fetch, lookup, log });

  const images = imageUrls
    .filter((url) => fetched.has(url))
    .map((url, index) => ({ url, href: `images/img-${String(index + 1).padStart(3, "0")}.jpg`, bytes: fetched.get(url) }));
  const body = articleToXhtmlBody(doc.html_content, {
    baseUrl: doc.source_url,
    images: new Map(images.map((image) => [image.url, image.href]))
  });
  const language = doc.language || "en";

  return buildEpub({
    id: doc.id,
    title,
    author: doc.author || doc.site_name || "",
    language,
    modified: isoSeconds(doc.updated_at || doc.saved_at),
    chapter: chapterDocument({
      title,
      byline: [doc.author, doc.site_name].filter(Boolean).join(" · "),
      sourceUrl: doc.source_url,
      language,
      body
    }),
    images,
    cover: coverUrl && fetched.has(coverUrl) ? { href: "images/cover.jpg", bytes: fetched.get(coverUrl) } : null
  });
}

// dcterms:modified must be CCYY-MM-DDThh:mm:ssZ.
function isoSeconds(value) {
  const date = new Date(value);
  return (Number.isNaN(date.getTime()) ? new Date(0) : date).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function contentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, " ");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function defaultLog(entry) {
  console.log(JSON.stringify(entry));
}
