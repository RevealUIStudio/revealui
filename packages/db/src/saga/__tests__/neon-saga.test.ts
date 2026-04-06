import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeSaga } from '../neon-saga.js';
import type { SagaStep } from '../types.js';

// ---------------------------------------------------------------------------
// Mock helpers — chainable Drizzle query builders for saga operations
// ---------------------------------------------------------------------------

function createSelectChain(result: unknown[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function createInsertChain() {
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

function createUpdateChain() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

function createMockDb() {
  const selectChain = createSelectChain([]);
  const insertChain = createInsertChain();
  const updateChain = createUpdateChain();

  return {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    _selectChain: selectChain,
    _insertChain: insertChain,
    _updateChain: updateChain,
  };
}

type MockDb = ReturnType<typeof createMockDb>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('executeSaga', () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  it('completes successfully when all steps execute', async () => {
    const step1Execute = vi.fn().mockResolvedValue({ id: '1' });
    const step1Compensate = vi.fn();
    const step2Execute = vi.fn().mockResolvedValue({ id: '2' });
    const step2Compensate = vi.fn();

    const steps: SagaStep[] = [
      { name: 'step-1', execute: step1Execute, compensate: step1Compensate },
      { name: 'step-2', execute: step2Execute, compensate: step2Compensate },
    ];

    const result = await executeSaga(db as never, 'test-saga', 'key-1', steps);

    expect(result.status).toBe('completed');
    expect(result.completedSteps).toEqual(['step-1', 'step-2']);
    expect(result.result).toEqual({ id: '2' });
    expect(result.alreadyProcessed).toBe(false);
    expect(step1Execute).toHaveBeenCalledOnce();
    expect(step2Execute).toHaveBeenCalledOnce();
    expect(step1Compensate).not.toHaveBeenCalled();
    expect(step2Compensate).not.toHaveBeenCalled();
  });

  it('compensates completed steps when a step fails', async () => {
    const step1Execute = vi.fn().mockResolvedValue({ id: 'license-1' });
    const step1Compensate = vi.fn().mockResolvedValue(undefined);
    const step2Execute = vi.fn().mockRejectedValue(new Error('DB connection lost'));
    const step2Compensate = vi.fn().mockResolvedValue(undefined);

    const steps: SagaStep[] = [
      { name: 'insert-license', execute: step1Execute, compensate: step1Compensate },
      { name: 'sync-subscription', execute: step2Execute, compensate: step2Compensate },
    ];

    const result = await executeSaga(db as never, 'test-saga', 'key-2', steps);

    expect(result.status).toBe('compensated');
    expect(result.error).toBe('DB connection lost');
    expect(result.completedSteps).toEqual(['insert-license']);
    // Step 1 should be compensated with its output
    expect(step1Compensate).toHaveBeenCalledOnce();
    expect(step1Compensate.mock.calls[0][1]).toEqual({ id: 'license-1' });
    // Step 2 was never completed, so no compensation
    expect(step2Compensate).not.toHaveBeenCalled();
  });

  it('reports failed status when compensation itself fails', async () => {
    const step1Execute = vi.fn().mockResolvedValue({ id: '1' });
    const step1Compensate = vi.fn().mockRejectedValue(new Error('Compensation failed'));
    const step2Execute = vi.fn().mockRejectedValue(new Error('Step 2 failed'));
    const step2Compensate = vi.fn();

    const steps: SagaStep[] = [
      { name: 'step-1', execute: step1Execute, compensate: step1Compensate },
      { name: 'step-2', execute: step2Execute, compensate: step2Compensate },
    ];

    const result = await executeSaga(db as never, 'test-saga', 'key-3', steps);

    expect(result.status).toBe('failed');
    expect(result.error).toBe('Step 2 failed');
    expect(step1Compensate).toHaveBeenCalledOnce();
  });

  it('compensates in reverse order', async () => {
    const callOrder: string[] = [];

    const steps: SagaStep[] = [
      {
        name: 'step-a',
        execute: vi.fn().mockResolvedValue('a'),
        compensate: vi.fn().mockImplementation(async () => {
          callOrder.push('compensate-a');
        }),
      },
      {
        name: 'step-b',
        execute: vi.fn().mockResolvedValue('b'),
        compensate: vi.fn().mockImplementation(async () => {
          callOrder.push('compensate-b');
        }),
      },
      {
        name: 'step-c',
        execute: vi.fn().mockRejectedValue(new Error('fail')),
        compensate: vi.fn(),
      },
    ];

    await executeSaga(db as never, 'test-saga', 'key-4', steps);

    // step-b should be compensated before step-a (reverse order)
    expect(callOrder).toEqual(['compensate-b', 'compensate-a']);
  });

  it('skips execution when idempotency key exists', async () => {
    // Make the idempotency check return an existing key
    const selectChain = createSelectChain([
      { key: 'test-saga:key-5', expiresAt: new Date(Date.now() + 60_000) },
    ]);
    db.select.mockReturnValue(selectChain);

    const stepExecute = vi.fn();
    const steps: SagaStep[] = [{ name: 'step-1', execute: stepExecute, compensate: vi.fn() }];

    const result = await executeSaga(db as never, 'test-saga', 'key-5', steps);

    expect(result.status).toBe('skipped');
    expect(result.alreadyProcessed).toBe(true);
    expect(stepExecute).not.toHaveBeenCalled();
  });

  it('handles empty steps array', async () => {
    const result = await executeSaga(db as never, 'test-saga', 'key-6', []);

    expect(result.status).toBe('completed');
    expect(result.completedSteps).toEqual([]);
  });

  it('passes saga context to step execute functions', async () => {
    let capturedCtx: unknown;

    const steps: SagaStep[] = [
      {
        name: 'step-1',
        execute: vi.fn().mockImplementation(async (ctx) => {
          capturedCtx = ctx;
          return {};
        }),
        compensate: vi.fn(),
      },
    ];

    const result = await executeSaga(db as never, 'test-saga', 'key-7', steps);

    expect(result.status).toBe('completed');
    expect(capturedCtx).toHaveProperty('db');
    expect(capturedCtx).toHaveProperty('sagaId');
    expect(capturedCtx).toHaveProperty('checkpoint');
    expect(typeof (capturedCtx as Record<string, unknown>).checkpoint).toBe('function');
  });

  it('creates a job record as outbox entry', async () => {
    const steps: SagaStep[] = [
      { name: 'step-1', execute: vi.fn().mockResolvedValue({}), compensate: vi.fn() },
    ];

    await executeSaga(db as never, 'test-saga', 'key-8', steps);

    // db.insert should be called at least once for the job record
    expect(db.insert).toHaveBeenCalled();
  });

  it('handles non-Error throws gracefully', async () => {
    const steps: SagaStep[] = [
      {
        name: 'step-1',
        execute: vi.fn().mockRejectedValue('string error'),
        compensate: vi.fn(),
      },
    ];

    const result = await executeSaga(db as never, 'test-saga', 'key-9', steps);

    expect(result.status).toBe('compensated');
    expect(result.error).toBe('string error');
  });
});
