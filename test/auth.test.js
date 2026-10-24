import assert from "node:assert/strict";
import test from "node:test";

import { isAuthorized } from "../src/core/auth.js";

const credentials = { username: "reader", password: "s3cret:pass" };
const basic = (value) => `Basic ${Buffer.from(value).toString("base64")}`;

test("isAuthorized accepts matching Basic credentials, including colons in the password", () => {
  assert.equal(isAuthorized(basic("reader:s3cret:pass"), credentials), true);
});

test("isAuthorized rejects wrong, missing, or malformed credentials", () => {
  assert.equal(isAuthorized(basic("reader:nope"), credentials), false);
  assert.equal(isAuthorized(basic("other:s3cret:pass"), credentials), false);
  assert.equal(isAuthorized(null, credentials), false);
  assert.equal(isAuthorized("Bearer abc", credentials), false);
  assert.equal(isAuthorized(basic("no-colon"), credentials), false);
});

test("isAuthorized fails closed when the server has no credentials configured", () => {
  assert.equal(isAuthorized(basic(":"), { username: "", password: "" }), false);
  assert.equal(isAuthorized(basic("a:b"), { username: undefined, password: undefined }), false);
});
