/**
 * SSRF protection — DNS resolution + private IP blocking + connection pinning.
 *
 * Two layers:
 *
 *   1. {@link assertPublicUrl} — resolve a URL's hostname and reject any
 *      private/reserved IP. Returns the validated public IPs so a caller can
 *      pin to them. Use as a fast, clear pre-flight.
 *
 *   2. {@link createSafeFetch} — a `fetch` that pins the socket to the IP it
 *      validated (via an undici dispatcher whose `connect.lookup` re-validates
 *      at dial time) and refuses redirects. This closes the resolve-then-fetch
 *      DNS-rebinding TOCTOU that a bare `assertPublicUrl` + `fetch` leaves open.
 *
 * Use {@link createSafeFetch} for every server-side fetch of a URL that
 * originates from user or tenant input (remote MCP servers, marketplace proxy
 * targets, webhooks, image fetches, …).
 */

import type { LookupAddress } from 'node:dns';
import { resolve4, resolve6 } from 'node:dns/promises';
import { isIP } from 'node:net';

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
 * IPv4-mapped (::ffff:x.x.x.x in BOTH dotted and hex form — delegates to the
 * IPv4 check), and :: (unspecified).
 */
export function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();

  // Unspecified
  if (normalized === '::') return true;

  // Loopback
  if (normalized === '::1') return true;

  // IPv4-mapped in dotted form (::ffff:127.0.0.1) — delegate to the IPv4 check.
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (isIP(mapped) === 4) {
      return isPrivateIpv4(mapped);
    }
  }

  const expanded = expandIpv6(normalized);
  if (!expanded) return true; // malformed → fail-closed

  const groups = expanded.split(':');

  // IPv4-mapped in hex form (::ffff:7f00:1 → 127.0.0.1): first five groups
  // zero + sixth group ffff. The old dotted-only check missed this and let
  // hex-form loopback (::ffff:7f00:1) bypass the guard.
  if (groups.slice(0, 5).every((g) => g === '0000') && groups[5] === 'ffff') {
    const hi = Number.parseInt(groups[6] ?? '0', 16);
    const lo = Number.parseInt(groups[7] ?? '0', 16);
    const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isPrivateIpv4(v4);
  }

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
 * Resolve a hostname (or validate an IP literal) and return the public IPs it
 * maps to. Throws if any resolved IP is private/reserved, or if the hostname
 * resolves to no public IP at all (fail-closed).
 *
 * Checks ALL returned records (an attacker can publish one public + one
 * private A record to slip past a first-record-only check).
 */
async function resolvePublicIps(hostname: string): Promise<string[]> {
  // URL.hostname keeps the brackets for IPv6 literals (e.g. "[::1]"); strip
  // them so isIP/DNS resolution see the bare address.
  const host =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  const literal = isIP(host);
  if (literal === 4) {
    if (isPrivateIpv4(host)) {
      throw new Error(`SSRF: ${host} is a private/reserved IP`);
    }
    return [host];
  }
  if (literal === 6) {
    if (isPrivateIpv6(host)) {
      throw new Error(`SSRF: ${host} is a private/reserved IPv6`);
    }
    return [host];
  }

  const [v4, v6] = await Promise.all([
    resolve4(host).catch(() => [] as string[]),
    resolve6(host).catch(() => [] as string[]),
  ]);

  const privateIps: string[] = [];
  const publicIps: string[] = [];
  for (const ip of v4) (isPrivateIpv4(ip) ? privateIps : publicIps).push(ip);
  for (const ip of v6) (isPrivateIpv6(ip) ? privateIps : publicIps).push(ip);

  if (privateIps.length > 0) {
    throw new Error(`SSRF: ${host} resolved to private IP(s): ${privateIps.join(', ')}`);
  }
  if (publicIps.length === 0) {
    throw new Error(`SSRF: ${host} did not resolve to any public IP address`);
  }
  return publicIps;
}

/**
 * Resolve a URL's hostname and assert all resolved IPs are public.
 *
 * Returns the validated public IP(s). Safe to call with IP literals (skips
 * DNS, just validates the literal). Use as a fast pre-flight; the durable
 * rebind guard is {@link createSafeFetch}, which re-validates at connect time.
 *
 * @throws Error with a descriptive message if validation fails.
 */
export async function assertPublicUrl(url: string | URL): Promise<string[]> {
  let parsed: URL;
  try {
    parsed = typeof url === 'string' ? new URL(url) : url;
  } catch {
    throw new Error(`SSRF: invalid URL: ${String(url)}`);
  }

  // Only allow http(s)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`SSRF: disallowed protocol: ${parsed.protocol}`);
  }

  return resolvePublicIps(parsed.hostname);
}

/**
 * Options for {@link createSafeFetch}.
 */
export interface SafeFetchOptions {
  /** Underlying fetch implementation. Defaults to the global `fetch`. Injectable for tests. */
  baseFetch?: typeof fetch;
  /**
   * Internal seam: override the undici dispatcher factory. Tests inject a stub
   * so they don't construct a real connection pool. Production leaves this
   * unset and gets the IP-validating, connection-pinning dispatcher.
   */
  dispatcherFactory?: () => Promise<unknown>;
}

/**
 * Build a `fetch` hardened against SSRF.
 *
 *   1. Pre-flight: validate the URL's protocol and reject private/reserved IPs
 *      ({@link assertPublicUrl}) — fast, with a clear error.
 *   2. Pin: route the request through an undici dispatcher whose `connect`
 *      lookup re-resolves AND re-validates the hostname at dial time, returning
 *      only public IPs. The address that is validated is the address that is
 *      dialed — closing the DNS-rebinding window between resolution and
 *      connection (TLS SNI/cert verification still use the original hostname).
 *   3. Refuse redirects: a 3xx with a `Location` throws rather than chasing an
 *      attacker-chosen target (a classic SSRF-guard bypass).
 *
 * The dispatcher is created once and reused (connection pooling); its lookup is
 * hostname-agnostic, so a single instance safely guards every request.
 */
export function createSafeFetch(options: SafeFetchOptions = {}): typeof fetch {
  const baseFetch = options.baseFetch ?? fetch;
  const dispatcherFactory = options.dispatcherFactory ?? createValidatingDispatcher;

  let dispatcherPromise: Promise<unknown> | undefined;
  const getDispatcher = (): Promise<unknown> => {
    if (!dispatcherPromise) dispatcherPromise = dispatcherFactory();
    return dispatcherPromise;
  };

  const safeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const target =
      typeof input === 'string'
        ? new URL(input)
        : input instanceof URL
          ? input
          : new URL(input.url);

    // Pre-flight: clear, fast rejection before we open a socket.
    await assertPublicUrl(target);

    const dispatcher = await getDispatcher();
    const response = await baseFetch(target, {
      ...init,
      redirect: 'manual',
      // undici extension: pin/validate the connection via our dispatcher.
      dispatcher,
    } as RequestInit);

    if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
      throw new Error(
        `SSRF: refusing to follow redirect from ${target.href} to ${response.headers.get('location')}`,
      );
    }
    return response;
  };

  return safeFetch as typeof fetch;
}

/**
 * Create an undici dispatcher whose DNS lookup resolves AND validates every
 * connection target, returning only public IPs. A connect to a hostname that
 * resolves to a private/reserved IP fails at the socket layer, so even a
 * rebinding answer that arrives after the pre-flight check cannot reach an
 * internal address.
 */
async function createValidatingDispatcher(): Promise<unknown> {
  const { Agent } = await import('undici');
  const lookup = (
    hostname: string,
    _options: unknown,
    callback: (
      err: NodeJS.ErrnoException | null,
      addresses: string | LookupAddress[],
      family?: number,
    ) => void,
  ): void => {
    resolvePublicIps(hostname).then(
      (ips) =>
        callback(
          null,
          ips.map((address) => ({ address, family: isIP(address) })),
        ),
      (err) => callback(err instanceof Error ? err : new Error(String(err)), []),
    );
  };
  return new Agent({ connect: { lookup } });
}
