/**
 * US-origin Inference Snap allowlist — fail-closed hardline.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LLMClient } from '../../client.js';
import { InferenceSnapsProvider } from '../inference-snaps.js';
import {
  assertUsOriginInferenceSnap,
  DEFAULT_US_ORIGIN_INFERENCE_SNAP,
  isNonUsModelsEscapeEnabled,
  isUsOriginInferenceSnap,
  NON_US_MODELS_ESCAPE_ENV,
  NonUsOriginInferenceSnapError,
  US_ORIGIN_INFERENCE_SNAP_IDS,
} from '../us-origin-snaps.js';

const TEST_URL = 'http://localhost:9999/v1';

const savedEscape = process.env[NON_US_MODELS_ESCAPE_ENV];

beforeEach(() => {
  delete process.env[NON_US_MODELS_ESCAPE_ENV];
});

afterEach(() => {
  if (savedEscape === undefined) {
    delete process.env[NON_US_MODELS_ESCAPE_ENV];
  } else {
    process.env[NON_US_MODELS_ESCAPE_ENV] = savedEscape;
  }
});

describe('isUsOriginInferenceSnap', () => {
  it.each([...US_ORIGIN_INFERENCE_SNAP_IDS])('allows %s', (id) => {
    expect(isUsOriginInferenceSnap(id)).toBe(true);
  });

  it('is case-insensitive and trims', () => {
    expect(isUsOriginInferenceSnap('  Gemma4  ')).toBe(true);
  });

  it.each(['deepseek-r1', 'qwen-vl', 'qwen3', 'qwen3-coder', 'qwen3-6', 'glm-4-7-flash'])(
    'rejects %s',
    (id) => {
      expect(isUsOriginInferenceSnap(id)).toBe(false);
    },
  );

  it('allows Canonical engine model ids under an allowlisted snap prefix', () => {
    expect(isUsOriginInferenceSnap('nemotron-3-nano-30b-a3b-q4-k-m')).toBe(true);
    expect(isUsOriginInferenceSnap('nemotron-3-nano-omni-vision')).toBe(true);
    expect(isUsOriginInferenceSnap('gemma4:it')).toBe(true);
  });

  it('does not treat unrelated prefixes as allowlisted snaps', () => {
    // Must not match by loose substring (e.g. "nano" alone)
    expect(isUsOriginInferenceSnap('not-nemotron-3-nano')).toBe(false);
    expect(isUsOriginInferenceSnap('deepseek-r1-nemotron-3-nano')).toBe(false);
  });
});

describe('assertUsOriginInferenceSnap', () => {
  it('defaults to gemma3 when model is omitted', () => {
    expect(DEFAULT_US_ORIGIN_INFERENCE_SNAP).toBe('gemma3');
    expect(assertUsOriginInferenceSnap(undefined)).toBe(DEFAULT_US_ORIGIN_INFERENCE_SNAP);
    expect(assertUsOriginInferenceSnap('')).toBe(DEFAULT_US_ORIGIN_INFERENCE_SNAP);
  });

  it('returns allowlisted models unchanged (trimmed)', () => {
    expect(assertUsOriginInferenceSnap(' gemma4 ')).toBe('gemma4');
  });

  it('throws NonUsOriginInferenceSnapError for PRC snaps', () => {
    expect(() => assertUsOriginInferenceSnap('deepseek-r1')).toThrow(NonUsOriginInferenceSnapError);
    expect(() => assertUsOriginInferenceSnap('qwen3-coder')).toThrow(/US-origin allowlist/);
  });

  it('allows non-US when allowNonUs is true', () => {
    expect(assertUsOriginInferenceSnap('deepseek-r1', { allowNonUs: true })).toBe('deepseek-r1');
  });

  it('allows non-US when REVEALUI_ALLOW_NON_US_MODELS=1', () => {
    process.env[NON_US_MODELS_ESCAPE_ENV] = '1';
    expect(isNonUsModelsEscapeEnabled()).toBe(true);
    expect(assertUsOriginInferenceSnap('qwen-vl')).toBe('qwen-vl');
  });

  it('allows non-US when REVEALUI_ALLOW_NON_US_MODELS=true', () => {
    process.env[NON_US_MODELS_ESCAPE_ENV] = 'true';
    expect(assertUsOriginInferenceSnap('glm-4-7-flash')).toBe('glm-4-7-flash');
  });
});

describe('InferenceSnapsProvider construction', () => {
  it('constructs with default US-origin model', () => {
    expect(() => new InferenceSnapsProvider({ baseURL: TEST_URL })).not.toThrow();
  });

  it('constructs with each allowlisted model', () => {
    for (const model of US_ORIGIN_INFERENCE_SNAP_IDS) {
      expect(() => new InferenceSnapsProvider({ baseURL: TEST_URL, model })).not.toThrow();
    }
  });

  it('rejects deepseek-r1 at construction', () => {
    expect(() => new InferenceSnapsProvider({ baseURL: TEST_URL, model: 'deepseek-r1' })).toThrow(
      NonUsOriginInferenceSnapError,
    );
  });

  it('rejects non-US embedModel even when chat model is allowlisted', () => {
    expect(
      () =>
        new InferenceSnapsProvider({
          baseURL: TEST_URL,
          model: 'gemma3',
          embedModel: 'qwen-vl',
        }),
    ).toThrow(/qwen-vl/);
  });

  it('constructs non-US model when allowNonUsModels is set', () => {
    expect(
      () =>
        new InferenceSnapsProvider({
          baseURL: TEST_URL,
          model: 'deepseek-r1',
          allowNonUsModels: true,
        }),
    ).not.toThrow();
  });
});

describe('LLMClient + createProvider path', () => {
  it('rejects non-US model via LLMClient inference-snaps branch', () => {
    expect(
      () =>
        new LLMClient({
          provider: 'inference-snaps',
          apiKey: 'inference-snaps',
          baseURL: TEST_URL,
          model: 'deepseek-r1',
        }),
    ).toThrow(NonUsOriginInferenceSnapError);
  });

  it('accepts default US-origin model via LLMClient', () => {
    expect(
      () =>
        new LLMClient({
          provider: 'inference-snaps',
          apiKey: 'inference-snaps',
          baseURL: TEST_URL,
        }),
    ).not.toThrow();
  });
});
