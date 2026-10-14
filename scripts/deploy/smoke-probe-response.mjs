/**
 * Shared response checks for production smoke probes.
 *
 * A redirect is not a pass. curl without --location still exits 0 on a 302,
 * and curl --fail does too, because 3xx is not an HTTP error for curl. The
 * protection response is a 302 to https://vercel.com/sso-api. These helpers
 * reject that redirect, any other 3xx, and the authentication page body.
 */
import { parseArgs } from 'node:util';

/** Phrase on the Vercel authentication page. */
export const PROTECTION_BODY_MARKER = 'Protected by Vercel Authentication';

/**
 * Response headers that mark a platform protection page rather than the app.
 * Names are compared case-insensitively.
 */
export const PROTECTION_HEADER_NAMES = ['x-vercel-mitigated', 'x-vercel-protection'];

/**
 * @param {unknown} headers
 * @returns {Map<string, string[]>}
 */
export function headerMap(headers) {
  /** @type {Map<string, string[]>} */
  const map = new Map();
  const add = (name, value) => {
    const key = String(name).toLowerCase();
    const list = map.get(key);
    if (list) list.push(String(value));
    else map.set(key, [String(value)]);
  };

  if (!headers) return map;

  if (typeof headers.getSetCookie === 'function' && typeof headers.forEach === 'function') {
    headers.forEach((value, name) => {
      if (String(name).toLowerCase() === 'set-cookie') return;
      add(name, value);
    });
    for (const cookie of headers.getSetCookie()) add('set-cookie', cookie);
    return map;
  }

  if (typeof headers.forEach === 'function') {
    headers.forEach((value, name) => add(name, value));
    return map;
  }

  if (typeof headers === 'object') {
    for (const [name, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        for (const item of value) add(name, item);
      } else if (value != null) {
        add(name, value);
      }
    }
  }

  return map;
}

/**
 * @param {Map<string, string[]>} headers
 * @param {string} name
 * @returns {string[]}
 */
export function headerValues(headers, name) {
  return headers.get(name.toLowerCase()) ?? [];
}

/**
 * @param {string} contentType
 * @returns {string}
 */
export function mediaType(contentType) {
  const semi = contentType.indexOf(';');
  const raw = semi === -1 ? contentType : contentType.slice(0, semi);
  return raw.trim().toLowerCase();
}

/**
 * @param {string} host
 * @returns {boolean}
 */
export function isVercelHost(host) {
  const normalized = host.toLowerCase();
  return normalized === 'vercel.com' || normalized.endsWith('.vercel.com');
}

/**
 * @param {number | undefined} status
 * @returns {boolean}
 */
export function isRedirectStatus(status) {
  return typeof status === 'number' && status >= 300 && status < 400;
}

/**
 * @param {Map<string, string[]>} headers
 * @returns {boolean}
 */
export function hasVercelRedirect(headers) {
  for (const location of headerValues(headers, 'location')) {
    if (location.trim() === '') continue;
    let host = '';
    try {
      host = new URL(location).hostname;
    } catch {
      continue;
    }
    if (isVercelHost(host)) return true;
  }
  return false;
}

/**
 * @param {Map<string, string[]>} headers
 * @returns {boolean}
 */
export function hasProtectionHeader(headers) {
  for (const name of PROTECTION_HEADER_NAMES) {
    if (headerValues(headers, name).some((value) => value.trim() !== '')) return true;
  }
  for (const cookie of headerValues(headers, 'set-cookie')) {
    const lower = cookie.toLowerCase();
    if (lower.includes('_vercel_sso') || lower.includes('_vercel_jwt')) return true;
  }
  return false;
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isTimeoutError(error) {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

/**
 * Reject redirects and authentication pages before a probe applies its own
 * success rule. Returns null when the response may still be the app.
 *
 * @param {{
 *   status?: number,
 *   headers?: unknown,
 *   body?: string,
 *   timedOut?: boolean,
 * }} response
 * @returns {{ pass: false, reason: string } | null}
 */
export function rejectUntrustedResponse(response) {
  if (response.timedOut === true) return { pass: false, reason: 'timeout' };

  const body = response.body ?? '';
  if (body.includes(PROTECTION_BODY_MARKER)) return { pass: false, reason: 'protection-body' };

  const headers = headerMap(response.headers);
  if (hasProtectionHeader(headers)) return { pass: false, reason: 'protection-header' };
  if (hasVercelRedirect(headers)) return { pass: false, reason: 'vercel-redirect' };
  if (isRedirectStatus(response.status)) return { pass: false, reason: 'redirect' };

  return null;
}

/**
 * GET one URL without following redirects. A hung request becomes timedOut.
 *
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<{ status: number, headers: unknown, body: string, timedOut: boolean }>}
 */
export async function fetchProbe(url, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    const body = typeof response.text === 'function' ? await response.text() : '';
    return {
      status: response.status,
      headers: response.headers,
      body,
      timedOut: false,
    };
  } catch (error) {
    if (isTimeoutError(error)) {
      return { status: 0, headers: {}, body: '', timedOut: true };
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string[]} argv
 * @param {(url: string) => Promise<{ pass: boolean, reason: string }>} probe
 * @param {string} label
 * @returns {Promise<number>}
 */
export async function runUrlProbe(argv, probe, label) {
  let url = '';
  try {
    const { values } = parseArgs({
      args: argv,
      options: { url: { type: 'string' } },
      strict: true,
    });
    url = values.url ?? '';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid arguments';
    console.error(message);
    return 2;
  }
  if (url.trim() === '') {
    console.error('missing --url');
    return 2;
  }

  let result;
  try {
    result = await probe(url);
  } catch {
    console.error(`${label} failed (request-failed)`);
    return 1;
  }
  if (result.pass) {
    console.log(`${label} passed (${result.reason})`);
    return 0;
  }
  console.error(`${label} failed (${result.reason})`);
  return 1;
}
