/**
 * GAP-360 PR-1 §5.3 — the zero-config localhost-default boot warning.
 *
 * The docstring at client.ts promised a one-line stderr warning when the
 * zero-config inference-snaps localhost default is selected, but nothing emitted
 * it. This asserts it now fires — exactly once per process (module-level guard),
 * only on the zero-config path.
 *
 * Isolated in its own file so the module-level once-guard starts fresh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { warnSpy } = vi.hoisted(() => ({ warnSpy: vi.fn() }));

vi.mock('@revealui/core/observability/logger', () => ({
  createLogger: () => ({
    warn: warnSpy,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { createLLMClientFromEnv } from '../client.js';

const PROVIDER_ENV_KEYS = [
  'LLM_PROVIDER',
  'INFERENCE_SNAPS_BASE_URL',
  'GROQ_API_KEY',
  'OLLAMA_BASE_URL',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
] as const;

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of PROVIDER_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of PROVIDER_ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

describe('zero-config localhost default warning', () => {
  it('emits exactly once across repeated zero-config factory calls', () => {
    createLLMClientFromEnv();
    createLLMClientFromEnv();
    createLLMClientFromEnv();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('inference-snaps');
  });
});
