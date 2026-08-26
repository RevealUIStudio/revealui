/**
 * Dead SKUs must not exist as objects in modules the public marketing app
 * imports. Filtering at render is not enough — live JS still leaked
 * Agency Perpetual and Fleet deployment $25,000.
 */
import { describe, expect, it } from 'vitest';
import * as pageBlocks from '../../lib/page-blocks';
import * as forOperators from '../for-operators';
import * as pricing from '../pricing';

const DEAD_SKU_MARKERS = ['Agency Perpetual', 'Fleet deployment', '$25,000'] as const;

function moduleBlob(value: unknown): string {
  return JSON.stringify(value);
}

describe('public marketing catalog modules — no leftover SKU objects', () => {
  it('does not re-export the full PERPETUAL_TIERS array', () => {
    expect(Object.hasOwn(pricing, 'PERPETUAL_TIERS')).toBe(false);
  });

  it('ships only Pro Perpetual in the public perpetual catalog', () => {
    expect(pricing.PUBLIC_PERPETUAL_TIERS.map((tier) => tier.name)).toEqual(['Pro Perpetual']);
  });

  it('does not contain Agency Perpetual or Fleet $25,000 objects', () => {
    const text = [pricing, forOperators, pageBlocks].map(moduleBlob).join('\n');
    for (const marker of DEAD_SKU_MARKERS) {
      expect(text.includes(marker), `leftover catalog object still ships: ${marker}`).toBe(false);
    }
  });
});
