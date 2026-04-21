import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock ../client/index.js so markCompleted/markFailedOrRetry use controlled
// chainable Drizzle stubs.
vi.mock('../client/index.js', () => {
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };
  const db = {
    update: vi.fn(() => updateChain),
    select: vi.fn(() => selectChain),
  };
  return {
    getClient: vi.fn(() => db),
    getRestPool: vi.fn(() => null),
    __db: db,
    __updateChain: updateChain,
    __selectChain: selectChain,
  };
});

const clientMod = await import('../client/index.js');
const updateChain = (
  clientMod as unknown as {
    __updateChain: {
      set: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
    };
  }
).__updateChain;
const selectChain = (
  clientMod as unknown as {
    __selectChain: {
      limit: ReturnType<typeof vi.fn>;
    };
  }
).__selectChain;

const { DeadlineExceededError, deadlineSignal, markCompleted, markFailedOrRetry } = await import(
  './claim.js'
);

describe('deadlineSignal', () => {
  it('rejects with DeadlineExceededError after the given ms', async () => {
    await expect(deadlineSignal(5)).rejects.toBeInstanceOf(DeadlineExceededError);
  });
});

describe('markCompleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets state=completed, output, and clears lock fields', async () => {
    await markCompleted('job-1', { result: 42 });

    expect(updateChain.set).toHaveBeenCalledTimes(1);
    const call = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.state).toBe('completed');
    expect(call.output).toEqual({ result: 42 });
    expect(call.lockedBy).toBeNull();
    expect(call.lockedUntil).toBeNull();
    expect(call.completedAt).toBeInstanceOf(Date);
  });

  it('writes output=null when handler returned nothing', async () => {
    await markCompleted('job-1', null);
    const call = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.output).toBeNull();
  });
});

describe('markFailedOrRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Deterministic jitter: Math.random() => 0 => multiplier = 0.8.
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("schedules a retry with state='created' and future start_after when retries remain", async () => {
    selectChain.limit.mockResolvedValueOnce([{ retryCount: 0, retryLimit: 3 }]);
    const now = 1_000_000_000_000;
    const err = new Error('handler exploded');

    const decision = await markFailedOrRetry('job-retry', err, now);

    expect(decision.kind).toBe('retry');
    expect(decision.retryCount).toBe(1);
    expect(decision.error).toBe('handler exploded');
    // Backoff = 10_000 * 1^2 * 0.8 = 8_000 ms at Math.random() = 0.
    expect(decision.nextAttemptAt).toBe(now + 8_000);

    const call = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.state).toBe('created');
    expect(call.retryCount).toBe(1);
    expect(call.lastError).toBe('handler exploded');
    expect((call.startAfter as Date).getTime()).toBe(now + 8_000);
    expect(call.lockedBy).toBeNull();
    expect(call.lockedUntil).toBeNull();
  });

  it('marks failed when retry count would equal retry limit', async () => {
    selectChain.limit.mockResolvedValueOnce([{ retryCount: 2, retryLimit: 3 }]);
    const err = new Error('final straw');

    const decision = await markFailedOrRetry('job-dlq', err);

    expect(decision.kind).toBe('failed');
    expect(decision.retryCount).toBe(3);
    expect(decision.error).toBe('final straw');

    const call = updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.state).toBe('failed');
    expect(call.retryCount).toBe(3);
    expect(call.lastError).toBe('final straw');
    expect(call.completedAt).toBeInstanceOf(Date);
    expect(call.lockedBy).toBeNull();
    expect(call.lockedUntil).toBeNull();
  });

  it('handles vanished rows as a terminal failure without mutating', async () => {
    selectChain.limit.mockResolvedValueOnce([]);
    const err = new Error('whatever');

    const decision = await markFailedOrRetry('gone', err);

    expect(decision).toEqual({ kind: 'failed', retryCount: 0, error: 'whatever' });
    // The UPDATE path should NOT have been exercised for a vanished row.
    expect(updateChain.set).not.toHaveBeenCalled();
  });

  it('coerces non-Error throws into their string form', async () => {
    selectChain.limit.mockResolvedValueOnce([{ retryCount: 0, retryLimit: 1 }]);
    const decision = await markFailedOrRetry('job-nonerr', 'plain string');
    expect(decision.kind).toBe('failed');
    expect(decision.error).toBe('plain string');
  });
});
