/**
 * Local Ollama chat allowlist: US open-weight families, fail closed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { createLLMClientFromEnv, LLMClient } from '../../client.js';
import { OllamaProvider } from '../ollama.js';
import {
  DEFAULT_DAILY_OLLAMA_MODEL,
  resolveApprovedLocalModel,
  UnapprovedLocalModelError,
} from '../us-origin-snaps.js';

const ENV_KEYS = [
  'LLM_PROVIDER',
  'LLM_MODEL',
  'OLLAMA_BASE_URL',
  'INFERENCE_SNAPS_BASE_URL',
  'GROQ_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'XAI_API_KEY',
  'HF_TOKEN',
  'REVEALUI_SKIP_INFERENCE_PROFILE',
] as const;

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.env.REVEALUI_SKIP_INFERENCE_PROFILE = '1';
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
});

function clientModel(client: LLMClient): string | undefined {
  return (client as unknown as { config: { model?: string } }).config.model;
}

describe('resolveApprovedLocalModel', () => {
  it('defaults to the approved local tag', () => {
    expect(DEFAULT_DAILY_OLLAMA_MODEL).toBe('gemma4:e2b');
    expect(resolveApprovedLocalModel(undefined)).toBe('gemma4:e2b');
    expect(resolveApprovedLocalModel('')).toBe('gemma4:e2b');
    expect(resolveApprovedLocalModel('   ')).toBe('gemma4:e2b');
  });

  it('passes an approved LLM_MODEL', () => {
    expect(resolveApprovedLocalModel('gemma4:e4b')).toBe('gemma4:e4b');
    expect(resolveApprovedLocalModel('  gemma4:e2b  ')).toBe('gemma4:e2b');
    expect(resolveApprovedLocalModel('phi4-mini')).toBe('phi4-mini');
    expect(resolveApprovedLocalModel('gpt-oss:20b')).toBe('gpt-oss:20b');
  });

  it('refuses an unlisted id', () => {
    expect(() => resolveApprovedLocalModel('unlisted-model:1b')).toThrow(UnapprovedLocalModelError);
    try {
      resolveApprovedLocalModel('unlisted-model:1b');
      throw new Error('expected refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(UnapprovedLocalModelError);
      const message = err instanceof Error ? err.message : '';
      expect(message).toContain('unlisted-model:1b');
      expect(message).toContain('allowlist');
    }
  });
});

describe('Ollama local path', () => {
  it('constructs with the approved default', () => {
    expect(() => new OllamaProvider({})).not.toThrow();
    expect(() => new OllamaProvider({ model: 'gemma4:e4b' })).not.toThrow();
  });

  it('refuses an unlisted model at construction', () => {
    expect(() => new OllamaProvider({ model: 'unlisted-model:1b' })).toThrow(
      UnapprovedLocalModelError,
    );
  });

  it('createLLMClientFromEnv defaults Ollama to the approved tag', () => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    const client = createLLMClientFromEnv();
    expect(clientModel(client)).toBe('gemma4:e2b');
  });

  it('createLLMClientFromEnv keeps an approved LLM_MODEL', () => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    process.env.LLM_MODEL = 'gemma4:e4b';
    const client = createLLMClientFromEnv();
    expect(clientModel(client)).toBe('gemma4:e4b');
  });

  it('createLLMClientFromEnv refuses an unlisted LLM_MODEL', () => {
    process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    process.env.LLM_MODEL = 'unlisted-model:1b';
    expect(() => createLLMClientFromEnv()).toThrow(UnapprovedLocalModelError);
  });

  it('LLMClient ollama branch refuses an unlisted model', () => {
    expect(
      () =>
        new LLMClient({
          provider: 'ollama',
          apiKey: 'ollama',
          baseURL: 'http://localhost:11434/v1',
          model: 'unlisted-model:1b',
        }),
    ).toThrow(UnapprovedLocalModelError);
  });
});
