import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { forkProvider } from '../fork-provider.js';
import type { SandboxRunOptions } from '../types.js';

const TEST_RUNNERS = fileURLToPath(new URL('../__test-runners__/', import.meta.url));
const PROD_RUNNER = fileURLToPath(new URL('../revmarket-task-runner.mjs', import.meta.url));

function baseOpts(overrides: Partial<SandboxRunOptions> = {}): SandboxRunOptions {
  const controller = new AbortController();
  return {
    taskId: `test-task-${Math.random().toString(36).slice(2, 10)}`,
    agentId: 'test-agent',
    skillName: 'echo',
    input: { hello: 'world' },
    signal: controller.signal,
    maxMemoryMb: 128,
    maxExecMs: 30_000,
    ...overrides,
  };
}

describe('forkProvider — happy path with the production runner', () => {
  it('runs the bundled stub runner and returns the structured result', async () => {
    const provider = forkProvider({ runnerPath: PROD_RUNNER });
    const opts = baseOpts({ skillName: 'happy-skill' });
    const result = await provider.run(opts);

    expect(result.success).toBe(true);
    expect(result.output).toMatchObject({
      taskId: opts.taskId,
      skillName: 'happy-skill',
      status: 'executed',
    });
    expect(result.artifacts).toEqual([]);
    expect(result.tokensUsed).toBe(0);
    expect(result.error).toBeUndefined();
  }, 30_000);

  it('reports the correct provider tag and name', () => {
    const provider = forkProvider();
    expect(provider.tag).toBe('fork');
    expect(provider.name).toBe('fork');
  });
});

describe('forkProvider — environment isolation', () => {
  const SECRETS_TO_LEAK = {
    REVEALUI_KEK: 'a'.repeat(64),
    STRIPE_SECRET_KEY: 'sk_test_should_not_leak',
    REVEALUI_SECRET: 'session-signing-secret-should-not-leak',
    POSTGRES_URL: 'postgresql://leak/leak',
  };

  beforeEach(() => {
    for (const [k, v] of Object.entries(SECRETS_TO_LEAK)) {
      process.env[k] = v;
    }
  });

  afterEach(() => {
    for (const k of Object.keys(SECRETS_TO_LEAK)) {
      delete process.env[k];
    }
  });

  it('strips parent env to a safe minimum — no REVEALUI / STRIPE / POSTGRES leakage', async () => {
    const provider = forkProvider({ runnerPath: `${TEST_RUNNERS}env-echo.mjs` });
    const opts = baseOpts();
    const result = await provider.run(opts);

    expect(result.success).toBe(true);
    const env = (result.output as { env: Record<string, string> }).env;

    // What MUST be set for the runner to function.
    expect(env.REVMARKET_SANDBOX).toBe('1');
    expect(env.REVMARKET_TASK_ID).toBe(opts.taskId);
    expect(env.PATH).toBeDefined();

    // What MUST NOT leak — every secret-shaped parent var.
    for (const k of Object.keys(SECRETS_TO_LEAK)) {
      expect(env[k]).toBeUndefined();
    }
  }, 30_000);
});

describe('forkProvider — memory cap enforcement', () => {
  it('kills the fork when allocations exceed --max-old-space-size', async () => {
    const provider = forkProvider({ runnerPath: `${TEST_RUNNERS}memory-bomb.mjs` });
    const result = await provider.run(baseOpts({ maxMemoryMb: 64, maxExecMs: 30_000 }));

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    // The exit may surface as either "Sandbox crashed (exit=N)" (V8 OOM
    // produces a non-zero exit) or as a successfully-caught error from
    // inside the bomb. Either way the result must be a failure.
    expect(result.output).toBeNull();
  }, 30_000);
});

describe('forkProvider — timeout escalation', () => {
  it('SIGTERMs then SIGKILLs an infinite-loop runner via the abort signal', async () => {
    const provider = forkProvider({
      runnerPath: `${TEST_RUNNERS}infinite-loop.mjs`,
      killGraceMs: 500,
    });

    const controller = new AbortController();
    // Mirror what the executor does: fire abort after maxExecMs.
    setTimeout(() => controller.abort(), 500);

    const start = Date.now();
    const result = await provider.run(baseOpts({ signal: controller.signal, maxExecMs: 500 }));
    const elapsed = Date.now() - start;

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/killed|signal/i);
    // Must finish well within ~5s (500ms abort + 500ms grace + slack).
    expect(elapsed).toBeLessThan(5_000);
  }, 30_000);
});

describe('forkProvider — silent exit handling', () => {
  it('surfaces a failure when the runner exits 0 without sending a result', async () => {
    const provider = forkProvider({ runnerPath: `${TEST_RUNNERS}silent-exit.mjs` });
    const result = await provider.run(baseOpts());

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/without producing a result|exited/i);
  }, 30_000);
});

describe('forkProvider — provider-misconfiguration', () => {
  it('returns a structured failure when the runner path does not exist', async () => {
    const provider = forkProvider({ runnerPath: '/nonexistent/path/runner.mjs' });
    const result = await provider.run(baseOpts());

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  }, 30_000);
});
