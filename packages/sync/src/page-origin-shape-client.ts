import { fetchWithTimeout } from './fetch-with-timeout.js';

/** Electric initial-sync cursor. Never send a blank `offset`. */
export const ELECTRIC_INITIAL_OFFSET = '-1';

function pageOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Absolute same-origin Electric shape URL.
 *
 * `@electric-sql/client` constructs `new URL(url)` with no base. A relative
 * `/api/shapes/...` path (blank `proxyBaseUrl` after SSR memoization) throws
 * `TypeError: Failed to construct URL` before any shape GET is issued.
 */
export function resolvePageOriginShapeUrl(proxyBaseUrl: string, pathname: string): string {
  const trimmed = proxyBaseUrl.trim();
  const base = isAbsoluteHttpUrl(trimmed) ? trimmed : pageOrigin();
  return new URL(pathname, base).href;
}

function requestHref(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function toAbsoluteUrl(href: string): URL {
  try {
    return new URL(href);
  } catch {
    return new URL(href, pageOrigin());
  }
}

/**
 * Fetch wrapper for Electric `useShape`. Resolves a relative request against
 * the page origin and replaces a missing or blank `offset` with `-1`. A real
 * log offset from Electric is left intact.
 */
export function fetchPageOriginShape(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = toAbsoluteUrl(requestHref(input));
  const offset = url.searchParams.get('offset');
  if (offset === null || offset.length === 0) {
    url.searchParams.set('offset', ELECTRIC_INITIAL_OFFSET);
  }
  return fetchWithTimeout(url, init);
}
