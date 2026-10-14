/**
 * GAP-360 PR-1 — provider-surface widening for the env + client factories.
 *
 * Covers: createProvider branches for anthropic/openai, the huggingface factory
 * fix (previously threw 'Unknown provider type'), createLLMClientFromEnv
 * auto-detect priority (existing env combos must resolve identically), explicit
 * LLM_PROVIDER selection, and the hostedViable classification.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
  defaultBaseURLForProvider,
  defaultModelForProvider,
  hostedViable,
  isHostedViable,
  LLMClient,
  type LLMProviderType,
  resolveModelForProvider,
} from '../client.js';

// The supported profile storage boundary keeps provider tests independent of host profiles.
const fixtureDir = mkdtempSync(join(tmpdir(), 'llm-factory-'));
const fixtureProfilePath = join(fixtureDir, 'inference-profile.json');
afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }));

let factoryEnv: NodeJS.ProcessEnv;
beforeEach(() => {
  factoryEnv = {};
});

/** The provider a constructed client is wired to (via the circuit-breaker name). */
function providerOf(client: LLMClient): string {
  return client.getCircuitBreakerStats().primary.name.replace('llm-', '');
}

function inspectRoute(client: LLMClient): {
  provider: string;
  model?: string;
  baseURL?: string;
} {
  return (client as unknown as { config: { provider: string; model?: string; baseURL?: string } })
    .config;
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
    factoryEnv.LLM_PROVIDER = 'anthropic';
    factoryEnv.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('anthropic');
  });

  it('resolves openai from LLM_PROVIDER + OPENAI_API_KEY', () => {
    factoryEnv.LLM_PROVIDER = 'openai';
    factoryEnv.OPENAI_API_KEY = 'sk-test';
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('openai');
  });

  it('throws a keyless error for anthropic without ANTHROPIC_API_KEY', () => {
    factoryEnv.LLM_PROVIDER = 'anthropic';
    expect(() =>
      createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv }),
    ).toThrow('ANTHROPIC_API_KEY');
  });

  it('resolves xai from LLM_PROVIDER + XAI_API_KEY', () => {
    factoryEnv.LLM_PROVIDER = 'xai';
    factoryEnv.XAI_API_KEY = 'xai-test';
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('xai');
  });

  it('throws a keyless error for xai without XAI_API_KEY', () => {
    factoryEnv.LLM_PROVIDER = 'xai';
    expect(() =>
      createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv }),
    ).toThrow('XAI_API_KEY');
  });
});

describe('createLLMClientFromEnv — auto-detect priority order (unchanged for existing deployments)', () => {
  it('INFERENCE_SNAPS wins over GROQ', () => {
    factoryEnv.INFERENCE_SNAPS_BASE_URL = 'http://localhost:9090/v1';
    factoryEnv.GROQ_API_KEY = 'gsk_test';
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('inference-snaps');
  });

  it('GROQ resolves when only GROQ_API_KEY is set', () => {
    factoryEnv.GROQ_API_KEY = 'gsk_test';
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('groq');
  });

  it('GROQ uses the Groq catalog model and Groq base URL', () => {
    factoryEnv.GROQ_API_KEY = 'gsk_test';
    const client = createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv });
    const route = inspectRoute(client);
    expect(route.provider).toBe('groq');
    expect(route.model).toBe('openai/gpt-oss-120b');
    expect(route.baseURL).toBe('https://api.groq.com/openai/v1');
  });

  it('OLLAMA resolves when only OLLAMA_BASE_URL is set', () => {
    factoryEnv.OLLAMA_BASE_URL = 'http://localhost:11434';
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('ollama');
  });

  it('GROQ still wins over a newly-added ANTHROPIC_API_KEY (priority unchanged)', () => {
    factoryEnv.GROQ_API_KEY = 'gsk_test';
    factoryEnv.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('groq');
  });
});

describe('createLLMClientFromEnv — auto-detect for new providers (appended after existing checks)', () => {
  it('ANTHROPIC_API_KEY alone resolves to anthropic', () => {
    factoryEnv.ANTHROPIC_API_KEY = 'sk-ant-test';
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('anthropic');
  });

  it('OPENAI_API_KEY alone resolves to openai', () => {
    factoryEnv.OPENAI_API_KEY = 'sk-test';
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('openai');
  });

  it('does not send a Groq catalog LLM_MODEL to OpenAI', () => {
    factoryEnv.OPENAI_API_KEY = 'sk-test';
    factoryEnv.LLM_MODEL = 'llama-3.3-70b-versatile';
    const route = inspectRoute(
      createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv }),
    );
    expect(route.provider).toBe('openai');
    expect(route.model).toBe('gpt-4o');
    expect(route.baseURL).toBe('https://api.openai.com/v1');
  });

  it('keeps LLM_MODEL when it belongs to the selected Groq provider', () => {
    factoryEnv.GROQ_API_KEY = 'gsk_test';
    factoryEnv.LLM_MODEL = 'openai/gpt-oss-20b';
    const route = inspectRoute(
      createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv }),
    );
    expect(route.provider).toBe('groq');
    expect(route.model).toBe('openai/gpt-oss-20b');
    expect(route.baseURL).toBe('https://api.groq.com/openai/v1');
  });

  it('ANTHROPIC wins over OPENAI when both are set', () => {
    factoryEnv.ANTHROPIC_API_KEY = 'sk-ant-test';
    factoryEnv.OPENAI_API_KEY = 'sk-test';
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('anthropic');
  });

  it('XAI_API_KEY alone resolves to xai', () => {
    factoryEnv.XAI_API_KEY = 'xai-test';
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('xai');
  });

  it('OPENAI still wins over a newly-added XAI_API_KEY (priority unchanged)', () => {
    factoryEnv.OPENAI_API_KEY = 'sk-test';
    factoryEnv.XAI_API_KEY = 'xai-test';
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('openai');
  });

  it('falls back to the inference-snaps localhost default with no provider env', () => {
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('inference-snaps');
  });

  it('rejects non-US LLM_MODEL for inference-snaps (US-origin hardline)', () => {
    factoryEnv.LLM_PROVIDER = 'inference-snaps';
    factoryEnv.LLM_MODEL = 'deepseek-r1';
    expect(() =>
      createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv }),
    ).toThrow(/US-origin allowlist/);
  });

  it('accepts allowlisted LLM_MODEL for inference-snaps', () => {
    factoryEnv.LLM_PROVIDER = 'inference-snaps';
    factoryEnv.LLM_MODEL = 'gemma4';
    expect(
      providerOf(createLLMClientFromEnv({ profilePath: fixtureProfilePath, env: factoryEnv })),
    ).toBe('inference-snaps');
  });
});

describe('resolveModelForProvider — never send a Groq id to OpenAI', () => {
  it('maps a Groq catalog id on OpenAI to the OpenAI default', () => {
    expect(resolveModelForProvider('openai', 'llama-3.3-70b-versatile')).toBe(
      defaultModelForProvider('openai'),
    );
  });

  it('maps a retired Groq catalog id on Groq to the current Groq default', () => {
    expect(resolveModelForProvider('groq', 'llama-3.3-70b-versatile')).toBe(
      defaultModelForProvider('groq'),
    );
  });

  it('defaults Groq base URL to the Groq OpenAI-compatible host', () => {
    expect(defaultBaseURLForProvider('groq')).toBe('https://api.groq.com/openai/v1');
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
