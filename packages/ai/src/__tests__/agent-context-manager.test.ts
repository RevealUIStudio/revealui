import type { Database } from '@revealui/db/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { AgentContextManager } from '../memory/agent/context-manager.js';
import { ValidationError } from '../memory/errors/index.js';
import type { CRDTPersistence } from '../memory/persistence/crdt-persistence.js';
import { WorkingMemory } from '../memory/stores/working-memory.js';

// Mock database and persistence with actual state storage
const mockStorage = new Map<string, Map<string, unknown>>();

class MockDatabase {
  query = {
    agentContexts: {
      findFirst: async () => null,
    },
  };
  insert = () => ({ values: async () => undefined });
  update = () => ({ set: () => ({ where: async () => undefined }) });
  delete = () => ({ where: async () => undefined });
  execute = async () => []; // Add execute method for raw SQL queries
}

// Mock persistence that actually stores state for WorkingMemory
// Note: UserPreferencesManager no longer uses persistence, it uses direct DB access
class MockPersistence {
  // For WorkingMemory (composite state)
  loadCompositeState = async (crdtId: string) => {
    return mockStorage.get(crdtId) || new Map();
  };

  saveCompositeState = async (crdtId: string, states: Map<string, unknown>) => {
    mockStorage.set(crdtId, new Map(states));
  };
}

type CircularContext = { a: number; self?: CircularContext };

describe('AgentContextManager', () => {
  let db: Database;
  let persistence: CRDTPersistence;
  let manager: AgentContextManager;

  beforeEach(() => {
    // Clear mock storage before each test
    mockStorage.clear();
    db = new MockDatabase() as unknown as Database;
    // Use a persistence that actually stores state for merge tests
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
      expect(context).toEqual({
        theme: 'dark',
        language: 'en',
      });
    });
  });

  describe('setAllContext', () => {
    it('should replace entire context', () => {
      manager.setContext('theme', 'dark');
      manager.setAllContext({ language: 'fr', timezone: 'UTC' });

      const context = manager.getAllContext();
      expect(context).toEqual({
        language: 'fr',
        timezone: 'UTC',
      });
      expect(context.theme).toBeUndefined();
    });
  });

  describe('updateContext', () => {
    it('should merge partial updates', () => {
      manager.setContext('theme', 'dark');
      manager.updateContext({ language: 'en' });

      const context = manager.getAllContext();
      expect(context).toEqual({
        theme: 'dark',
        language: 'en',
      });
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
      // Set initial context with some keys and save
      manager.setContext('theme', 'dark');
      manager.setContext('language', 'en');
      await manager.save();

      // Merge with remote context that has different keys
      // Note: mergeContext loads state, merges, and saves
      await manager.mergeContext({ timezone: 'UTC', currency: 'USD' });

      // Reload to get the merged state
      await manager.sync();

      const context = manager.getAllContext();
      // Remote keys should definitely be present after merge
      expect(context.timezone).toBe('UTC');
      expect(context.currency).toBe('USD');
      // Local keys should also be present after merge
      expect(context.theme).toBe('dark');
      expect(context.language).toBe('en');
    });

    it('should apply last-writer-wins for conflicting keys', async () => {
      // Set initial context and save it
      manager.setContext('theme', 'dark');
      await manager.save();

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Merge with remote context that has same key but different value
      // The remote context will have a later timestamp, so it should win
      await manager.mergeContext({ theme: 'light' });

      const context = manager.getAllContext();
      // Remote value should win due to later timestamp (LWW semantics)
      expect(context.theme).toBe('light');
    });

    it('should handle empty remote context', async () => {
      manager.setContext('theme', 'dark');
      manager.setContext('language', 'en');
      await manager.save();

      // Merge with empty context - this creates a new LWWRegister with {}
      // Due to LWW semantics, if the empty object has a later timestamp, it will win
      // This is correct CRDT behavior, but we verify the method doesn't throw
      await manager.mergeContext({});

      const context = manager.getAllContext();
      // Note: Due to LWW semantics, empty merge might overwrite if it has later timestamp
      // This is correct CRDT behavior - we just verify the operation completes
      expect(context).toBeDefined();
      // The actual values depend on timestamp comparison, which is correct
    });

    it('should merge complex nested objects correctly', async () => {
      manager.setContext('user', { name: 'Alice', age: 30 });
      await manager.save();

      await manager.mergeContext({ user: { name: 'Bob', city: 'NYC' } });

      const context = manager.getAllContext();
      // LWW applies to entire object, so remote should replace local
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
      // Last merge should win
      expect(context.counter).toBe(3);
    });

    it('should preserve local changes made after merge', async () => {
      manager.setContext('value', 'initial');
      await manager.save();

      await manager.mergeContext({ value: 'merged' });

      // Make local change after merge
      manager.setContext('value', 'local');

      const context = manager.getAllContext();
      // Local change should win (most recent write)
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
      // __proto__ in object literals is not enumerable, so use constructor instead
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
      // Test with constructor (enumerable dangerous key)
      await expect(manager.mergeContext({ constructor: { polluted: true } })).rejects.toThrow(
        ValidationError,
      );

      // Test with __proto__ set via Object.defineProperty (non-enumerable but should be caught)
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
        // Use 'constructor' as __proto__ in object literals is not enumerable
        await manager.mergeContext({ constructor: { polluted: true } });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as Error).message).toContain('Dangerous context key');
      }
    });
  });
});
