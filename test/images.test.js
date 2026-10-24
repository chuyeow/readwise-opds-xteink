import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { isPublicAddress } from "../src/core/net.js";
import { fetchEpubImages } from "../src/shell/images.js";

const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: "#888" } }).png().toBuffer();

test("isPublicAddress rejects loopback, private, link-local, CGNAT and unspecified ranges", () => {
  for (const address of [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "::1", "::", "fc00::1", "fe80::1", "::ffff:127.0.0.1"
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress("93.184.216.34"), true);
  assert.equal(isPublicAddress("2606:2800:220:1:248:1893:25c8:1946"), true);
});

test("fetchEpubImages skips hosts that resolve to internal addresses without fetching them", async () => {
  const fetched = [];
  const fetch = async (url) => {
    fetched.push(url);
    return new Response(png);
  };
  const lookup = async (host) =>
    host === "internal.example" ? [{ address: "10.0.0.5", family: 4 }] : [{ address: "93.184.216.34", family: 4 }];

  const images = await fetchEpubImages(
    ["https://internal.example/a.png", "http://169.254.169.254/latest", "https://cdn.example/b.png"],
    { fetch, lookup }
  );

  assert.deepEqual([...images.keys()], ["https://cdn.example/b.png"]);
  assert.deepEqual(fetched, ["https://cdn.example/b.png"]);
});

test("fetchEpubImages follows redirects only to public hosts", async () => {
  const fetch = async (url) => {
    if (url === "https://cdn.example/ok.png") return new Response(null, { status: 302, headers: { location: "/final.png" } });
    if (url === "https://cdn.example/final.png") return new Response(png);
    if (url === "https://cdn.example/evil.png") return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/x" } });
    throw new Error(`unexpected fetch ${url}`);
  };
  const lookup = async (host) => [{ address: host === "127.0.0.1" ? "127.0.0.1" : "93.184.216.34", family: 4 }];

  const images = await fetchEpubImages(["https://cdn.example/ok.png", "https://cdn.example/evil.png"], { fetch, lookup });

  assert.deepEqual([...images.keys()], ["https://cdn.example/ok.png"]);
});
