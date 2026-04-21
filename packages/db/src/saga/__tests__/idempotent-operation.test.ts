import { beforeEach, describe, expect, it, vi } from 'vitest';
import { idempotentWrite } from '../idempotent-operation.js';

// ---------------------------------------------------------------------------
// Mock helpers
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
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

function createDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDb() {
  return {
    select: vi.fn().mockReturnValue(createSelectChain([])),
    insert: vi.fn().mockReturnValue(createInsertChain()),
    delete: vi.fn().mockReturnValue(createDeleteChain()),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('idempotentWrite', () => {
  let db: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
  });

  it('executes operation when key does not exist', async () => {
    const operation = vi.fn().mockResolvedValue({ sent: true });

    const result = await idempotentWrite(db as never, 'send-email:user-1', 'email', operation);

    expect(result.alreadyProcessed).toBe(false);
    expect(result.result).toEqual({ sent: true });
    expect(operation).toHaveBeenCalledOnce();
  });

  it('skips operation when key already exists and not expired', async () => {
    // Return an existing key with future expiry
    const selectChain = createSelectChain([
      {
        key: 'send-email:user-1',
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);
    db.select.mockReturnValue(selectChain);

    const operation = vi.fn().mockResolvedValue({ sent: true });

    const result = await idempotentWrite(db as never, 'send-email:user-1', 'email', operation);

    expect(result.alreadyProcessed).toBe(true);
    expect(result.result).toBeUndefined();
    expect(operation).not.toHaveBeenCalled();
  });

  it('returns the cached result on replay when cacheResult was set originally', async () => {
    // Replay: existing row has a stored result jsonb (because original
    // call passed cacheResult: true and the operation returned an
    // object). New behavior: idempotentWrite surfaces that cached value
    // in `result` instead of leaving it undefined.
    const selectChain = createSelectChain([
      {
        key: 'agent.dispatch.llm:job-42',
        expiresAt: new Date(Date.now() + 60_000),
        result: { success: true, output: 'memoized response', tokensUsed: 1234 },
      },
    ]);
    db.select.mockReturnValue(selectChain);

    const operation = vi.fn().mockResolvedValue({ should: 'never run' });

    const result = await idempotentWrite(
      db as never,
      'agent.dispatch.llm:job-42',
      'agent-dispatch-llm',
      operation,
      { cacheResult: true },
    );

    expect(result.alreadyProcessed).toBe(true);
    expect(result.result).toEqual({
      success: true,
      output: 'memoized response',
      tokensUsed: 1234,
    });
    expect(operation).not.toHaveBeenCalled();
  });

  it('executes operation when key exists but is expired', async () => {
    // Return an existing key with past expiry
    const selectChain = createSelectChain([
      {
        key: 'send-email:user-1',
        expiresAt: new Date(Date.now() - 60_000),
      },
    ]);
    db.select.mockReturnValue(selectChain);

    const operation = vi.fn().mockResolvedValue({ sent: true });

    const result = await idempotentWrite(db as never, 'send-email:user-1', 'email', operation);

    expect(result.alreadyProcessed).toBe(false);
    expect(result.result).toEqual({ sent: true });
    expect(operation).toHaveBeenCalledOnce();
    // Should have deleted the expired key
    expect(db.delete).toHaveBeenCalled();
  });

  it('records idempotency key after successful operation', async () => {
    const operation = vi.fn().mockResolvedValue({ done: true });

    await idempotentWrite(db as never, 'op:key-1', 'saga', operation);

    // Should insert the idempotency key
    expect(db.insert).toHaveBeenCalled();
  });

  it('propagates operation errors', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('DB write failed'));

    await expect(idempotentWrite(db as never, 'op:key-2', 'saga', operation)).rejects.toThrow(
      'DB write failed',
    );
  });

  it('treats null expiresAt as non-expired', async () => {
    const selectChain = createSelectChain([
      {
        key: 'op:key-3',
        expiresAt: null,
      },
    ]);
    db.select.mockReturnValue(selectChain);

    const operation = vi.fn();

    const result = await idempotentWrite(db as never, 'op:key-3', 'saga', operation);

    expect(result.alreadyProcessed).toBe(true);
    expect(operation).not.toHaveBeenCalled();
  });
});
