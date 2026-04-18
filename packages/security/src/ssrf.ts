/**
 * SSRF protection — DNS resolution + private IP blocking.
 *
 * Prevents server-side request forgery by resolving hostnames
 * BEFORE fetch and rejecting private/reserved IP ranges.
 * Guards against DNS rebinding by checking all resolved IPs.
 */

import { resolve4, resolve6 } from 'node:dns/promises';

/**
 * Convert an IPv4 address string to a 32-bit number.
 */
function ipv4ToNum(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return -1;
  let num = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return -1;
    num = (num << 8) | n;
  }
  return num >>> 0; // unsigned 32-bit
}

/**
 * IPv4 private/reserved CIDR ranges.
 * Each entry: [networkNum, maskBits].
 */
const PRIVATE_CIDRS: [number, number][] = [
  [ipv4ToNum('0.0.0.0'), 8], // Current network (RFC 1122)
  [ipv4ToNum('10.0.0.0'), 8], // Private (RFC 1918)
  [ipv4ToNum('100.64.0.0'), 10], // Shared address (RFC 6598, CGN)
  [ipv4ToNum('127.0.0.0'), 8], // Loopback (RFC 1122)
  [ipv4ToNum('169.254.0.0'), 16], // Link-local (RFC 3927)
  [ipv4ToNum('172.16.0.0'), 12], // Private (RFC 1918)
  [ipv4ToNum('192.0.0.0'), 24], // IETF protocol assignments (RFC 6890)
  [ipv4ToNum('192.0.2.0'), 24], // Documentation (TEST-NET-1, RFC 5737)
  [ipv4ToNum('192.168.0.0'), 16], // Private (RFC 1918)
  [ipv4ToNum('198.18.0.0'), 15], // Benchmarking (RFC 2544)
  [ipv4ToNum('198.51.100.0'), 24], // Documentation (TEST-NET-2, RFC 5737)
  [ipv4ToNum('203.0.113.0'), 24], // Documentation (TEST-NET-3, RFC 5737)
  [ipv4ToNum('224.0.0.0'), 4], // Multicast (RFC 5771)
  [ipv4ToNum('240.0.0.0'), 4], // Reserved (RFC 1112)
];

/**
 * Check whether an IPv4 address falls in a private/reserved range.
 */
export function isPrivateIpv4(ip: string): boolean {
  const num = ipv4ToNum(ip);
  if (num < 0) return true; // malformed → treat as private (fail-closed)

  for (const [network, bits] of PRIVATE_CIDRS) {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    if ((num & mask) === (network & mask)) {
      return true;
    }
  }
  return false;
}

/**
 * Check whether an IPv6 address is private/reserved.
 *
 * Handles: ::1 (loopback), fe80::/10 (link-local), fc00::/7 (ULA),
 * ::ffff:x.x.x.x (IPv4-mapped — delegates to IPv4 check), :: (unspecified).
 */
export function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  // Unspecified
  if (normalized === '::') return true;

  // Loopback
  if (normalized === '::1') return true;

  // IPv4-mapped (::ffff:x.x.x.x)
  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) {
    return isPrivateIpv4(v4Mapped[1]!);
  }

  // Parse first 16-bit group to check prefix
  const expanded = expandIpv6(normalized);
  if (!expanded) return true; // malformed → fail-closed

  const firstWord = Number.parseInt(expanded.slice(0, 4), 16);

  // fc00::/7 — Unique Local Address
  if ((firstWord & 0xfe00) === 0xfc00) return true;

  // fe80::/10 — Link-Local
  if ((firstWord & 0xffc0) === 0xfe80) return true;

  // ff00::/8 — Multicast
  if ((firstWord & 0xff00) === 0xff00) return true;

  // 100::/64 — Discard (RFC 6666)
  if (firstWord === 0x0100) return true;

  // 2001:db8::/32 — Documentation
  if (expanded.startsWith('2001:0db8')) return true;

  return false;
}

/**
 * Expand an abbreviated IPv6 address to its full 32-char hex form
 * (8 groups of 4 hex chars, colon-separated).
 */
function expandIpv6(ip: string): string | null {
  // Handle :: expansion
  let halves: string[];
  if (ip.includes('::')) {
    const [left = '', right = ''] = ip.split('::');
    const leftGroups = left ? left.split(':') : [];
    const rightGroups = right ? right.split(':') : [];
    const missing = 8 - leftGroups.length - rightGroups.length;
    if (missing < 0) return null;
    const middle = Array(missing).fill('0000');
    halves = [...leftGroups, ...middle, ...rightGroups];
  } else {
    halves = ip.split(':');
  }

  if (halves.length !== 8) return null;

  return halves.map((g) => g.padStart(4, '0')).join(':');
}

/**
 * Check whether any IP (v4 or v6) is private/reserved.
 */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    return isPrivateIpv6(ip);
  }
  return isPrivateIpv4(ip);
}

/**
 * Resolve a URL's hostname and assert all resolved IPs are public.
 *
 * Throws if any resolved IP is private/reserved (SSRF protection).
 * Safe to call with IP literals (skips DNS, just validates the IP).
 *
 * @throws Error with descriptive message if validation fails
 */
export async function assertPublicUrl(urlString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`SSRF: invalid URL: ${urlString}`);
  }

  // Only allow http(s)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`SSRF: disallowed protocol: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname;

  // If hostname is an IP literal, check directly (no DNS needed)
  if (hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    if (isPrivateIpv4(hostname)) {
      throw new Error(`SSRF: resolved to private IP: ${hostname}`);
    }
    return;
  }

  // IPv6 literal (brackets stripped by URL parser)
  if (hostname.includes(':')) {
    if (isPrivateIpv6(hostname)) {
      throw new Error(`SSRF: resolved to private IPv6: ${hostname}`);
    }
    return;
  }

  // Resolve hostname — check ALL returned IPs (prevents DNS rebinding
  // attacks where one A record is public and another is private)
  const errors: string[] = [];

  try {
    const ipv4s = await resolve4(hostname);
    for (const ip of ipv4s) {
      if (isPrivateIpv4(ip)) {
        errors.push(ip);
      }
    }
  } catch {
    // No A records — not an error, might have AAAA only
  }

  try {
    const ipv6s = await resolve6(hostname);
    for (const ip of ipv6s) {
      if (isPrivateIpv6(ip)) {
        errors.push(ip);
      }
    }
  } catch {
    // No AAAA records
  }

  if (errors.length > 0) {
    throw new Error(`SSRF: ${hostname} resolved to private IP(s): ${errors.join(', ')}`);
  }
}
