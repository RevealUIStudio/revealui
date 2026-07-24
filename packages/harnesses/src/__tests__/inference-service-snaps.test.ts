/**
 * Product Inference Snap catalog must stay on the US-origin allowlist.
 */
import { PRODUCT_INFERENCE_SNAP_CATALOG, US_ORIGIN_INFERENCE_SNAP_IDS } from '@revealui/ai';
import { describe, expect, it } from 'vitest';
import { PRODUCT_INFERENCE_SNAPS } from '../server/inference-service.js';

const FORBIDDEN = ['deepseek-r1', 'qwen-vl', 'qwen3', 'qwen3-coder', 'glm-4-7-flash'];

describe('PRODUCT_INFERENCE_SNAPS', () => {
  it('is derived from @revealui/ai PRODUCT_INFERENCE_SNAP_CATALOG', () => {
    expect(PRODUCT_INFERENCE_SNAPS.map(([n]) => n)).toEqual(
      PRODUCT_INFERENCE_SNAP_CATALOG.map((e) => e.id),
    );
    expect(PRODUCT_INFERENCE_SNAPS.map(([n]) => n)).toEqual([...US_ORIGIN_INFERENCE_SNAP_IDS]);
  });

  it('does not offer PRC-origin catalog snaps for install', () => {
    const names = PRODUCT_INFERENCE_SNAPS.map(([name]) => name);
    for (const banned of FORBIDDEN) {
      expect(names).not.toContain(banned);
    }
  });

  it('defaults product id remains nemotron-3-nano first (install UX order)', () => {
    expect(PRODUCT_INFERENCE_SNAPS[0]?.[0]).toBe('nemotron-3-nano');
  });
});
