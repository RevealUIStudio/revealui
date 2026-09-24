/**
 * Session cookie domain for a request host (GAP-343).
 *
 * Staging hosts always resolve to `staging.revealui.com` so a production
 * `SESSION_COOKIE_DOMAIN` (for example `.revealui.com`) is not attached to
 * the staging subtree. Every other host returns `configuredDomain` unchanged.
 * This function does not read the environment and does not apply the
 * production-only gate. Callers keep that gate.
 */

/** Cookie Domain attribute for the staging.revealui.com subtree. No leading dot. */
export const STAGING_SESSION_COOKIE_DOMAIN = 'staging.revealui.com';

/**
 * Hostname from a Host or X-Forwarded-Host value.
 * Strips a scheme, path, trailing dot, and numeric port. Uses the first
 * comma-separated entry. Returns null when nothing usable remains.
 * String methods only (no regular expressions).
 */
export function normalizeRequestHost(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let value = raw.trim().toLowerCase();
  if (value.length === 0) return null;

  const comma = value.indexOf(',');
  if (comma !== -1) {
    value = value.slice(0, comma).trim();
  }
  if (value.length === 0) return null;

  const scheme = value.indexOf('://');
  if (scheme !== -1) {
    value = value.slice(scheme + 3);
  }

  const slash = value.indexOf('/');
  if (slash !== -1) {
    value = value.slice(0, slash);
  }

  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end === -1) return null;
    const bracketed = value.slice(0, end + 1);
    return bracketed.length > 2 ? bracketed : null;
  }

  const colon = value.lastIndexOf(':');
  if (colon !== -1) {
    const port = value.slice(colon + 1);
    if (port.length > 0 && isAllDigits(port)) {
      value = value.slice(0, colon);
    }
  }

  if (value.endsWith('.')) {
    value = value.slice(0, -1);
  }

  if (value.length === 0) return null;
  return value;
}

function isAllDigits(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

/**
 * True for `staging.revealui.com` and any host under `*.staging.revealui.com`.
 * Label-boundary match: `evilstaging.revealui.com` and
 * `staging.revealui.com.evil.com` are not staging hosts.
 */
export function isStagingRevealHost(requestHost: string | null | undefined): boolean {
  const host = normalizeRequestHost(requestHost);
  if (!host) return false;
  if (host === STAGING_SESSION_COOKIE_DOMAIN) return true;
  return host.endsWith(`.${STAGING_SESSION_COOKIE_DOMAIN}`);
}

/**
 * Cookie Domain for this request.
 *
 * Staging hosts return `staging.revealui.com` even when `configuredDomain`
 * is the production domain or unset. Every other host, including a missing
 * host, returns `configuredDomain` exactly (including `undefined`).
 */
export function sessionCookieDomainForHost(
  requestHost: string | null | undefined,
  configuredDomain: string | undefined,
): string | undefined {
  if (isStagingRevealHost(requestHost)) {
    return STAGING_SESSION_COOKIE_DOMAIN;
  }
  return configuredDomain;
}

/**
 * Public request host. Prefer `Host` so a client-supplied `X-Forwarded-Host`
 * cannot override the host the platform already set. Fall back to
 * `X-Forwarded-Host` only when `Host` is absent.
 */
export function requestHostFromHeaders(
  getHeader: (name: string) => string | null | undefined,
): string | null {
  const host = getHeader('host');
  if (typeof host === 'string' && host.trim().length > 0) return host;
  const forwarded = getHeader('x-forwarded-host');
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) return forwarded;
  return null;
}
