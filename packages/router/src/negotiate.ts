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
