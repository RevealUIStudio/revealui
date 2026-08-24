/**
 * Strict docs.revealui.com URL parsing. Do not use startsWith on the origin —
 * that matches https://docs.revealui.com.evil.com (CodeQL js/incomplete-url-substring-sanitization).
 */

const DOCS_PROTOCOL = 'https:';
const DOCS_HOSTNAME = 'docs.revealui.com';

export function docsPathnameFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== DOCS_PROTOCOL || parsed.hostname !== DOCS_HOSTNAME) {
    return null;
  }
  let rest = parsed.pathname;
  if (rest === '') {
    return '/';
  }
  if (rest.length > 1 && rest.endsWith('/')) {
    rest = rest.slice(0, -1);
  }
  return rest;
}

export function isDocsSiteUrl(url: string): boolean {
  return docsPathnameFromUrl(url) !== null;
}
