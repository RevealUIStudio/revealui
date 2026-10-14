#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
/**
 * Admin smoke probe for https://admin.revealui.com/login.
 *
 * A pass is HTTP 200 HTML that contains the sign-in page rendered by
 * apps/admin/src/app/(frontend)/login/LoginForm.tsx: the "Sign in" heading
 * and the email field id. A 302 to vercel.com/sso-api, any other 3xx, and
 * the "Protected by Vercel Authentication" page do not pass.
 *
 * Usage:
 *   node scripts/deploy/admin-login-probe.mjs --url https://admin.revealui.com/login
 */
import {
  fetchProbe,
  headerMap,
  headerValues,
  mediaType,
  rejectUntrustedResponse,
  runUrlProbe,
} from './smoke-probe-response.mjs';

/** Sign-in heading rendered on the admin login page. */
export const ADMIN_SIGN_IN_MARKER = 'Sign in';

/** Email field id rendered on the admin login page. */
export const ADMIN_EMAIL_FIELD_MARKER = 'id="email"';

/** Page probe budget. Matches the previous admin curl --max-time. */
export const ADMIN_PROBE_TIMEOUT_MS = 20_000;

/**
 * @param {{
 *   status?: number,
 *   headers?: unknown,
 *   body?: string,
 *   timedOut?: boolean,
 * }} response
 * @returns {{ pass: boolean, reason: string }}
 */
export function classifyAdminLoginProbe(response) {
  const rejected = rejectUntrustedResponse(response);
  if (rejected) return rejected;

  if (response.status !== 200) return { pass: false, reason: 'unexpected-status' };

  const type = mediaType(headerValues(headerMap(response.headers), 'content-type')[0] ?? '');
  if (type !== 'text/html') return { pass: false, reason: 'not-html' };

  const body = response.body ?? '';
  if (!body.includes(ADMIN_SIGN_IN_MARKER) || !body.includes(ADMIN_EMAIL_FIELD_MARKER)) {
    return { pass: false, reason: 'missing-app-marker' };
  }

  return { pass: true, reason: 'admin-login' };
}

/**
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
export async function probeAdminLogin(url, options = {}) {
  try {
    const response = await fetchProbe(url, {
      ...options,
      timeoutMs: options.timeoutMs ?? ADMIN_PROBE_TIMEOUT_MS,
    });
    return classifyAdminLoginProbe(response);
  } catch {
    return { pass: false, reason: 'request-failed' };
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  runUrlProbe(process.argv.slice(2), (url) => probeAdminLogin(url), 'admin login probe')
    .then((code) => {
      process.exit(code);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
