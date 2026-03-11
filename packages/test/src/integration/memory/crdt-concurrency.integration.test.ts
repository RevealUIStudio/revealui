/**
 * CRDT Concurrency Integration Tests
 *
 * PURPOSE: Verify CRDT data structures maintain consistency under concurrent operations
 *
 * CRITICAL CONTEXT: CRDTs must work correctly to:
 * - Enable offline-first collaboration
 * - Resolve conflicts automatically
 * - Maintain eventual consistency
 * - Support distributed AI agent memory
 *
 * TESTS:
 * - VectorClock concurrent operations
 * - LWWRegister concurrent writes
 * - ORSet concurrent add/remove
 * - PNCounter distributed counting
 * - Persistence and recovery
 */

import { describe, expect, it } from 'vitest';
import {
  LWWRegister,
  ORSet,
  PNCounter,
  VectorClock,
} from '../../../../ai/src/memory/crdt/index.js';

describe('CRDT Concurrency Integration Tests', () => {
  // =============================================================================
  // Concurrent VectorClock Operations
  // =============================================================================

  describe('Concurrent VectorClock Operations', () => {
    it('should detect concurrent updates correctly', () => {
      // Create two nodes
      const clock1 = new VectorClock('node-a');
      const clock2 = new VectorClock('node-b');

      // Each node ticks independently
      clock1.tick(); // node-a: 1
      clock2.tick(); // node-b: 1

      // These are concurrent events
      const comparison = clock1.compare(clock2);
      expect(comparison).toBe('concurrent');
    });

    it('should merge clocks from multiple nodes', () => {
      // Create three nodes
      const clock1 = new VectorClock('node-a');
      const clock2 = new VectorClock('node-b');
      const clock3 = new VectorClock('node-c');

      // Each node performs operations
      clock1.tick(); // node-a: 1
      clock1.tick(); // node-a: 2

      clock2.tick(); // node-b: 1
      clock2.tick(); // node-b: 2
      clock2.tick(); // node-b: 3

      clock3.tick(); // node-c: 1

      // Merge all clocks
      clock1.merge(clock2);
      clock1.merge(clock3);

      // Verify max values per node
      expect(clock1.get('node-a')).toBe(2);
      expect(clock1.get('node-b')).toBe(3);
      expect(clock1.get('node-c')).toBe(1);
    });
  });

  // =============================================================================
  // LWWRegister Concurrent Writes
  // =============================================================================

  describe('LWWRegister Concurrent Writes', () => {
    it('should resolve concurrent writes by timestamp (later wins)', () => {
      // Create two nodes with different timestamps
      const reg1 = new LWWRegister<string>('node-a', 'initial', 1000);
      const reg2 = new LWWRegister<string>('node-b', 'initial', 1000);

      // Write at different times
      reg1.set('value-from-a', 2000); // Earlier
      reg2.set('value-from-b', 3000); // Later

      // Merge - later timestamp wins (merge returns new instance)
      const merged = reg1.merge(reg2);
      expect(merged.get()).toBe('value-from-b');
    });

    it('should use node ID as tiebreaker for same timestamp', () => {
      const timestamp = Date.now();

      // Create two nodes with same timestamp
      const reg1 = new LWWRegister<string>('node-a', 'initial', timestamp);
      const reg2 = new LWWRegister<string>('node-b', 'initial', timestamp);

      // Write at exact same time
      reg1.set('value-from-a', timestamp + 1000);
      reg2.set('value-from-b', timestamp + 1000);

      // Merge - node-b > node-a lexicographically (merge returns new instance)
      const merged1 = reg1.merge(reg2);
      expect(merged1.get()).toBe('value-from-b');

      // Verify reverse merge gives same result
      const reg3 = new LWWRegister<string>('node-a', 'initial', timestamp);
      const reg4 = new LWWRegister<string>('node-b', 'initial', timestamp);
      reg3.set('value-from-a', timestamp + 1000);
      reg4.set('value-from-b', timestamp + 1000);

      const merged2 = reg4.merge(reg3);
      expect(merged2.get()).toBe('value-from-b');
    });

    it('should handle rapid concurrent merges without data loss', () => {
      const baseTimestamp = Date.now();

      // Create 10 concurrent writers
      const registers: Array<LWWRegister<string>> = [];
      for (let i = 0; i < 10; i++) {
        const reg = new LWWRegister<string>(`node-${i}`, 'initial', baseTimestamp);
        reg.set(`value-${i}`, baseTimestamp + i * 100);
        registers.push(reg);
      }

      // Merge all into first register (merge returns new instance, so chain them)
      let merged = registers[0]!;
      for (let i = 1; i < registers.length; i++) {
        merged = merged.merge(registers[i]!);
      }

      // Final state should be consistent (latest value)
      expect(merged.get()).toBe('value-9'); // Last one has highest timestamp
    });
  });

  // =============================================================================
  // ORSet Concurrent Add/Remove
  // =============================================================================

  describe('ORSet Concurrent Add/Remove', () => {
    it('should preserve concurrent adds from different nodes', () => {
      // Create two nodes
      const set1 = new ORSet<string>('node-a');
      const set2 = new ORSet<string>('node-b');

      // Concurrent adds
      set1.add('item1');
      set2.add('item2');

      // Merge should have both (merge returns new instance)
      const merged = set1.merge(set2);
      expect(merged.hasValue('item1')).toBe(true);
      expect(merged.hasValue('item2')).toBe(true);
      expect(merged.size).toBe(2);
    });

    it('should handle add-remove-add pattern correctly', () => {
      const set1 = new ORSet<string>('node-a');
      const set2 = new ORSet<string>('node-b');

      // Node A: add(x) -> remove(x) -> add(x)
      set1.add('x');
      const firstTag = set1.getTags('x')[0];
      set1.remove(firstTag!);
      set1.add('x');

      // Node B: add(x)
      set2.add('x');

      // Merge - add-wins semantics means x should exist (merge returns new instance)
      const merged = set1.merge(set2);
      expect(merged.hasValue('x')).toBe(true);
    });

    it('should not resurrect removed items after merge', () => {
      const set1 = new ORSet<string>('node-a');
      const set2 = new ORSet<string>('node-b');

      // Node 1 adds an item
      set1.add('item');

      // Node 2 syncs with node 1 (sees the same addition)
      const synced = set2.merge(set1);

      // Node 2 removes it (now knows about the same tag)
      synced.removeByValue('item');

      // Node 1 merges back - item should stay removed (merge returns new instance)
      const merged = set1.merge(synced);
      expect(merged.hasValue('item')).toBe(false);
    });
  });

  // =============================================================================
  // PNCounter Distributed Counting
  // =============================================================================

  describe('PNCounter Distributed Counting', () => {
    it('should correctly sum increments from multiple nodes', () => {
      // Create 5 nodes
      const counters: Array<PNCounter> = [];
      for (let i = 0; i < 5; i++) {
        const counter = new PNCounter(`node-${i}`);
        // Each increments by 10
        for (let j = 0; j < 10; j++) {
          counter.increment();
        }
        counters.push(counter);
      }

      // Merge all into first counter (merge returns new instance, so chain them)
      let merged = counters[0]!;
      for (let i = 1; i < counters.length; i++) {
        merged = merged.merge(counters[i]!);
      }

      // Total should be 50 (5 nodes * 10 increments)
      expect(merged.value()).toBe(50);
    });

    it('should correctly handle mixed increment/decrement from nodes', () => {
      const counter1 = new PNCounter('node-a');
      const counter2 = new PNCounter('node-b');

      // Node A: +10 -3
      for (let i = 0; i < 10; i++) {
        counter1.increment();
      }
      for (let i = 0; i < 3; i++) {
        counter1.decrement();
      }

      // Node B: +5
      for (let i = 0; i < 5; i++) {
        counter2.increment();
      }

      // Merge (merge returns new instance)
      const merged = counter1.merge(counter2);

      // Total: (10 - 3) + 5 = 12
      expect(merged.value()).toBe(12);
    });
  });

  // =============================================================================
  // Persistence and Recovery
  // =============================================================================

  describe('Persistence and Recovery', () => {
    it('should persist CRDT state and recover after restart', () => {
      // Create and modify a register
      const register = new LWWRegister<{ count: number }>('node-a', { count: 0 });
      register.set({ count: 42 });

      // Serialize state
      const serialized = register.toData();

      // Simulate restart - create new register from serialized data
      const recovered = LWWRegister.fromData<{ count: number }>(serialized);

      // Verify state is preserved
      expect(recovered.get().count).toBe(42);
    });

    it('should merge recovered state with ongoing updates', () => {
      // Create register and serialize early state
      const register1 = new LWWRegister<number>('node-a', 0, 1000);
      register1.set(10, 2000);
      const snapshot = register1.toData();

      // Continue updates on original
      register1.set(20, 3000);

      // Meanwhile, another node makes updates
      const register2 = new LWWRegister<number>('node-b', 0, 1000);
      register2.set(15, 2500);

      // Recover from snapshot and merge (merge returns new instance, so chain them)
      const recovered = LWWRegister.fromData<number>(snapshot);
      const merged1 = recovered.merge(register1);
      const merged2 = merged1.merge(register2);

      // Latest update wins (register1 at 3000)
      expect(merged2.get()).toBe(20);
    });
  });
});
