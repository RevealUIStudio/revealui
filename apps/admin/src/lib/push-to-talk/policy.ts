/**
 * Voice-in may talk to on-device WASM, a loopback/LAN sidecar, or an
 * operator-pinned Cloudflare Tunnel hostname. Cloud STT SaaS is refused.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '::1']);

const STT_SAAS_HOST_SUFFIXES = [
  'openai.com',
  'assemblyai.com',
  'deepgram.com',
  'googleapis.com',
  'google.com',
  'azure.com',
  'elevenlabs.io',
  'rev.ai',
  'gladia.io',
] as const;

function isDecimalOctet(part: string): boolean {
  if (part.length === 0 || part.length > 3) return false;
  let value = 0;
  for (const ch of part) {
    if (ch < '0' || ch > '9') return false;
    value = value * 10 + (ch.charCodeAt(0) - 48);
  }
  return value <= 255;
}

function parseIpv4(hostname: string): [number, number, number, number] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  if (!parts.every((part) => isDecimalOctet(part))) return null;
  return [Number(parts[0]), Number(parts[1]), Number(parts[2]), Number(parts[3])];
}

function hostHasSuffix(hostname: string, suffix: string): boolean {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

/** 127.0.0.0/8, localhost, and IPv6 loopback. No regex (M2). */
export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(host)) return true;
  if (host.startsWith('[') && host.endsWith(']')) {
    return host.slice(1, -1) === '::1';
  }
  const ip = parseIpv4(host);
  return ip !== null && ip[0] === 127;
}

/** RFC1918 IPv4 — same-WiFi laptop sidecar without a paid mesh VPN. */
export function isPrivateIpv4Hostname(hostname: string): boolean {
  const ip = parseIpv4(hostname.toLowerCase());
  if (!ip) return false;
  const [a, b] = ip;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  return a === 172 && b >= 16 && b <= 31;
}

/** Cloudflare quick-tunnel host used for Access-protected phone → laptop sidecar. */
export function isCloudflareTunnelHostname(hostname: string): boolean {
  return hostHasSuffix(hostname.toLowerCase(), 'trycloudflare.com');
}

export function isSaasSttHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return STT_SAAS_HOST_SUFFIXES.some((suffix) => hostHasSuffix(host, suffix));
}

/** Same-origin relative path — not protocol-relative. */
export function isSameOriginWhisperPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

/**
 * True for WASM-adjacent same-origin paths, loopback, private LAN, a
 * Cloudflare quick tunnel, or any other operator-pinned http(s) URL that is
 * not a cloud STT SaaS host.
 */
export function isAllowedWhisperEndpoint(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (isSameOriginWhisperPath(trimmed)) return true;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return !isSaasSttHostname(url.hostname);
  } catch {
    return false;
  }
}

/** Origin for CSP `connect-src`, or '' when the URL is forbidden / relative. */
export function whisperConnectSrcOrigin(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || isSameOriginWhisperPath(trimmed)) return '';
  if (!isAllowedWhisperEndpoint(trimmed)) return '';
  try {
    return new URL(trimmed).origin;
  } catch {
    return '';
  }
}
