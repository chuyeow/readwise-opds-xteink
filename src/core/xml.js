// Characters XML 1.0 forbids outright; expat (CrossPoint's parser) rejects them.
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

export function escapeXml(value) {
  return String(value ?? "")
    .replace(INVALID_XML_CHARS, "")
    .replace(/[&<>"']/g, (char) => ESCAPES[char]);
}
