/**
 * Request layer composition (Phase 2.3.4).
 * Order: domain-lock → CSRF origin → next (session API / renderRequest).
 * Auth for protected *actions* remains router.useAction (not Router.match).
 */

import { csrfOriginResponse } from './csrf-origin.ts';
import { domainLockResponse } from './domain-lock.ts';
import { withSecurityHeaders } from './security.ts';

/**
 * Wrap the RSC fetch handler with perimeter middleware.
 */
export function withRequestLayer(
  inner: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return (request: Request) =>
    withSecurityHeaders(request, async () => {
      const locked = domainLockResponse(request);
      if (locked) return locked;

      const csrf = csrfOriginResponse(request);
      if (csrf) return csrf;

      return inner(request);
    });
}

export { csrfOriginResponse } from './csrf-origin.ts';
export { domainLockResponse } from './domain-lock.ts';
export { rscPocSecurityConfig, withSecurityHeaders } from './security.ts';
