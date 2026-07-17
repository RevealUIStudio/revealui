/**
 * GAP-360 PR-1 — provider-surface widening for the env + client factories.
 *
 * Covers: createProvider branches for anthropic/openai, the huggingface factory
 * fix (previously threw 'Unknown provider type'), createLLMClientFromEnv
 * auto-detect priority (existing env combos must resolve identically), explicit
 * LLM_PROVIDER selection, and the hostedViable classification.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Silence the real boot-warning logger (console.warn) — the once-only warning is
// asserted separately in env-factory-warning.test.ts with a fresh module.
vi.mock('@revealui/core/observability/logger', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  createLLMClientFromEnv,
  hostedViable,
  isHostedViable,
  LLMClient,
  type LLMProviderType,
} from '../client.js';

const PROVIDER_ENV_KEYS = [
  'LLM_PROVIDER',
  'INFERENCE_SNAPS_BASE_URL',
  'GROQ_API_KEY',
  'GROQ_BASE_URL',
  'OLLAMA_BASE_URL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_BASE_URL',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'XAI_API_KEY',
  'XAI_BASE_URL',
  'HF_TOKEN',
  'HF_MODEL_URL',
  'LLM_MODEL',
  'LLM_TEMPERATURE',
  'LLM_MAX_TOKENS',
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

/** The provider a constructed client is wired to (via the circuit-breaker name). */
function providerOf(client: LLMClient): string {
  return client.getCircuitBreakerStats().primary.name.replace('llm-', '');
}

describe('createProvider — new factory branches', () => {
  it('constructs an anthropic provider without throwing', () => {
    const client = new LLMClient({ provider: 'anthropic', apiKey: 'sk-ant-test' });
    expect(providerOf(client)).toBe('anthropic');
  });

  it('constructs an openai provider without throwing', () => {
    const client = new LLMClient({ provider: 'openai', apiKey: 'sk-test' });
    expect(providerOf(client)).toBe('openai');
  });

  it('constructs a huggingface provider without throwing (regression: was Unknown provider type)', () => {
    // Before the fix, createProvider had no 'huggingface' case and threw
    // 'Unknown provider type: huggingface' inside the LLMClient constructor.
    expect(
      () =>
        new LLMClient({
          provider: 'huggingface',
          apiKey: 'hf_test',
          baseURL: 'http://hf.local/v1',
        }),
    ).not.toThrow();
  });

  it('constructs an xai provider without throwing', () => {
    const client = new LLMClient({ provider: 'xai', apiKey: 'xai-test' });
    expect(providerOf(client)).toBe('xai');
  });
});

describe('createLLMClientFromEnv — explicit LLM_PROVIDER', () => {
  it('resolves anthropic from LLM_PROVIDER + ANTHROPIC_API_KEY', () => {
    process.env.LLM_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(providerOf(createLLMClientFromEnv())).toBe('anthropic');
  });

  it('resolves openai from LLM_PROVIDER + OPENAI_API_KEY', () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(providerOf(createLLMClientFromEnv())).toBe('openai');
  });

  it('throws a keyless error for anthropic without ANTHROPIC_API_KEY', () => {
    process.env.LLM_PROVIDER = 'anthropic';
    expect(() => createLLMClientFromEnv()).toThrow('ANTHROPIC_API_KEY');
  });

  it('resolves xai from LLM_PROVIDER + XAI_API_KEY', () => {
    process.env.LLM_PROVIDER = 'xai';
    process.env.XAI_API_KEY = 'xai-test';
    expect(providerOf(createLLMClientFromEnv())).toBe('xai');
  });

  it('throws a keyless error for xai without XAI_API_KEY', () => {
    process.env.LLM_PROVIDER = 'xai';
    expect(() => createLLMClientFromEnv()).toThrow('XAI_API_KEY');
  });
});

describe('createLLMClientFromEnv — auto-detect priority order (unchanged for existing deployments)', () => {
  it('INFERENCE_SNAPS wins over GROQ', () => {
    process.env.INFERENCE_SNAPS_BASE_URL = 'http://localhost:9090/v1';
    process.env.GROQ_API_KEY = 'gsk_test';
    expect(providerOf(createLLMClientFromEnv())).toBe('inference-snaps');
  });

  it('GROQ resolves when only GROQ_API_KEY is set', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    expect(providerOf(createLLMClientFromEnv())).toBe('groq');
  });

  it('OLLAMA resolves when only OLLAMA_BASE_URL is set', () => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    expect(providerOf(createLLMClientFromEnv())).toBe('ollama');
  });

  it('GROQ still wins over a newly-added ANTHROPIC_API_KEY (priority unchanged)', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(providerOf(createLLMClientFromEnv())).toBe('groq');
  });
});

describe('createLLMClientFromEnv — auto-detect for new providers (appended after existing checks)', () => {
  it('ANTHROPIC_API_KEY alone resolves to anthropic', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(providerOf(createLLMClientFromEnv())).toBe('anthropic');
  });

  it('OPENAI_API_KEY alone resolves to openai', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(providerOf(createLLMClientFromEnv())).toBe('openai');
  });

  it('ANTHROPIC wins over OPENAI when both are set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.OPENAI_API_KEY = 'sk-test';
    expect(providerOf(createLLMClientFromEnv())).toBe('anthropic');
  });

  it('XAI_API_KEY alone resolves to xai', () => {
    process.env.XAI_API_KEY = 'xai-test';
    expect(providerOf(createLLMClientFromEnv())).toBe('xai');
  });

  it('OPENAI still wins over a newly-added XAI_API_KEY (priority unchanged)', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.XAI_API_KEY = 'xai-test';
    expect(providerOf(createLLMClientFromEnv())).toBe('openai');
  });

  it('falls back to the inference-snaps localhost default with no provider env', () => {
    expect(providerOf(createLLMClientFromEnv())).toBe('inference-snaps');
  });
});

describe('hostedViable classification', () => {
  it('marks cloud providers viable and localhost-only providers not viable', () => {
    expect(hostedViable).toEqual({
      anthropic: true,
      openai: true,
      groq: true,
      huggingface: true,
      ollama: false,
      'inference-snaps': false,
      xai: true,
    });
  });

  it('isHostedViable agrees with the map for every provider', () => {
    const providers: LLMProviderType[] = [
      'anthropic',
      'openai',
      'groq',
      'huggingface',
      'ollama',
      'inference-snaps',
      'xai',
    ];
    for (const p of providers) {
      expect(isHostedViable(p)).toBe(hostedViable[p]);
    }
  });
});
