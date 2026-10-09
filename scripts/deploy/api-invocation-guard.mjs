#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
/**
 * Invocation guard for the production API smoke check.
 *
 * GET /api/billing/subscription with no session is handled in
 * apps/server/src/routes/billing/routes.ts. The route throws HTTPException
 * 401, message "Authentication required". The API error handler responds
 * with JSON { success: false, error, code: "HTTP_401" } and content-type
 * application/json.
 *
 * A pass requires that status, content type, and JSON shape together.
 * HTML login pages, redirects to vercel.com, protection headers, 5xx, and
 * timeouts do not pass.
 *
 * Usage:
 *   node scripts/deploy/api-invocation-guard.mjs --url https://api.revealui.com/api/billing/subscription
 *
 * Exit codes:
 *   0  app 401 JSON
 *   1  response did not match, or the request timed out
 *   2  bad arguments
 */
import { parseArgs } from 'node:util';

/** Unauthenticated subscription route status. */
export const EXPECTED_STATUS = 401;

/** HTTPException message for a missing session. */
export const EXPECTED_ERROR = 'Authentication required';

/** errorHandler code for that 401 (HTTP_401). */
export const EXPECTED_CODE = 'HTTP_401';

/** One probe gives up after this many milliseconds. */
export const PROBE_TIMEOUT_MS = 10_000;

/**
 * Response headers that mark a platform protection page rather than the app.
 * Names are compared case-insensitively.
 */
export const PROTECTION_HEADER_NAMES = ['x-vercel-mitigated', 'x-vercel-protection'];

/**
 * @param {unknown} headers
 * @returns {Map<string, string[]>}
 */
function headerMap(headers) {
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
function headerValues(headers, name) {
  return headers.get(name.toLowerCase()) ?? [];
}

/**
 * @param {string} contentType
 * @returns {string}
 */
function mediaType(contentType) {
  const semi = contentType.indexOf(';');
  const raw = semi === -1 ? contentType : contentType.slice(0, semi);
  return raw.trim().toLowerCase();
}

/**
 * @param {string} host
 * @returns {boolean}
 */
function isVercelHost(host) {
  const normalized = host.toLowerCase();
  return normalized === 'vercel.com' || normalized.endsWith('.vercel.com');
}

/**
 * @param {Map<string, string[]>} headers
 * @returns {boolean}
 */
function hasVercelRedirect(headers) {
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
function hasProtectionHeader(headers) {
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
 * @param {string} body
 * @returns {boolean}
 */
function isAppUnauthenticatedBody(body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  return (
    parsed.success === false && parsed.error === EXPECTED_ERROR && parsed.code === EXPECTED_CODE
  );
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isTimeoutError(error) {
  return (
    error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

/**
 * Decide whether one probe response is the app's unauthenticated 401.
 *
 * @param {{
 *   status?: number,
 *   headers?: unknown,
 *   body?: string,
 *   timedOut?: boolean,
 * }} response
 * @returns {{ pass: boolean, reason: string }}
 */
export function classifyInvocationResponse(response) {
  if (response.timedOut === true) return { pass: false, reason: 'timeout' };

  const headers = headerMap(response.headers);
  if (hasProtectionHeader(headers)) return { pass: false, reason: 'protection-header' };
  if (hasVercelRedirect(headers)) return { pass: false, reason: 'vercel-redirect' };

  if (response.status !== EXPECTED_STATUS) return { pass: false, reason: 'unexpected-status' };

  const type = mediaType(headerValues(headers, 'content-type')[0] ?? '');
  if (type === 'text/html') return { pass: false, reason: 'html-response' };
  if (type !== 'application/json') return { pass: false, reason: 'not-json' };
  if (!isAppUnauthenticatedBody(response.body ?? '')) {
    return { pass: false, reason: 'unexpected-body' };
  }

  return { pass: true, reason: 'app-401' };
}

/**
 * Fetch one URL and classify the response. A hung request is a failed timeout.
 *
 * @param {string} url
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 * }} [options]
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
export async function probeInvocation(url, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? PROBE_TIMEOUT_MS;
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
    return classifyInvocationResponse({
      status: response.status,
      headers: response.headers,
      body,
    });
  } catch (error) {
    if (isTimeoutError(error)) return { pass: false, reason: 'timeout' };
    return { pass: false, reason: 'request-failed' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
export async function runInvocationGuard(argv) {
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

  const result = await probeInvocation(url);
  if (result.pass) {
    console.log(`invocation guard passed (${result.reason})`);
    return 0;
  }
  console.error(`invocation guard failed (${result.reason})`);
  return 1;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runInvocationGuard(process.argv.slice(2))
    .then((code) => {
      process.exit(code);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
