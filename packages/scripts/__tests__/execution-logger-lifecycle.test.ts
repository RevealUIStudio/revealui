import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  initialize: vi.fn(),
  close: vi.fn(),
  databases: [] as Array<{ close: ReturnType<typeof vi.fn> }>,
}));
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(async () => {}) }));
vi.mock('@electric-sql/pglite', () => ({
  PGlite: class {
    exec = state.initialize;
    query = vi.fn(async () => ({ rows: [] }));
    close = vi.fn(async () => state.close());
    constructor() {
      state.databases.push(this);
    }
  },
}));

function deferred() {
  let complete: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    complete = resolve;
  });
  return { promise, complete: () => complete?.() };
}

describe('Actual ExecutionLogger acquisition and release ownership', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    state.databases.length = 0;
    state.initialize.mockResolvedValue(undefined);
    state.close.mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('waits for initialization before publishing the singleton to concurrent borrowers', async () => {
    const { ExecutionLogger } = await import('../audit/execution-logger.js');
    const gate = deferred();
    state.initialize.mockReturnValueOnce(gate.promise);
    const first = ExecutionLogger.getInstance('/synthetic/root');
    await vi.waitFor(() => expect(state.initialize).toHaveBeenCalledOnce());
    let published = false;
    const second = ExecutionLogger.getInstance('/synthetic/root').then((logger) => {
      published = true;
      return logger;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(published).toBe(false);
    gate.complete();
    expect(await second).toBe(await first);
    await (await first).close();
  });

  it('closes partial initialization failure and permits a clean retry', async () => {
    const { ExecutionLogger } = await import('../audit/execution-logger.js');
    state.initialize.mockRejectedValueOnce(new Error('schema unavailable'));
    await expect(ExecutionLogger.getInstance('/synthetic/root')).rejects.toThrow(
      'schema unavailable',
    );
    expect(state.close).toHaveBeenCalledOnce();
    const ready = await ExecutionLogger.getInstance('/synthetic/root');
    expect(state.databases).toHaveLength(2);
    await ready.close();
  });

  it('reinitializes after rejection instead of returning a poisoned singleton', async () => {
    const { ExecutionLogger } = await import('../audit/execution-logger.js');
    state.initialize.mockRejectedValueOnce(new Error('schema unavailable'));
    await expect(ExecutionLogger.getInstance('/synthetic/root')).rejects.toThrow(
      'schema unavailable',
    );
    const ready = await ExecutionLogger.getInstance('/synthetic/root');
    expect(state.initialize).toHaveBeenCalledTimes(2);
    expect(state.databases).toHaveLength(2);
    await ready.close();
  });

  it('two simultaneous owned consumers share initialization and close independently', async () => {
    const { ExecutionLogger } = await import('../audit/execution-logger.js');
    const [first, second] = await Promise.all([
      ExecutionLogger.acquire('/synthetic/root'),
      ExecutionLogger.acquire('/synthetic/root'),
    ]);
    expect(first.logger).toBe(second.logger);
    expect(state.initialize).toHaveBeenCalledOnce();
    await first.release();
    expect(state.close).not.toHaveBeenCalled();
    await second.release();
    expect(state.close).toHaveBeenCalledOnce();
    await second.release();
    expect(state.close).toHaveBeenCalledOnce();
  });

  it('refuses borrowed close while an owned consumer is active', async () => {
    const { ExecutionLogger } = await import('../audit/execution-logger.js');
    const lease = await ExecutionLogger.acquire('/synthetic/root');
    await expect(lease.logger.close()).rejects.toThrow('owned');
    expect(state.close).not.toHaveBeenCalled();
    await lease.release();
  });

  it('serializes acquisition behind final close and prevents stale release from closing the new generation', async () => {
    const { ExecutionLogger } = await import('../audit/execution-logger.js');
    const old = await ExecutionLogger.acquire('/synthetic/root');
    const gate = deferred();
    state.close.mockReturnValueOnce(gate.promise);
    const closing = old.release();
    await vi.waitFor(() => expect(state.close).toHaveBeenCalledOnce());
    const acquiring = ExecutionLogger.acquire('/synthetic/root');
    await Promise.resolve();
    expect(state.databases).toHaveLength(1);
    gate.complete();
    await closing;
    const current = await acquiring;
    expect(current.logger).not.toBe(old.logger);
    await old.release();
    await old.logger.close();
    expect(state.close).toHaveBeenCalledOnce();
    await current.release();
    expect(state.close).toHaveBeenCalledTimes(2);
  });

  it('refuses explicit project-root mismatch but supports borrowing the current default root', async () => {
    const { ExecutionLogger } = await import('../audit/execution-logger.js');
    const lease = await ExecutionLogger.acquire('/synthetic/root');
    expect(await ExecutionLogger.getInstance()).toBe(lease.logger);
    await expect(ExecutionLogger.acquire('/synthetic/other')).rejects.toThrow('project root');
    expect(state.databases).toHaveLength(1);
    await lease.release();
  });

  it('quarantines failed-close storage instead of reopening over an uncertain live database', async () => {
    const { ExecutionLogger } = await import('../audit/execution-logger.js');
    const lease = await ExecutionLogger.acquire('/synthetic/root');
    state.close.mockRejectedValueOnce(new Error('close unavailable'));
    await expect(lease.release()).rejects.toThrow('close unavailable');
    await expect(ExecutionLogger.acquire('/synthetic/root')).rejects.toThrow('quarantined');
    expect(state.databases).toHaveLength(1);
  });

  it('releases an awaited query lease on success and query failure', async () => {
    const { withExecutionLogger } = await import('../audit/execution-logger.js');
    expect(await withExecutionLogger((logger) => logger.getHistory(), '/synthetic/root')).toEqual(
      [],
    );
    expect(state.close).toHaveBeenCalledOnce();
    await expect(
      withExecutionLogger(async () => {
        throw new Error('query failed');
      }, '/synthetic/root'),
    ).rejects.toThrow('query failed');
    expect(state.close).toHaveBeenCalledTimes(2);
  });

  it('preserves both a falsy query rejection and a release failure', async () => {
    const { withExecutionLogger } = await import('../audit/execution-logger.js');
    state.close.mockRejectedValueOnce(new Error('close failed'));
    const failure = await withExecutionLogger(async () => {
      throw 0;
    }, '/synthetic/root').catch((error) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.errors).toEqual([0, expect.objectContaining({ message: 'close failed' })]);
  });
});
