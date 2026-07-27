/**
 * RevealUI Rich Text Editor - media upload POST
 *
 * The admin proxy and the api server's csrfMiddleware require any unsafe
 * request carrying a `revealui-session` cookie to echo the JS-readable
 * `revealui-csrf` cookie as an `X-CSRF-Token` header. The editor's default
 * `/api/media` endpoint is not CSRF-exempt, so the historical bare upload
 * POST was rejected with 403 "CSRF token missing" in the admin app. The
 * token is re-read immediately before each request because the proxy
 * re-issues the cookie whenever it no longer validates against the current
 * session (e.g. after re-login or session rotation).
 */

import { readCsrfToken } from '../../admin/utils/csrf.js';

/**
 * Derive alt text from a filename by stripping its extension. Falls back to
 * the whole name when there is no extension (`lastIndexOf` returns -1) or
 * the only dot is a leading dotfile marker (e.g. `.env`), where `dot > 0` is
 * false.
 */
export function deriveAltTextFromFilename(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/**
 * POST `body` to `uploadEndpoint`, echoing the CSRF cookie as `X-CSRF-Token`
 * when one is readable. `Content-Type` is never set here - `fetch` derives
 * the multipart boundary from the FormData body, and an explicit value would
 * break it. When no cookie is readable the request stays byte-identical to
 * the historical bare fetch (no `headers` key at all).
 */
export async function postMediaUpload(
  uploadEndpoint: string,
  body: FormData,
  signal: AbortSignal,
): Promise<Response> {
  const csrfToken = readCsrfToken();
  return fetch(uploadEndpoint, {
    method: 'POST',
    body,
    signal,
    ...(csrfToken ? { headers: { 'X-CSRF-Token': csrfToken } } : {}),
  });
}
