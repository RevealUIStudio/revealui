import { describe, expect, it, vi } from 'vitest';
import { resilientStep } from '../resilient-step.js';
import type { SagaContext, SagaStep } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockCtx(): SagaContext {
  return {
    db: {} as SagaContext['db'],
    sagaId: 'test-saga-1',
    checkpoint: vi.fn().mockResolvedValue(undefined),
  };
}

// Use tiny delays so tests run fast with real timers
const FAST_OPTS = { maxRetries: 3, baseDelay: 1, maxDelay: 5 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resilientStep', () => {
  it('passes through on first attempt success', async () => {
    const step: SagaStep = {
      name: 'my-step',
      execute: vi.fn().mockResolvedValue({ id: '1' }),
      compensate: vi.fn(),
    };

    const wrapped = resilientStep(step, FAST_OPTS);
    const ctx = createMockCtx();

    const result = await wrapped.execute(ctx);

    expect(result).toEqual({ id: '1' });
    expect(step.execute).toHaveBeenCalledOnce();
  });

  it('retries on transient failure and succeeds', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValue({ id: '1' });

    const step: SagaStep = {
      name: 'flaky-step',
      execute,
      compensate: vi.fn(),
    };

    const wrapped = resilientStep(step, FAST_OPTS);
    const ctx = createMockCtx();

    const result = await wrapped.execute(ctx);

    expect(result).toEqual({ id: '1' });
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting all retries', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('Permanent failure'));

    const step: SagaStep = {
      name: 'failing-step',
      execute,
      compensate: vi.fn(),
    };

    const wrapped = resilientStep(step, {
      maxRetries: 2,
      baseDelay: 1,
      maxDelay: 5,
    });

    const ctx = createMockCtx();

    await expect(wrapped.execute(ctx)).rejects.toThrow('Permanent failure');
    // 1 initial + 2 retries = 3 total
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it('preserves the original compensate function without wrapping', () => {
    const compensate = vi.fn().mockResolvedValue(undefined);

    const step: SagaStep = {
      name: 'step',
      execute: vi.fn().mockResolvedValue({}),
      compensate,
    };

    const wrapped = resilientStep(step, FAST_OPTS);

    expect(wrapped.compensate).toBe(compensate);
  });

  it('preserves the step name', () => {
    const step: SagaStep = {
      name: 'important-step',
      execute: vi.fn().mockResolvedValue({}),
      compensate: vi.fn(),
    };

    const wrapped = resilientStep(step, FAST_OPTS);

    expect(wrapped.name).toBe('important-step');
  });

  it('converts non-Error throws to Error objects', async () => {
    const execute = vi.fn().mockRejectedValue('string error');

    const step: SagaStep = {
      name: 'string-throw-step',
      execute,
      compensate: vi.fn(),
    };

    const wrapped = resilientStep(step, {
      maxRetries: 0,
      baseDelay: 1,
      maxDelay: 5,
    });

    const ctx = createMockCtx();

    await expect(wrapped.execute(ctx)).rejects.toThrow('string error');
  });

  it('passes context to the wrapped execute', async () => {
    let capturedCtx: SagaContext | undefined;

    const step: SagaStep = {
      name: 'ctx-step',
      execute: vi.fn().mockImplementation(async (ctx: SagaContext) => {
        capturedCtx = ctx;
        return {};
      }),
      compensate: vi.fn(),
    };

    const wrapped = resilientStep(step, FAST_OPTS);
    const ctx = createMockCtx();

    await wrapped.execute(ctx);

    expect(capturedCtx).toBe(ctx);
  });

  it('retries only once when second attempt succeeds', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('Transient'))
      .mockResolvedValue({ ok: true });

    const step: SagaStep = {
      name: 'once-retry-step',
      execute,
      compensate: vi.fn(),
    };

    const wrapped = resilientStep(step, FAST_OPTS);
    const ctx = createMockCtx();

    const result = await wrapped.execute(ctx);

    expect(result).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
