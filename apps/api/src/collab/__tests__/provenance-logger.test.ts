import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('createProvenanceLogger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create logger with logEdit, flush, destroy methods', () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);

    expect(logger.logEdit).toBeDefined();
    expect(typeof logger.logEdit).toBe('function');
    expect(logger.flush).toBeDefined();
    expect(typeof logger.flush).toBe('function');
    expect(logger.destroy).toBeDefined();
    expect(typeof logger.destroy).toBe('function');
  });

  it('should buffer entries without immediate DB insert', () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);

    logger.logEdit('doc1', createIdentity(), createUpdate());

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('should flush buffer when size limit (50) is reached', async () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);
    const identity = createIdentity();

    for (let i = 0; i < 50; i++) {
      logger.logEdit('doc1', identity, createUpdate());
    }

    await vi.advanceTimersByTimeAsync(0);

    expect(db.insert).toHaveBeenCalledTimes(1);
    const valuesCall = db.insert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: 'doc1',
          clientType: 'human',
          clientId: 'test-client',
          clientName: 'Test User',
        }),
      ]),
    );
    const entriesArg = valuesCall.mock.calls[0][0];
    expect(entriesArg).toHaveLength(50);
  });

  it('should flush buffer on 5-second interval', async () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);

    logger.logEdit('doc1', createIdentity(), createUpdate());

    expect(db.insert).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);

    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('should batch multiple entries into a single insert call', async () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);
    const identity = createIdentity();

    logger.logEdit('doc1', identity, createUpdate());
    logger.logEdit('doc2', identity, createUpdate());
    logger.logEdit('doc3', identity, createUpdate());

    await logger.flush();

    expect(db.insert).toHaveBeenCalledTimes(1);
    const valuesCall = db.insert.mock.results[0].value.values;
    const entriesArg = valuesCall.mock.calls[0][0];
    expect(entriesArg).toHaveLength(3);
    expect(entriesArg[0]).toEqual(expect.objectContaining({ documentId: 'doc1' }));
    expect(entriesArg[1]).toEqual(expect.objectContaining({ documentId: 'doc2' }));
    expect(entriesArg[2]).toEqual(expect.objectContaining({ documentId: 'doc3' }));
  });

  it('should retry on insert failure (push entries back to buffer)', async () => {
    const valuesFailOnce = vi
      .fn()
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValue(undefined);
    const db = {
      insert: vi.fn().mockReturnValue({
        values: valuesFailOnce,
      }),
    };
    const logger = createProvenanceLogger(db);

    logger.logEdit('doc1', createIdentity(), createUpdate());

    await logger.flush();
    expect(db.insert).toHaveBeenCalledTimes(1);

    await logger.flush();
    expect(db.insert).toHaveBeenCalledTimes(2);
    const secondCallEntries = valuesFailOnce.mock.calls[1][0];
    expect(secondCallEntries).toHaveLength(1);
    expect(secondCallEntries[0]).toEqual(expect.objectContaining({ documentId: 'doc1' }));
  });

  it('should not log after destroy is called', async () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);

    await logger.destroy();

    logger.logEdit('doc1', createIdentity(), createUpdate());
    await logger.flush();

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('should flush remaining entries on destroy', async () => {
    const db = createMockDb();
    const logger = createProvenanceLogger(db);
    const identity = createIdentity();

    logger.logEdit('doc1', identity, createUpdate());
    logger.logEdit('doc2', identity, createUpdate());

    await logger.destroy();

    expect(db.insert).toHaveBeenCalledTimes(1);
    const valuesCall = db.insert.mock.results[0].value.values;
    const entriesArg = valuesCall.mock.calls[0][0];
    expect(entriesArg).toHaveLength(2);
  });
});
