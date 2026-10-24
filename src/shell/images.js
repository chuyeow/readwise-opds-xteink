import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

import sharp from "sharp";

import { isPublicAddress } from "../core/net.js";

// Xteink X3 panel in portrait. Anything larger is wasted bytes and RAM on the
// ESP32-C3; CrossPoint decodes progressive JPEGs at 1/8 scale, so output must
// be baseline.
const SCREEN = { width: 528, height: 792 };
const MIN_DIMENSION = 8; // smaller than this is a tracking pixel or spacer
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_REDIRECTS = 3;

export async function toEpubJpeg(input) {
  const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });
  const { width = 0, height = 0 } = await image.metadata();
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) return null;

  const bytes = await image
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ ...SCREEN, fit: "inside", withoutEnlargement: true })
    .grayscale()
    .toColourspace("b-w")
    .jpeg({ quality: 80, progressive: false, mozjpeg: false })
    .toBuffer();
  return new Uint8Array(bytes);
}

// Resolves to a Map of url -> JPEG bytes for every image that downloaded and
// converted; failures are logged and left out.
export async function fetchEpubImages(
  urls,
  { fetch, lookup = (host) => dnsLookup(host, { all: true }), concurrency = 4, timeoutMs = 10_000, maxBytes = 8_000_000, log }
) {
  const converted = new Map();
  const queue = [...urls];

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      try {
        const bytes = await fetchImage(url, { fetch, lookup, timeoutMs, maxBytes });
        const jpeg = await toEpubJpeg(bytes);
        if (jpeg) converted.set(url, jpeg);
      } catch (error) {
        log?.({ event: "image_failed", url, error: error.message });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return converted;
}

// Redirects are followed by hand so every hop is checked against internal
// addresses. The resolve-then-fetch gap leaves DNS rebinding open; acceptable
// here because only bytes that decode as an image ever leave the function.
async function fetchImage(url, { fetch, lookup, timeoutMs, maxBytes }) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current, lookup);
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "readwise-opds-xteink/0.1 (+https://github.com/chuyeow/readwise-opds-xteink)" }
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).href;
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (Number(response.headers.get("content-length") ?? 0) > maxBytes) throw new Error("too large");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error("too large");
    return bytes;
  }
  throw new Error("too many redirects");
}

async function assertPublicUrl(url, lookup) {
  const { protocol, hostname } = new URL(url);
  if (protocol !== "http:" && protocol !== "https:") throw new Error(`blocked protocol ${protocol}`);
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host);
  if (addresses.length === 0 || !addresses.every(({ address }) => isPublicAddress(address))) {
    throw new Error(`blocked internal host ${host}`);
  }
}
