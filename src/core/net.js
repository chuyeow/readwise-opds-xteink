import { BlockList, isIP } from "node:net";

// Article HTML is third-party content, so its image URLs must not reach the
// function's own network: loopback, private, link-local, CGNAT and reserved.
const internal = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4]
]) {
  internal.addSubnet(network, prefix, "ipv4");
}
internal.addAddress("::", "ipv6");
internal.addAddress("::1", "ipv6");
internal.addSubnet("fc00::", 7, "ipv6");
internal.addSubnet("fe80::", 10, "ipv6");
internal.addSubnet("ff00::", 8, "ipv6");

export function isPublicAddress(address) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  const candidate = mapped ?? address;
  const family = isIP(candidate);
  if (family === 0) return false;
  return !internal.check(candidate, family === 4 ? "ipv4" : "ipv6");
}
