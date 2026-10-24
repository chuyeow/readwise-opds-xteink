// Local stand-in for Vercel: same routes as vercel.json's rewrites.
// Usage: node --env-file=.env.local scripts/dev-server.js [port]
import { createServer } from "node:http";

import { GET as book } from "../api/book.js";
import { GET as opds } from "../api/opds.js";

const port = Number(process.argv[2] ?? 8787);

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const request = new Request(url, { headers: req.headers });
  const bookMatch = /^\/opds\/books\/([^/]+)$/.exec(url.pathname);
  const shelfMatch = /^\/opds\/([^/]+)$/.exec(url.pathname);

  let response;
  if (url.pathname === "/opds") {
    response = await opds(request);
  } else if (bookMatch) {
    url.searchParams.set("file", decodeURIComponent(bookMatch[1]));
    response = await book(new Request(url, { headers: req.headers }));
  } else if (shelfMatch) {
    url.searchParams.set("location", decodeURIComponent(shelfMatch[1]));
    response = await opds(new Request(url, { headers: req.headers }));
  } else {
    response = new Response("Not found\n", { status: 404 });
  }

  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
  console.log(`${req.method} ${req.url} ${response.status}`);
}).listen(port, () => console.log(`readwise-opds on http://localhost:${port}/opds`));
