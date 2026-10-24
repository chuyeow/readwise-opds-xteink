import { createApp } from "../src/shell/app.js";

export function GET(request) {
  return createApp({ env: process.env }).feed(request);
}
