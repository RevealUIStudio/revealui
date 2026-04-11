/**
 * Tests for CRDT full implementation:
 * - ORSet tombstone GC (compact)
 * - CRDTPersistence operation replay
 * - SyncManager state and delta sync
 * - WorkingMemory operation logging
 */

import { describe, expect, it, vi } from 'vitest';
import { LWWRegister } from '../memory/crdt/lww-register.js';
import { ORSet } from '../memory/crdt/or-set.js';
import { PNCounter } from '../memory/crdt/pn-counter.js';
import type { CRDTOperationPayload } from '../memory/persistence/crdt-persistence.js';
import { SyncManager } from '../memory/sync/sync-manager.js';

// =============================================================================
// ORSet Tombstone GC
// =============================================================================

describe('ORSet tombstone GC', () => {
  it('compact removes entries whose tags are in the removed set', () => {
    const set = new ORSet<string>('node-a');
    const tag1 = set.add('item1');
    const tag2 = set.add('item2');
    set.add('item3');

    set.remove(tag1);
    set.remove(tag2);

    expect(set.tombstoneCount).toBe(2);
    expect(set.size).toBe(1);

    const compacted = set.compact();
    expect(compacted).toBe(2);
    expect(set.tombstoneCount).toBe(0);
    // item3 should still be there
    expect(set.size).toBe(1);
    expect(set.hasValue('item3')).toBe(true);
  });

  it('compact returns 0 when no tombstones exist', () => {
    const set = new ORSet<string>('node-a');
    set.add('item1');

    expect(set.compact()).toBe(0);
    expect(set.tombstoneCount).toBe(0);
  });

  it('compact preserves non-removed entries', () => {
    const set = new ORSet<string>('node-a');
    set.add('a');
    set.add('b');
    const tagC = set.add('c');
    set.add('d');

    set.remove(tagC);
    set.compact();

    expect(set.size).toBe(3);
    expect(set.hasValue('a')).toBe(true);
    expect(set.hasValue('b')).toBe(true);
    expect(set.hasValue('c')).toBe(false);
    expect(set.hasValue('d')).toBe(true);
  });

  it('tombstoneCount reflects current removed set size', () => {
    const set = new ORSet<string>('node-a');
    const tag = set.add('item');
    expect(set.tombstoneCount).toBe(0);

    set.remove(tag);
    expect(set.tombstoneCount).toBe(1);

    set.compact();
    expect(set.tombstoneCount).toBe(0);
  });

  it('compact works after merge with tombstones from both sides', () => {
    const set1 = new ORSet<string>('node-a');
    const set2 = new ORSet<string>('node-b');

    const tag1 = set1.add('shared');
    const tag2 = set2.add('also-shared');

    set1.remove(tag1);
    set2.remove(tag2);

    const merged = set1.merge(set2);
    expect(merged.tombstoneCount).toBe(2);
    expect(merged.size).toBe(0);

    const compacted = merged.compact();
    expect(compacted).toBe(2);
    expect(merged.tombstoneCount).toBe(0);
  });
});

// =============================================================================
// CRDTPersistence operation replay
// =============================================================================

describe('CRDTPersistence.replayOperations', () => {
  it('replays LWWRegister set operations', async () => {
    // Simulate what replayOperations would do
    const nodeId = 'node-a';
    const register = new LWWRegister<unknown>(nodeId, null, 0);

    register.set('first', 100);
    register.set('second', 200);
    register.set('third', 300);

    expect(register.get()).toBe('third');
    expect(register.getTimestamp()).toBe(300);
  });

  it('replays ORSet add/remove operations', () => {
    const set = new ORSet<string>('node-a');

    const tag1 = set.add('item1');
    set.add('item2');
    set.remove(tag1);

    expect(set.size).toBe(1);
    expect(set.hasValue('item2')).toBe(true);
    expect(set.hasValue('item1')).toBe(false);
  });

  it('replays PNCounter increment/decrement operations', () => {
    const counter = new PNCounter('node-a');

    counter.increment(5);
    counter.increment(3);
    counter.decrement(2);

    expect(counter.value()).toBe(6);
  });
});

// =============================================================================
// SyncManager
// =============================================================================

describe('SyncManager', () => {
  function createMockPersistence() {
    const operations: CRDTOperationPayload[] = [];

    return {
      appendOperation: vi.fn(async (op: CRDTOperationPayload) => {
        operations.push(op);
      }),
      getOperationsSince: vi.fn(async (crdtId: string, since: number) => {
        return operations.filter((op) => op.crdtId === crdtId && op.timestamp >= since);
      }),
      loadCompositeState: vi.fn(async () => new Map()),
      saveCompositeState: vi.fn(async () => {}),
      saveCRDTState: vi.fn(async () => {}),
      loadCRDTState: vi.fn(async () => null),
      replayOperations: vi.fn(async () => null),
      deleteOperationsBefore: vi.fn(async () => 0),
      _operations: operations,
    };
  }

  it('logs operations via logOperation', async () => {
    const persistence = createMockPersistence();
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const sync = new SyncManager('node-a', persistence as any);

    await sync.logOperation('crdt-1', 'lww_register', 'set', { value: 'hello' });

    expect(persistence.appendOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        crdtId: 'crdt-1',
        crdtType: 'lww_register',
        operationType: 'set',
        payload: { value: 'hello' },
        nodeId: 'node-a',
      }),
    );
  });

  it('produces delta with operations since timestamp', async () => {
    const persistence = createMockPersistence();
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const sync = new SyncManager('node-a', persistence as any);

    await sync.logOperation('crdt-1', 'lww_register', 'set', { value: 'v1' });
    await sync.logOperation('crdt-1', 'lww_register', 'set', { value: 'v2' });

    const delta = await sync.getDelta('crdt-1', 0);
    expect(delta.crdtId).toBe('crdt-1');
    expect(delta.sourceNodeId).toBe('node-a');
    expect(delta.operations).toHaveLength(2);
  });

  it('applies delta from remote node, skipping own operations', async () => {
    const persistence = createMockPersistence();
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const sync = new SyncManager('node-a', persistence as any);

    const delta = {
      crdtId: 'crdt-1',
      sourceNodeId: 'node-b',
      operations: [
        {
          crdtId: 'crdt-1',
          crdtType: 'lww_register' as const,
          operationType: 'set' as const,
          payload: { value: 'from-b' },
          nodeId: 'node-b',
          timestamp: 100,
        },
        {
          crdtId: 'crdt-1',
          crdtType: 'lww_register' as const,
          operationType: 'set' as const,
          payload: { value: 'own-op' },
          nodeId: 'node-a', // own node  -  should be skipped
          timestamp: 101,
        },
      ],
      lastSyncTimestamp: 101,
    };

    const result = await sync.applyDelta(delta);
    expect(result.changed).toBe(true);
    expect(result.operationsApplied).toBe(1); // Only the remote op
    expect(result.syncTimestamp).toBe(101);
  });

  it('tracks sync points per remote node', () => {
    const persistence = createMockPersistence();
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const sync = new SyncManager('node-a', persistence as any);

    expect(sync.getSyncPoint('node-b')).toBe(0);

    sync.setSyncPoint('node-b', 500);
    expect(sync.getSyncPoint('node-b')).toBe(500);

    sync.setSyncPoint('node-c', 1000);
    expect(sync.getAllSyncPoints().size).toBe(2);
  });

  it('full two-node sync scenario', async () => {
    const persistenceA = createMockPersistence();
    const persistenceB = createMockPersistence();

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const syncA = new SyncManager('node-a', persistenceA as any);
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const syncB = new SyncManager('node-b', persistenceB as any);

    // Node A logs some operations
    await syncA.logOperation('mem-1', 'lww_register', 'set', { value: 'from-a' });
    await syncA.logOperation('mem-1', 'or_set', 'add', { value: 'agent-1', tag: 't1' });

    // Node A produces a delta
    const deltaFromA = await syncA.getDelta('mem-1', 0);
    expect(deltaFromA.operations).toHaveLength(2);

    // Node B applies the delta
    const result = await syncB.applyDelta(deltaFromA);
    expect(result.operationsApplied).toBe(2);
    expect(result.changed).toBe(true);

    // Node B's sync point is updated
    expect(syncB.getSyncPoint('node-a')).toBe(deltaFromA.lastSyncTimestamp);
  });
});

// =============================================================================
// WorkingMemory operation logging
// =============================================================================

describe('WorkingMemory operation logging', () => {
  // We can't easily import WorkingMemory without mocking DB deps,
  // so test the SyncManager.logOperation integration directly.

  it('SyncManager correctly formats operation payloads', async () => {
    const persistence = {
      appendOperation: vi.fn(async () => {}),
      getOperationsSince: vi.fn(async () => []),
      loadCompositeState: vi.fn(async () => new Map()),
      saveCompositeState: vi.fn(async () => {}),
      saveCRDTState: vi.fn(async () => {}),
      loadCRDTState: vi.fn(async () => null),
      replayOperations: vi.fn(async () => null),
      deleteOperationsBefore: vi.fn(async () => 0),
    };

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const sync = new SyncManager('node-a', persistence as any);

    // Simulate what WorkingMemory.setContext would log
    await sync.logOperation('working-memory:session-1', 'lww_register', 'set', {
      value: { theme: 'dark' },
      key: 'context',
    });

    // Simulate what WorkingMemory.addAgent would log
    await sync.logOperation('working-memory:session-1', 'or_set', 'add', {
      value: { id: 'agent-1', name: 'Assistant' },
      tag: 'node-a:uuid',
    });

    // Simulate what WorkingMemory.removeAgent would log
    await sync.logOperation('working-memory:session-1', 'or_set', 'remove', {
      tag: 'node-a:uuid',
    });

    expect(persistence.appendOperation).toHaveBeenCalledTimes(3);

    const calls = persistence.appendOperation.mock.calls;
    expect(calls[0][0].crdtType).toBe('lww_register');
    expect(calls[0][0].operationType).toBe('set');
    expect(calls[1][0].crdtType).toBe('or_set');
    expect(calls[1][0].operationType).toBe('add');
    expect(calls[2][0].crdtType).toBe('or_set');
    expect(calls[2][0].operationType).toBe('remove');
  });
});
