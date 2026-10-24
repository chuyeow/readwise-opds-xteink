import { createApp } from "../src/shell/app.js";

export function GET(request) {
  const file = new URL(request.url).searchParams.get("file") ?? "";
  return createApp({ env: process.env }).book(request, file.replace(/\.epub$/, ""));
}
