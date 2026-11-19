/**
 * Hosted processes must not construct a deployment env model client.
 * Forge and self-host keep the env factory.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { generateEmbedding } from '../../embeddings/index.js';
import { createLLMClientFromEnv, HostedEnvModelKeyRefusedError } from '../client.js';

const KEYS = [
  'REVEALUI_DEPLOYMENT_MODE',
  'REVEALUI_LICENSE_PRIVATE_KEY',
  'LLM_PROVIDER',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GROQ_API_KEY',
  'XAI_API_KEY',
  'HF_TOKEN',
  'OLLAMA_BASE_URL',
  'INFERENCE_SNAPS_BASE_URL',
  'HOSTED_BYOK_DISPATCH',
] as const;

const saved: Record<string, string | undefined> = {};

function isolateEnv(): void {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
}

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('createLLMClientFromEnv on hosted', () => {
  it('refuses when REVEALUI_DEPLOYMENT_MODE=hosted even if a provider key is set', () => {
    isolateEnv();
    process.env.REVEALUI_DEPLOYMENT_MODE = 'hosted';
    process.env.OPENAI_API_KEY = 'present';
    process.env.LLM_PROVIDER = 'openai';

    expect(() => createLLMClientFromEnv()).toThrow(HostedEnvModelKeyRefusedError);
    expect(() => createLLMClientFromEnv()).toThrow(/deployment environment model key/);
  });

  it('refuses when hosted is detected from the license private key and MODE is unset', () => {
    isolateEnv();
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'present';
    process.env.ANTHROPIC_API_KEY = 'present';

    expect(() => createLLMClientFromEnv()).toThrow(HostedEnvModelKeyRefusedError);
  });

  it('refuses when HOSTED_BYOK_DISPATCH=false on hosted', () => {
    isolateEnv();
    process.env.REVEALUI_DEPLOYMENT_MODE = 'hosted';
    process.env.HOSTED_BYOK_DISPATCH = 'false';
    process.env.GROQ_API_KEY = 'present';

    expect(() => createLLMClientFromEnv()).toThrow(HostedEnvModelKeyRefusedError);
  });

  it('still builds an env client on forge, including when a private key is also set', () => {
    isolateEnv();
    process.env.REVEALUI_DEPLOYMENT_MODE = 'forge';
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'present';
    process.env.LLM_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'sk-test';

    const client = createLLMClientFromEnv();
    expect(client.getCircuitBreakerStats().primary.name).toBe('llm-openai');
  });
});

describe('generateEmbedding env fallback', () => {
  it('refuses the env fallback on hosted when the caller does not pass a client', async () => {
    isolateEnv();
    process.env.REVEALUI_DEPLOYMENT_MODE = 'hosted';
    process.env.OPENAI_API_KEY = 'present';

    await expect(generateEmbedding('hello')).rejects.toBeInstanceOf(HostedEnvModelKeyRefusedError);
  });

  it('uses the caller client on hosted and does not read an env key', async () => {
    isolateEnv();
    process.env.REVEALUI_DEPLOYMENT_MODE = 'hosted';
    process.env.OPENAI_API_KEY = 'present';
    const client = {
      embed: vi.fn(async () => ({ vector: [1, 2], model: 'acct', dimension: 2 })),
    };

    const embedding = await generateEmbedding('hello', { client });

    expect(client.embed).toHaveBeenCalledOnce();
    expect(embedding.vector).toEqual([1, 2]);
  });
});
