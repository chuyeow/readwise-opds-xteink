import { createHash, timingSafeEqual } from "node:crypto";

export function isAuthorized(authorizationHeader, { username, password }) {
  if (!username || !password) return false;

  const match = /^Basic\s+(.+)$/i.exec(authorizationHeader ?? "");
  if (!match) return false;

  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator === -1) return false;

  // Compare digests so the comparison is constant-time regardless of length.
  const userOk = sameSecret(decoded.slice(0, separator), username);
  const passOk = sameSecret(decoded.slice(separator + 1), password);
  return userOk && passOk;
}

function sameSecret(given, expected) {
  const digest = (value) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}
