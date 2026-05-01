import { describe, expect, it, vi } from 'vitest';
import { createProvenanceLogger } from '../provenance-logger.js';
import type { ClientIdentity } from '../room-manager.js';

function createMockDb() {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

function createIdentity(overrides?: Partial<ClientIdentity>): ClientIdentity {
  return {
    type: 'human',
    id: 'test-client',
    name: 'Test User',
    color: '#E06C75',
    ...overrides,
  };
}

function createUpdate(size = 10): Uint8Array {
  return new Uint8Array(size).fill(1);
}

// Historical: this file used to test the buffered flush-every-5s / flush-
// at-50 behavior. That buffer was removed in the direct-write refactor
// because in-memory buffering is a crash-loss window and the queue is
// the wrong primitive for per-edit durability. These tests now encode
// the direct-write contract.

describe('createProvenanceLogger (direct-write)', () => {
  it('exposes logEdit, flush, destroy', () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);
    expect(typeof logger.logEdit).toBe('function');
    expect(typeof logger.flush).toBe('function');
    expect(typeof logger.destroy).toBe('function');
  });

  it('inserts immediately on logEdit (no buffer)', () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);

    logger.logEdit('doc1', createIdentity(), createUpdate());

    expect(db.insert).toHaveBeenCalledTimes(1);
    const valuesCall = db.insert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith([
      expect.objectContaining({
        documentId: 'doc1',
        clientType: 'human',
        clientId: 'test-client',
        clientName: 'Test User',
      }),
    ]);
  });

  it('issues one insert per logEdit (no batching)', () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);
    const identity = createIdentity();

    logger.logEdit('doc1', identity, createUpdate());
    logger.logEdit('doc2', identity, createUpdate());
    logger.logEdit('doc3', identity, createUpdate());

    expect(db.insert).toHaveBeenCalledTimes(3);
  });

  it('passes null agentModel through for human identities', () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);

    logger.logEdit('doc1', createIdentity({ type: 'human' }), createUpdate());

    const valuesCall = db.insert.mock.results[0].value.values;
    const row = valuesCall.mock.calls[0][0][0];
    expect(row.agentModel).toBeNull();
  });

  it('passes agentModel through for agent identities', () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);

    logger.logEdit(
      'doc1',
      {
        type: 'agent',
        id: 'agent-1',
        name: 'Test Agent',
        color: '#61AFEF',
        agentModel: 'claude-opus-4-7',
      },
      createUpdate(),
    );

    const valuesCall = db.insert.mock.results[0].value.values;
    const row = valuesCall.mock.calls[0][0][0];
    expect(row.agentModel).toBe('claude-opus-4-7');
    expect(row.clientType).toBe('agent');
  });

  it('captures the update payload + size correctly', () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);

    const update = createUpdate(42);
    logger.logEdit('doc1', createIdentity(), update);

    const valuesCall = db.insert.mock.results[0].value.values;
    const row = valuesCall.mock.calls[0][0][0];
    expect(row.updateSize).toBe(42);
    expect(Buffer.isBuffer(row.updateData)).toBe(true);
    expect(row.updateData.length).toBe(42);
  });

  it('flush() awaits in-flight inserts', async () => {
    let resolveInsert: (() => void) | undefined;
    const insertPromise = new Promise<void>((resolve) => {
      resolveInsert = resolve;
    });
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue(insertPromise),
      }),
    };
    const logger = createProvenanceLogger(db);

    logger.logEdit('doc1', createIdentity(), createUpdate());

    const flushPromise = logger.flush();
    let flushResolved = false;
    flushPromise.then(() => {
      flushResolved = true;
    });

    // flush should NOT resolve while the insert is still pending
    await new Promise((r) => setTimeout(r, 0));
    expect(flushResolved).toBe(false);

    resolveInsert?.();
    await flushPromise;
    expect(flushResolved).toBe(true);
  });

  it('flush() is a no-op when no inserts are in flight', async () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);
    await expect(logger.flush()).resolves.toBeUndefined();
  });

  it('swallows insert failures (fire-and-forget)', async () => {
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('DB down')),
      }),
    };
    const logger = createProvenanceLogger(db);

    // logEdit must not throw synchronously even when the underlying
    // insert is doomed. flush() must resolve, not reject.
    expect(() => logger.logEdit('doc1', createIdentity(), createUpdate())).not.toThrow();
    await expect(logger.flush()).resolves.toBeUndefined();
  });

  it('drops logEdit calls after destroy()', async () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);

    await logger.destroy();
    logger.logEdit('doc1', createIdentity(), createUpdate());

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('destroy() awaits in-flight inserts before returning', async () => {
    let resolveInsert: (() => void) | undefined;
    const insertPromise = new Promise<void>((resolve) => {
      resolveInsert = resolve;
    });
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue(insertPromise),
      }),
    };
    const logger = createProvenanceLogger(db);

    logger.logEdit('doc1', createIdentity(), createUpdate());

    const destroyPromise = logger.destroy();
    let destroyResolved = false;
    destroyPromise.then(() => {
      destroyResolved = true;
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(destroyResolved).toBe(false);

    resolveInsert?.();
    await destroyPromise;
    expect(destroyResolved).toBe(true);
  });
});
