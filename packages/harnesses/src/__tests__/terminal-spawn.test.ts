/**
 * Terminal spawn backend selection: config, rejection, US allowlist, ClaudeCode opt-in.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HarnessRegistry } from '../registry/harness-registry.js';
import { SIGNED_PRODUCT_SNAP_IDS } from '../server/inference-run-policy.js';
import {
  DEFAULT_GROQ_TERMINAL_MODEL,
  DEFAULT_TERMINAL_SPAWN_BACKEND,
  DEFAULT_TERMINAL_SPAWN_MODEL,
  isTerminalSpawnModelAllowed,
  resolveTerminalSpawn,
  TerminalSpawnBackendError,
} from '../session/terminal-spawn.js';
import type { HarnessAdapter } from '../types/adapter.js';
import type { HarnessCapabilities, HarnessInfo } from '../types/core.js';

const here = dirname(fileURLToPath(import.meta.url));

function stubAdapter(id: string): HarnessAdapter {
  const capabilities: HarnessCapabilities = {
    generateCode: false,
    analyzeCode: false,
    applyEdit: false,
    applyConfig: false,
    readWorkboard: false,
    writeWorkboard: false,
  };
  return {
    id,
    name: id,
    getCapabilities: () => capabilities,
    getInfo: async (): Promise<HarnessInfo> => ({ id, name: id, capabilities }),
    isAvailable: async () => true,
    execute: async () => ({ success: true, command: 'get-status' }),
    onEvent: () => () => {},
    dispose: async () => {},
  };
}

function expectCode(run: () => void, code: string): void {
  try {
    run();
    throw new Error(`expected ${code}`);
  } catch (err) {
    expect(err).toBeInstanceOf(TerminalSpawnBackendError);
    if (!(err instanceof TerminalSpawnBackendError)) throw err;
    expect(err.code).toBe(code);
  }
}

describe('resolveTerminalSpawn', () => {
  it('selects the backend and model from config', () => {
    const selection = resolveTerminalSpawn({
      env: {
        TERMINAL_AGENT_BACKEND: 'Ollama',
        TERMINAL_AGENT_MODEL: 'gemma4:e2b',
        LLM_PROVIDER: 'anthropic',
        LLM_MODEL: 'claude-sonnet-4-6',
      },
    });
    expect(selection.backend).toBe('Ollama');
    expect(selection.model).toBe('gemma4:e2b');
    expect(selection.adapterId).toBeNull();
  });

  it('uses the provider chain when terminal config is unset', () => {
    expect(resolveTerminalSpawn({ env: { GROQ_API_KEY: 'gsk_test' } }).backend).toBe('Groq');
    expect(
      resolveTerminalSpawn({
        env: { GROQ_API_KEY: 'gsk_test', OLLAMA_BASE_URL: 'http://127.0.0.1:11434' },
      }).backend,
    ).toBe('Groq');
    expect(
      resolveTerminalSpawn({
        env: {
          INFERENCE_SNAPS_BASE_URL: 'http://127.0.0.1:9090/v1',
          GROQ_API_KEY: 'gsk_test',
        },
      }).backend,
    ).toBe('InferenceSnaps');
    const ollama = resolveTerminalSpawn({
      env: { OLLAMA_BASE_URL: 'http://127.0.0.1:11434' },
    });
    expect(ollama.backend).toBe('Ollama');
    expect(ollama.model).toBe(DEFAULT_TERMINAL_SPAWN_MODEL);
  });

  it('rejects a missing backend', () => {
    expectCode(() => resolveTerminalSpawn({ backend: '   ', env: {} }), 'missing-backend');
    expectCode(
      () => resolveTerminalSpawn({ env: { TERMINAL_AGENT_BACKEND: '' } }),
      'missing-backend',
    );
    expectCode(() => resolveTerminalSpawn({ backend: null, env: {} }), 'missing-backend');
  });

  it('rejects an unknown backend', () => {
    expectCode(() => resolveTerminalSpawn({ backend: 'NotAVendor', env: {} }), 'unknown-backend');
    expectCode(() => resolveTerminalSpawn({ env: { LLM_PROVIDER: 'openai' } }), 'unknown-backend');
  });

  it('rejects an unwired revdev backend instead of falling back', () => {
    expectCode(() => resolveTerminalSpawn({ backend: 'revdev', env: {} }), 'unknown-backend');
  });

  it('rejects a backend whose adapter is missing from the registry', () => {
    const registry = new HarnessRegistry();
    expectCode(() => resolveTerminalSpawn({ env: {} }, registry), 'missing-backend');
    registry.register(stubAdapter('revealui-agent'));
    expect(resolveTerminalSpawn({ env: {} }, registry).backend).toBe('InferenceSnaps');
  });

  it('defaults to the US-allowlisted inference snap model', () => {
    const selection = resolveTerminalSpawn({ env: {} });
    expect(selection.backend).toBe(DEFAULT_TERMINAL_SPAWN_BACKEND);
    expect(selection.backend).toBe('InferenceSnaps');
    expect(selection.model).toBe(DEFAULT_TERMINAL_SPAWN_MODEL);
    expect(selection.model).toBe('gemma3');
    expect(selection.adapterId).toBe('revealui-agent');
    expect(isTerminalSpawnModelAllowed(selection.backend, selection.model)).toBe(true);
    expect((SIGNED_PRODUCT_SNAP_IDS as readonly string[]).includes(selection.model)).toBe(true);
  });

  it('does not select ClaudeCode when only ANTHROPIC_API_KEY is set', () => {
    const selection = resolveTerminalSpawn({
      env: { ANTHROPIC_API_KEY: 'sk-ant-test' },
    });
    expect(selection.backend).toBe('InferenceSnaps');
    expect(selection.model).toBe('gemma3');
  });

  it('enforces the allowlist on the default model path', () => {
    expect(isTerminalSpawnModelAllowed('InferenceSnaps', 'openrouter/free')).toBe(false);
    expect(isTerminalSpawnModelAllowed('Ollama', 'qwen2.5:3b')).toBe(false);
    expect(isTerminalSpawnModelAllowed('Groq', 'qwen/qwen3-32b')).toBe(false);
    expect(isTerminalSpawnModelAllowed('InferenceSnaps', 'deepseek-r1')).toBe(false);
    expect(isTerminalSpawnModelAllowed('Groq', DEFAULT_GROQ_TERMINAL_MODEL)).toBe(true);
    expect(isTerminalSpawnModelAllowed('Ollama', 'gemma4:e2b')).toBe(true);

    for (const model of ['openrouter/free', 'qwen2.5:3b', 'deepseek-r1', 'glm-4-7-flash']) {
      expectCode(
        () => resolveTerminalSpawn({ env: { LLM_MODEL: model } }),
        'model-not-allowlisted',
      );
    }
    expectCode(
      () =>
        resolveTerminalSpawn({
          env: { OLLAMA_BASE_URL: 'http://127.0.0.1:11434', LLM_MODEL: 'phi4-mini' },
        }),
      'model-not-allowlisted',
    );
  });

  it('uses ClaudeCode when that backend is explicitly selected', () => {
    const registry = new HarnessRegistry();
    registry.register(stubAdapter('claude-code'));
    const selection = resolveTerminalSpawn(
      {
        backend: 'ClaudeCode',
        model: 'claude-sonnet-4-6',
        env: {},
      },
      registry,
    );
    expect(selection.backend).toBe('ClaudeCode');
    expect(selection.model).toBe('claude-sonnet-4-6');
    expect(selection.adapterId).toBe('claude-code');

    const fromProvider = resolveTerminalSpawn({
      env: { LLM_PROVIDER: 'anthropic', LLM_MODEL: 'claude-sonnet-4-6' },
    });
    expect(fromProvider.backend).toBe('ClaudeCode');
    expect(fromProvider.model).toBe('claude-sonnet-4-6');
  });

  it('requires an explicit model for ClaudeCode and still refuses openrouter/free', () => {
    expectCode(() => resolveTerminalSpawn({ backend: 'claude-code', env: {} }), 'missing-model');
    expectCode(
      () =>
        resolveTerminalSpawn({
          backend: 'ClaudeCode',
          model: 'openrouter/free',
          env: {},
        }),
      'model-not-allowlisted',
    );
  });

  it('locksteps the default snap and groq models with the in-repo catalogs', () => {
    const snaps = readFileSync(
      join(here, '../../../ai/src/llm/providers/us-origin-snaps.ts'),
      'utf8',
    );
    expect(snaps).toContain(
      `export const DEFAULT_US_ORIGIN_INFERENCE_SNAP: UsOriginInferenceSnapId = '${DEFAULT_TERMINAL_SPAWN_MODEL}'`,
    );
    for (const id of SIGNED_PRODUCT_SNAP_IDS) {
      expect(snaps).toContain(`id: '${id}'`);
    }
    const route = readFileSync(join(here, '../../../ai/src/llm/inference-route.ts'), 'utf8');
    expect(route).toContain(`export const GROQ_DEFAULT_MODEL = '${DEFAULT_GROQ_TERMINAL_MODEL}'`);
  });
});
