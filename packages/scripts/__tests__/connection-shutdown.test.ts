import { beforeEach, describe, expect, it, vi } from 'vitest';

const poolMock = vi.hoisted(() => {
  class FakeClient {
    private readonly endListeners = new Set<() => void>();

    once(event: string, listener: () => void): this {
      if (event === 'end') this.endListeners.add(listener);
      return this;
    }

    finishEnd(): void {
      for (const listener of this.endListeners) listener();
      this.endListeners.clear();
    }
  }

  class FakePool {
    static instance: FakePool | undefined;
    private connectListener: ((client: FakeClient) => void) | undefined;
    readonly client = new FakeClient();
    endStarted = false;

    constructor() {
      FakePool.instance = this;
    }

    on(event: string, listener: (client: FakeClient) => void): this {
      if (event === 'connect') this.connectListener = listener;
      return this;
    }

    async connect(): Promise<FakeClient> {
      this.connectListener?.(this.client);
      return this.client;
    }

    async end(): Promise<void> {
      this.endStarted = true;
    }
  }

  return { FakePool };
});

vi.mock('pg', () => ({ Pool: poolMock.FakePool }));

const { createConnection } = await import('../database/connection.js');

describe('database connection shutdown', () => {
  beforeEach(() => {
    poolMock.FakePool.instance = undefined;
  });

  it('waits for connected clients to finish closing after the pool ends', async () => {
    const connection = await createConnection({
      connectionString: 'postgresql://test:test@localhost:5432/revealui_test',
      ssl: false,
    });
    await connection.connect();

    const pool = poolMock.FakePool.instance;
    expect(pool).toBeDefined();
    if (!pool) throw new Error('Expected the connection factory to create a pool');

    let closeResolved = false;
    const closing = connection.close().then(() => {
      closeResolved = true;
    });
    await Promise.resolve();

    expect(pool.endStarted).toBe(true);
    expect(closeResolved).toBe(false);

    pool.client.finishEnd();
    await closing;

    expect(closeResolved).toBe(true);
  });
});
