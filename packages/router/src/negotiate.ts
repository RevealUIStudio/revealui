import type { RouterRscOptions } from './types';

/** Wire content type for RSC flight payloads (ADR D1 / D2). */
export const RSC_CONTENT_TYPE = 'text/x-component';

/** Accept token that selects the RSC representation. */
export const RSC_ACCEPT = 'text/x-component';

export type Representation = 'html' | 'rsc';

/**
 * True when the request asks for an RSC flight payload via content negotiation.
 * Uses standard `Accept` (not Next's custom `RSC: 1` header) per ADR D1.
 */
export function wantsRscPayload(request: Request): boolean {
  const accept = request.headers.get('accept') ?? '';
  // Substring match is intentional: Accept can list multiple types with q-values.
  return accept.includes(RSC_ACCEPT);
}

/**
 * If `endpoint` is configured (CDN Vary escape hatch), strip that prefix so
 * routing sees the resource path. Example: endpoint `/.rsc` + path `/.rsc/posts/1`
 * → pathname `/posts/1`, forceRsc true.
 */
export function resolveRscEndpointPath(
  pathname: string,
  endpoint?: string,
): { pathname: string; forceRsc: boolean } {
  if (!endpoint) {
    return { pathname, forceRsc: false };
  }
  const prefix = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
  if (pathname === prefix) {
    return { pathname: '/', forceRsc: true };
  }
  if (pathname.startsWith(`${prefix}/`)) {
    const rest = pathname.slice(prefix.length);
    return { pathname: rest.startsWith('/') ? rest : `/${rest}`, forceRsc: true };
  }
  return { pathname, forceRsc: false };
}

/**
 * Decide HTML vs RSC representation for a request in RSC mode (ADR D1).
 * - Endpoint path → always RSC
 * - Else `Accept: text/x-component` → RSC
 * - Else HTML
 */
export function negotiateRepresentation(request: Request, rsc?: RouterRscOptions): Representation {
  const url = new URL(request.url);
  const { forceRsc } = resolveRscEndpointPath(url.pathname, rsc?.endpoint);
  if (forceRsc) return 'rsc';
  if (wantsRscPayload(request)) return 'rsc';
  return 'html';
}

/**
 * Pathname used for route matching after endpoint stripping.
 */
export function routingPathname(request: Request, rsc?: RouterRscOptions): string {
  const url = new URL(request.url);
  return resolveRscEndpointPath(url.pathname, rsc?.endpoint).pathname;
}

/**
 * Absolute URL the browser should request for an RSC soft navigation (2.2.3).
 * Default: same resource path (content negotiation via `Accept`).
 * With `endpoint`: prefix the path so the server forces RSC representation.
 */
export function resolveRscClientUrl(
  pathname: string,
  search = '',
  rsc?: RouterRscOptions,
  origin?: string,
): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const q = search && !search.startsWith('?') ? `?${search}` : search;
  if (!rsc?.endpoint) {
    return `${base}${path}${q}`;
  }
  const prefix = rsc.endpoint.endsWith('/') ? rsc.endpoint.slice(0, -1) : rsc.endpoint;
  const prefixed = path === '/' ? prefix : `${prefix}${path}`;
  return `${base}${prefixed}${q}`;
}
