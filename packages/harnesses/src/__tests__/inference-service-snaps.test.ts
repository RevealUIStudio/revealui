/**
 * Product Inference Snap catalog must stay on the US-origin allowlist.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRODUCT_INFERENCE_SNAPS } from '../server/inference-service.js';

const US_ORIGIN_IDS = ['nemotron-3-nano', 'nemotron-3-nano-omni', 'gemma3', 'gemma4'] as const;
const FORBIDDEN = ['deepseek-r1', 'qwen-vl', 'qwen3', 'qwen3-coder', 'glm-4-7-flash'];

describe('PRODUCT_INFERENCE_SNAPS', () => {
  it('lists only US-origin snap ids', () => {
    const names = PRODUCT_INFERENCE_SNAPS.map(([name]) => name);
    expect(names).toHaveLength(US_ORIGIN_IDS.length);
    for (const id of US_ORIGIN_IDS) {
      expect(names).toContain(id);
    }
  });

  it('does not offer PRC-origin catalog snaps for install', () => {
    const names = PRODUCT_INFERENCE_SNAPS.map(([name]) => name);
    for (const banned of FORBIDDEN) {
      expect(names).not.toContain(banned);
    }
  });

  it('defaults product id remains gemma3 first', () => {
    expect(PRODUCT_INFERENCE_SNAPS[0]?.[0]).toBe('gemma3');
  });

  it('lockstep with @revealui/ai PRODUCT_INFERENCE_SNAP_CATALOG ids', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const sot = join(here, '../../../ai/src/llm/providers/us-origin-snaps.ts');
    const source = readFileSync(sot, 'utf8');
    for (const id of PRODUCT_INFERENCE_SNAPS.map(([name]) => name)) {
      expect(source).toContain(`id: '${id}'`);
    }
  });
});
