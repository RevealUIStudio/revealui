import { describe, expect, it } from 'vitest';
import {
  COMMON_EXON,
  SHARED_DETECTION_RULES,
  STRIPE_LIVE_EXON,
} from '../doc-currency-shared-rules.js';

describe('SHARED_DETECTION_RULES', () => {
  it('carries the 8 fleet-fact rule ids in canonical order', () => {
    expect(SHARED_DETECTION_RULES.map((r) => r.id)).toEqual([
      'revealcoin-as-current',
      'railway-as-current',
      'vercel-blob-as-current',
      'supabase-as-current',
      'stripe-not-live-claim',
      'forge-tier-name',
      'max-price-stale',
      'retired-suite-path',
    ]);
  });

  it('every rule has at least one anyOf term and a non-empty unlessLineHas list', () => {
    for (const rule of SHARED_DETECTION_RULES) {
      expect(rule.anyOf.length).toBeGreaterThan(0);
      expect(rule.unlessLineHas.length).toBeGreaterThan(0);
    }
  });

  it('retired-suite-path carries only the username-free ~/suite/ form (public-issue-redaction carve-out)', () => {
    const rule = SHARED_DETECTION_RULES.find((r) => r.id === 'retired-suite-path');
    expect(rule?.anyOf).toEqual(['~/suite/']);
  });

  it('a term present as current is a candidate hit and absent-exoneration line is not exonerated', () => {
    const rule = SHARED_DETECTION_RULES.find((r) => r.id === 'railway-as-current');
    expect(rule).toBeDefined();
    const line = 'deploy the service to railway';
    const isHit = rule!.anyOf.some((t) => line.includes(t));
    const isExonerated = rule!.unlessLineHas.some((t) => line.includes(t));
    expect(isHit).toBe(true);
    expect(isExonerated).toBe(false);
  });

  it('exonerates Railway marketplace / buyer self-host sales-channel prose (GAP-430)', () => {
    const rule = SHARED_DETECTION_RULES.find((r) => r.id === 'railway-as-current');
    expect(rule).toBeDefined();
    const line =
      'one-click self-host on the buyer railway marketplace account (deployment/railway template)';
    const isHit = rule!.anyOf.some((t) => line.includes(t));
    const isExonerated = rule!.unlessLineHas.some((t) => line.includes(t));
    expect(isHit).toBe(true);
    expect(isExonerated).toBe(true);
  });
});

describe('COMMON_EXON / STRIPE_LIVE_EXON', () => {
  it('are non-empty exoneration marker sets', () => {
    expect(COMMON_EXON.length).toBeGreaterThan(0);
    expect(STRIPE_LIVE_EXON.length).toBeGreaterThan(0);
  });
});
