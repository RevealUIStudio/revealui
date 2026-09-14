/**
 * Voice-in may only talk to a loopback / same-origin Whisper sidecar.
 * Cloud STT SaaS is never a product path — fail closed.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '::1']);

function isDecimalOctet(part: string): boolean {
  if (part.length === 0 || part.length > 3) return false;
  let value = 0;
  for (const ch of part) {
    if (ch < '0' || ch > '9') return false;
    value = value * 10 + (ch.charCodeAt(0) - 48);
  }
  return value <= 255;
}

/** 127.0.0.0/8, localhost, and IPv6 loopback. No regex (M2). */
export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(host)) return true;
  if (host.startsWith('[') && host.endsWith(']')) {
    return host.slice(1, -1) === '::1';
  }
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  if (parts[0] !== '127') return false;
  return parts.every((part) => isDecimalOctet(part));
}

/** Same-origin relative path (future `/api/stt` proxy) — not protocol-relative. */
export function isSameOriginWhisperPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

/**
 * True when the configured endpoint is a local Whisper sidecar or same-origin path.
 * Refuses every non-loopback absolute URL, including STT SaaS hosts.
 */
export function isAllowedWhisperEndpoint(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (isSameOriginWhisperPath(trimmed)) return true;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return isLoopbackHostname(url.hostname);
  } catch {
    return false;
  }
}

/** Origin for CSP `connect-src`, or '' when the URL is not a local absolute URL. */
export function whisperConnectSrcOrigin(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || isSameOriginWhisperPath(trimmed)) return '';
  try {
    const url = new URL(trimmed);
    if (!isLoopbackHostname(url.hostname)) return '';
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.origin;
  } catch {
    return '';
  }
}
