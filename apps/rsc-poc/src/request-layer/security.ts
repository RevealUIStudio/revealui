/**
 * Secure headers for rsc-poc (2.3.4).
 * Extends `@revealui/security` — no parallel header builder.
 *
 * CSP allows 'unsafe-inline' scripts for dual-mode RSC payload + bootstrap
 * (inline in HTML shell). HSTS omitted: dogfood often runs on http://localhost.
 */

import { createSecurityMiddleware, type SecurityHeadersConfig } from '@revealui/security';

/** Dogfood-tuned moderate headers (no HSTS on local HTTP). */
export const rscPocSecurityConfig: SecurityHeadersConfig = {
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  },
  xFrameOptions: 'DENY',
  xContentTypeOptions: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin',
};

/**
 * Fetch middleware: CORS preflight + security headers on the response.
 * CORS left unset (same-origin dogfood); headers still apply.
 */
export const withSecurityHeaders = createSecurityMiddleware(rscPocSecurityConfig);
