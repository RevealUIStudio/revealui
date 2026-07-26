import { lookup as dnsLookup } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';
import type { Tool, ToolResult } from '@revealui/ai';
import { z } from 'zod/v4';

const WEB_FETCH_PARAMS = z.object({
  url: z.string().url().describe('The HTTP(S) URL to fetch.'),
});

const MAX_RESPONSE_CHARS = 100_000;
const FETCH_TIMEOUT_MS = 15_000;

const HEX_DIGITS = '0123456789abcdefABCDEF';

function isValidHexGroup(group: string): boolean {
  if (group.length === 0 || group.length > 4) return false;
  for (const char of group) {
    if (!HEX_DIGITS.includes(char)) return false;
  }
  return true;
}

/** Strip the brackets WHATWG URL wraps a literal IPv6 host in (`[::1]` ->
 * `::1`). Fixed bug (guardrail-2 blocker 3): the old guard compared against
 * the bracketed form, so its own `'::1'` check could never match. */
function stripIPv6Brackets(hostname: string): string {
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

/** Expand a (possibly `::`-compressed) IPv6 address into its 8 16-bit groups.
 * Returns `null` for anything that doesn't parse as exactly 8 groups -- the
 * caller treats an unparsed address as blocked (fail closed). No regex (fleet
 * no-regex rule): hex-digit validation is a plain character-set membership
 * check via `HEX_DIGITS.includes`. */
function expandIPv6Groups(address: string): number[] | null {
  const halves = address.split('::');
  if (halves.length > 2) return null;

  const parseSide = (side: string): number[] | null => {
    if (side === '') return [];
    const groups: number[] = [];
    for (const part of side.split(':')) {
      if (!isValidHexGroup(part)) return null;
      groups.push(Number.parseInt(part, 16));
    }
    return groups;
  };

  if (halves.length === 1) {
    const groups = parseSide(halves[0] ?? '');
    return groups && groups.length === 8 ? groups : null;
  }

  const left = parseSide(halves[0] ?? '');
  const right = parseSide(halves[1] ?? '');
  if (!(left && right)) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0) return null;
  return [...left, ...new Array(missing).fill(0), ...right];
}

/** Blocked IPv4 ranges: loopback, RFC1918 private, link-local (covers the
 * cloud metadata endpoint and its whole /16, not just the single address),
 * carrier-grade NAT (covers 100.100.100.200, the Alibaba Cloud metadata
 * address), and 0.0.0.0/8. */
function isBlockedIPv4(ip: string): boolean {
  const octets = ip.split('.').map(Number);
  const [a, b] = octets;
  if (a === undefined || b === undefined) return true;
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  return false;
}

/** Render the last two 16-bit groups of an expanded IPv6 address as the dotted
 * IPv4 address they embed -- shared by the IPv4-mapped (`::ffff:a.b.c.d`) and
 * NAT64 (`64:ff9b::a.b.c.d`) embed forms below. */
function embeddedIPv4(groups: number[]): string {
  const g6 = groups[6] ?? 0;
  const g7 = groups[7] ?? 0;
  return [(g6 >> 8) & 0xff, g6 & 0xff, (g7 >> 8) & 0xff, g7 & 0xff].join('.');
}

/** Blocked IPv6 ranges: unspecified (::, which routes to localhost on
 * Linux), loopback (::1), unique local addresses (fc00::/7, covers
 * fd00::/8), link-local (fe80::/10), IPv4-mapped addresses (::ffff:a.b.c.d),
 * and the NAT64 well-known prefix (64:ff9b::/96) -- both of the latter two
 * embed an IPv4 address in the low 32 bits, recursively checked against
 * `isBlockedIPv4`. This is what closes the `[::ffff:127.0.0.1]` /
 * `[::ffff:a9fe:a9fe]` bypasses plus the residual `[::]` and
 * `[64:ff9b::a9fe:a9fe]` bypasses (guardrail-2 APPROVE-with-residuals on
 * revealui#2202). */
function isBlockedIPv6(address: string): boolean {
  const groups = expandIPv6Groups(address);
  if (!groups) return true; // unparseable -- fail closed

  const isZero = (n: number): boolean => n === 0;
  if (groups.every(isZero)) return true; // :: unspecified address
  if (groups.slice(0, 7).every(isZero) && groups[7] === 1) return true; // ::1

  const first = groups[0] ?? 0;
  if (first >= 0xfc00 && first <= 0xfdff) return true; // fc00::/7 (ULA)
  if (first >= 0xfe80 && first <= 0xfebf) return true; // fe80::/10 (link-local)

  const isIPv4Mapped = groups.slice(0, 5).every(isZero) && groups[5] === 0xffff;
  if (isIPv4Mapped) return isBlockedIPv4(embeddedIPv4(groups));

  const isNAT64 = groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every(isZero);
  if (isNAT64) return isBlockedIPv4(embeddedIPv4(groups));

  return false;
}

/** Non-IP hostname heuristics that don't need DNS: obvious internal-only
 * suffixes/names. */
function isBlockedHostnameSuffix(host: string): boolean {
  return host === 'localhost' || host.endsWith('.internal') || host.endsWith('.local');
}

/**
 * SSRF guard for the `web_fetch` tool. Blocks the cloud-metadata, loopback,
 * link-local, private, and carrier-grade-NAT ranges across both IPv4 and
 * IPv6 (including IPv4-mapped IPv6 addresses), plus obvious internal
 * hostname suffixes. For a hostname that isn't a literal IP, it resolves DNS
 * and checks every resolved address, which is what stops a public name with
 * a static A/AAAA record pointed at a blocked address (e.g. a
 * `*.nip.io`-style wildcard DNS name resolving to the metadata IP).
 *
 * This does NOT re-check the resolved address at connection time, so a true
 * DNS-rebinding attack (the DNS answer changing between this check and the
 * `fetch()` call a few lines below) is still out of scope -- that requires
 * pinning the TCP connection to the specific address validated here, which
 * is more than this v0.1 scaffold carries. A *static* record pointed at a
 * blocked address, which is the reviewed bypass class, is fully closed.
 */
async function isBlockedHost(hostname: string): Promise<boolean> {
  const host = stripIPv6Brackets(hostname).toLowerCase();

  if (isBlockedHostnameSuffix(host)) return true;
  if (isIPv4(host)) return isBlockedIPv4(host);
  if (isIPv6(host)) return isBlockedIPv6(host);

  // Not a literal IP -- resolve it and check every address it points at.
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dnsLookup(host, { all: true });
  } catch {
    return true; // cannot resolve -- fail closed rather than let fetch() try
  }
  return addresses.some((entry) =>
    entry.family === 6 ? isBlockedIPv6(entry.address) : isBlockedIPv4(entry.address),
  );
}

export const webFetchTool: Tool = {
  name: 'web_fetch',
  label: 'Fetch a web page',
  description:
    'Fetch the text content of a public HTTP or HTTPS URL. Returns up to 100,000 characters of the response body. Does not follow redirects.',
  parameters: WEB_FETCH_PARAMS,
  async execute(rawParams: unknown): Promise<ToolResult> {
    const parsedParams = WEB_FETCH_PARAMS.safeParse(rawParams);
    if (!parsedParams.success) {
      return { success: false, error: `invalid params: ${parsedParams.error.message}` };
    }

    let url: URL;
    try {
      url = new URL(parsedParams.data.url);
    } catch {
      return { success: false, error: 'invalid URL' };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { success: false, error: 'only http/https URLs are allowed' };
    }
    if (await isBlockedHost(url.hostname)) {
      return {
        success: false,
        error: 'this host is not allowed (private, loopback, or internal address)',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal, redirect: 'manual' });
      if (response.status >= 300 && response.status < 400) {
        return { success: false, error: 'redirects are not followed (SSRF safety)' };
      }
      const text = await response.text();
      const truncated = text.length > MAX_RESPONSE_CHARS ? text.slice(0, MAX_RESPONSE_CHARS) : text;
      return {
        success: response.ok,
        content: truncated,
        data: { status: response.status, truncated: text.length > MAX_RESPONSE_CHARS },
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      clearTimeout(timeoutId);
    }
  },
};

/** Built-in tools this actor ships. Expanding the catalog is future work. */
export const BUILT_IN_TOOLS: Tool[] = [webFetchTool];

/** Filter the built-in tool catalog by the actor input's `toolAllowlist`.
 * Omitted allowlist = every built-in tool enabled. Empty array = no tools. */
export function selectTools(allowlist: string[] | undefined): Tool[] {
  if (!allowlist) return BUILT_IN_TOOLS;
  const allowed = new Set(allowlist);
  return BUILT_IN_TOOLS.filter((tool) => allowed.has(tool.name));
}
