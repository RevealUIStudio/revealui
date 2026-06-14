/**
 * Guards the wildcard-CORS allowlist for public, CDN-cacheable, credential-free
 * endpoints (see the CORS middleware in index.ts). These paths must receive
 * `Access-Control-Allow-Origin: *` rather than per-origin credentialed CORS,
 * because coupling `Cache-Control: public` with per-origin credentialed CORS
 * lets the CDN serve a variant cached for one origin (or none) to a browser
 * with a different origin — surfacing as a "No Access-Control-Allow-Origin"
 * error. Regression context: the 2026-06-14 Gate-5 billing page CORS failure.
 */

import { describe, expect, it } from 'vitest';
import { isPublicCacheableCorsPath } from '../index.js';

describe('isPublicCacheableCorsPath', () => {
  it('marks /api/pricing as a public cacheable (wildcard-CORS) path', () => {
    expect(isPublicCacheableCorsPath('/api/pricing')).toBe(true);
  });

  it('does NOT mark credentialed/private routes as public cacheable', () => {
    // These must keep per-origin credentialed CORS — never wildcard.
    expect(isPublicCacheableCorsPath('/api/billing/subscription')).toBe(false);
    expect(isPublicCacheableCorsPath('/api/billing/checkout')).toBe(false);
    expect(isPublicCacheableCorsPath('/api/auth/session')).toBe(false);
    expect(isPublicCacheableCorsPath('/api/webhooks/stripe')).toBe(false);
  });

  it('is an exact match — no prefix/substring leakage', () => {
    expect(isPublicCacheableCorsPath('/api/pricing/secret')).toBe(false);
    expect(isPublicCacheableCorsPath('/api/pricinger')).toBe(false);
    expect(isPublicCacheableCorsPath('/pricing')).toBe(false);
    expect(isPublicCacheableCorsPath('')).toBe(false);
  });
});
