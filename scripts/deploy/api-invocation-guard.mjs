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
 * A 302 to vercel.com/sso-api, any other 3xx, the authentication page,
 * HTML, protection headers, 5xx, and timeouts do not pass.
 *
 * Usage:
 *   node scripts/deploy/api-invocation-guard.mjs --url https://api.revealui.com/api/billing/subscription
 *
 * Exit codes:
 *   0  app 401 JSON
 *   1  response did not match, or the request timed out
 *   2  bad arguments
 */
import {
  fetchProbe,
  headerMap,
  headerValues,
  mediaType,
  rejectUntrustedResponse,
  runUrlProbe,
} from './smoke-probe-response.mjs';

/** Unauthenticated subscription route status. */
export const EXPECTED_STATUS = 401;

/** HTTPException message for a missing session. */
export const EXPECTED_ERROR = 'Authentication required';

/** errorHandler code for that 401 (HTTP_401). */
export const EXPECTED_CODE = 'HTTP_401';

/** One probe gives up after this many milliseconds. */
export const PROBE_TIMEOUT_MS = 10_000;

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
  const rejected = rejectUntrustedResponse(response);
  if (rejected) return rejected;

  if (response.status !== EXPECTED_STATUS) return { pass: false, reason: 'unexpected-status' };

  const type = mediaType(headerValues(headerMap(response.headers), 'content-type')[0] ?? '');
  if (type === 'text/html') return { pass: false, reason: 'html-response' };
  if (type !== 'application/json') return { pass: false, reason: 'not-json' };
  if (!isAppUnauthenticatedBody(response.body ?? '')) {
    return { pass: false, reason: 'unexpected-body' };
  }

  return { pass: true, reason: 'app-401' };
}

/**
 * Fetch one URL and classify the response. A hung request is a failed timeout.
 * Redirects are not followed.
 *
 * @param {string} url
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 * }} [options]
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
export async function probeInvocation(url, options = {}) {
  try {
    const response = await fetchProbe(url, {
      ...options,
      timeoutMs: options.timeoutMs ?? PROBE_TIMEOUT_MS,
    });
    return classifyInvocationResponse(response);
  } catch {
    return { pass: false, reason: 'request-failed' };
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runUrlProbe(process.argv.slice(2), (url) => probeInvocation(url), 'invocation guard')
    .then((code) => {
      process.exit(code);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
