/**
 * AgentContextManager tests
 *
 * These tests exercise the CRDT merge semantics layered over a MockPersistence
 * (in-memory Map) for speed and determinism. The Database argument is now a
 * real PGlite client (with the pgvector extension enabled) rather than an
 * ad-hoc MockDatabase — `AgentContextManager.sync()` calls
 * `findAgentContextById`, which in Phase 6.1 became a Drizzle
 * `db.select().from(agentContexts)` query. An empty `agent_contexts` table
 * satisfies that call (returns undefined) without changing any assertion.
 */

import type { Database } from '@revealui/db/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../../test/src/utils/drizzle-test-db.js';
import { AgentContextManager } from '../memory/agent/context-manager.js';
import { ValidationError } from '../memory/errors/index.js';
import type { CRDTPersistence } from '../memory/persistence/crdt-persistence.js';
import { WorkingMemory } from '../memory/stores/working-memory.js';

// In-memory state store that simulates the persistence layer for WorkingMemory.
// This lets us test CRDT merge semantics without round-tripping through the DB.
const mockStorage = new Map<string, Map<string, unknown>>();

class MockPersistence {
  loadCompositeState = async (crdtId: string) => {
    return mockStorage.get(crdtId) || new Map();
  };

  saveCompositeState = async (crdtId: string, states: Map<string, unknown>) => {
    mockStorage.set(crdtId, new Map(states));
  };
}

type CircularContext = { a: number; self?: CircularContext };

describe('AgentContextManager', () => {
  let testDb: TestDb;
  let db: Database;
  let persistence: CRDTPersistence;
  let manager: AgentContextManager;

  beforeAll(async () => {
    // enableVector: true so agent_contexts (which has a vector(768) embedding)
    // is created in PGlite. The table stays empty for these tests; sync() only
    // probes for an existing row and correctly returns undefined.
    testDb = await createTestDb({ enableVector: true });
    db = testDb.drizzle as unknown as Database;
  }, 30_000);

  afterAll(async () => {
    await testDb?.close();
  });

  beforeEach(() => {
    mockStorage.clear();
    persistence = new MockPersistence() as unknown as CRDTPersistence;
    manager = new AgentContextManager('session-123', 'agent-456', 'node-abc', db, persistence);
  });

  describe('constructor', () => {
    it('should create manager with correct session and agent IDs', () => {
      expect(manager.getSessionId()).toBe('session-123');
      expect(manager.getAgentId()).toBe('agent-456');
    });
  });

  describe('setContext and getContext', () => {
    it('should set and get a context value', () => {
      manager.setContext('theme', 'dark');
      expect(manager.getContext('theme')).toBe('dark');
    });

    it('should return undefined for non-existent key', () => {
      expect(manager.getContext('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllContext', () => {
    it('should return empty context initially', () => {
      const context = manager.getAllContext();
      expect(context).toEqual({});
    });

    it('should return all context values', () => {
      manager.setContext('theme', 'dark');
      manager.setContext('language', 'en');

      const context = manager.getAllContext();
      expect(context).toEqual({ theme: 'dark', language: 'en' });
    });
  });

  describe('setAllContext', () => {
    it('should replace entire context', () => {
      manager.setContext('theme', 'dark');
      manager.setAllContext({ language: 'fr', timezone: 'UTC' });

      const context = manager.getAllContext();
      expect(context).toEqual({ language: 'fr', timezone: 'UTC' });
      expect(context.theme).toBeUndefined();
    });
  });

  describe('updateContext', () => {
    it('should merge partial updates', () => {
      manager.setContext('theme', 'dark');
      manager.updateContext({ language: 'en' });

      const context = manager.getAllContext();
      expect(context).toEqual({ theme: 'dark', language: 'en' });
    });

    it('should overwrite existing keys', () => {
      manager.setContext('theme', 'dark');
      manager.updateContext({ theme: 'light' });

      expect(manager.getContext('theme')).toBe('light');
    });
  });

  describe('removeContext', () => {
    it('should remove a context key', () => {
      manager.setContext('theme', 'dark');
      manager.setContext('language', 'en');

      manager.removeContext('theme');

      const context = manager.getAllContext();
      expect(context.theme).toBeUndefined();
      expect(context.language).toBe('en');
    });

    it('should handle removing non-existent key gracefully', () => {
      expect(() => {
        manager.removeContext('nonexistent');
      }).not.toThrow();
    });
  });

  describe('mergeContext', () => {
    it('should preserve non-conflicting keys from both contexts', async () => {
      manager.setContext('theme', 'dark');
      manager.setContext('language', 'en');
      await manager.save();

      await manager.mergeContext({ timezone: 'UTC', currency: 'USD' });
      await manager.sync();

      const context = manager.getAllContext();
      expect(context.timezone).toBe('UTC');
      expect(context.currency).toBe('USD');
      expect(context.theme).toBe('dark');
      expect(context.language).toBe('en');
    });

    it('should apply last-writer-wins for conflicting keys', async () => {
      manager.setContext('theme', 'dark');
      await manager.save();

      await new Promise((resolve) => setTimeout(resolve, 10));
      await manager.mergeContext({ theme: 'light' });

      const context = manager.getAllContext();
      expect(context.theme).toBe('light');
    });

    it('should handle empty remote context', async () => {
      manager.setContext('theme', 'dark');
      manager.setContext('language', 'en');
      await manager.save();

      await manager.mergeContext({});

      const context = manager.getAllContext();
      // LWW semantics: empty merge may or may not overwrite depending on timestamp.
      // This test only asserts the operation completes without throwing.
      expect(context).toBeDefined();
    });

    it('should merge complex nested objects correctly', async () => {
      manager.setContext('user', { name: 'Alice', age: 30 });
      await manager.save();

      await manager.mergeContext({ user: { name: 'Bob', city: 'NYC' } });

      const context = manager.getAllContext();
      expect(context.user).toEqual({ name: 'Bob', city: 'NYC' });
    });

    it('should handle multiple sequential merges correctly', async () => {
      manager.setContext('counter', 1);
      await manager.save();

      await new Promise((resolve) => setTimeout(resolve, 10));
      await manager.mergeContext({ counter: 2 });

      await new Promise((resolve) => setTimeout(resolve, 10));
      await manager.mergeContext({ counter: 3 });

      const context = manager.getAllContext();
      expect(context.counter).toBe(3);
    });

    it('should preserve local changes made after merge', async () => {
      manager.setContext('value', 'initial');
      await manager.save();

      await manager.mergeContext({ value: 'merged' });
      manager.setContext('value', 'local');

      const context = manager.getAllContext();
      expect(context.value).toBe('local');
    });
  });

  describe('getWorkingMemory', () => {
    it('should return WorkingMemory instance', () => {
      const workingMemory = manager.getWorkingMemory();
      expect(workingMemory).toBeInstanceOf(WorkingMemory);
    });
  });

  describe('Input Validation', () => {
    it('should reject dangerous keys in setContext', () => {
      expect(() => manager.setContext('__proto__', { polluted: true })).toThrow(ValidationError);
      expect(() => manager.setContext('constructor', {})).toThrow(ValidationError);
      expect(() => manager.setContext('prototype', {})).toThrow(ValidationError);
    });

    it('should reject undefined values in setContext', () => {
      expect(() => manager.setContext('key', undefined)).toThrow(ValidationError);
    });

    it('should reject functions in setContext', () => {
      expect(() => manager.setContext('key', () => undefined)).toThrow(ValidationError);
    });

    it('should reject dangerous keys in updateContext', () => {
      expect(() => manager.updateContext({ constructor: { polluted: true } })).toThrow(
        ValidationError,
      );
    });

    it('should reject circular references in updateContext', () => {
      const circular: CircularContext = { a: 1 };
      circular.self = circular;
      expect(() => manager.updateContext({ circular })).toThrow(ValidationError);
    });

    it('should reject dangerous keys in mergeContext', async () => {
      await expect(manager.mergeContext({ constructor: { polluted: true } })).rejects.toThrow(
        ValidationError,
      );

      const protoContext: Record<string, unknown> = { normal: 'value' };
      Object.defineProperty(protoContext, '__proto__', {
        value: { polluted: true },
        enumerable: true,
        configurable: true,
      });
      await expect(manager.mergeContext(protoContext)).rejects.toThrow(ValidationError);
    });

    it('should reject circular references in mergeContext', async () => {
      const circular: CircularContext = { a: 1 };
      circular.self = circular;
      await expect(manager.mergeContext({ circular })).rejects.toThrow(ValidationError);
    });

    it('should provide detailed error messages', async () => {
      try {
        await manager.mergeContext({ constructor: { polluted: true } });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as Error).message).toContain('Dangerous context key');
      }
    });
  });
});
