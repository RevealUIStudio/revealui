/**
 * Agent Context Manager
 *
 * Wraps WorkingMemory for agent context management.
 * Provides a higher-level API for managing agent contexts with CRDT support.
 */

import type { Database } from '@revealui/db/client';
import { LWWRegister } from '../crdt/lww-register.js';
import { MemoryError, MigrationError, ValidationError } from '../errors/index.js';
import type { CRDTPersistence } from '../persistence/crdt-persistence.js';
import { WorkingMemory } from '../stores/working-memory.js';
import { findAgentContextById } from '../utils/sql-helpers.js';
import {
  hasCircularReference,
  validateContext,
  validateContextKey,
  validateContextValue,
} from '../utils/validation.js';

// =============================================================================
// Agent Context Manager
// =============================================================================

/**
 * Manages agent context with CRDT support.
 *
 * @example
 * ```typescript
 * const manager = new AgentContextManager('session-123', 'agent-456', 'node-abc', db, persistence)
 * await manager.sync()
 *
 * await manager.setContext('theme', 'dark')
 * const theme = manager.getContext('theme')
 *
 * await manager.save()
 * ```
 */
export class AgentContextManager {
  private workingMemory: WorkingMemory;
  private sessionId: string;
  private agentId: string;
  private nodeId: string;
  private db: Database;

  /**
   * Creates a new AgentContextManager.
   *
   * @param sessionId - Session identifier
   * @param agentId - Agent identifier
   * @param nodeId - Node identifier (for CRDT operations)
   * @param db - Database client
   * @param persistence - Optional persistence adapter
   */
  constructor(
    sessionId: string,
    agentId: string,
    nodeId: string,
    db: Database,
    persistence?: CRDTPersistence,
  ) {
    this.sessionId = sessionId;
    this.agentId = agentId;
    this.nodeId = nodeId;
    this.db = db;
    this.workingMemory = new WorkingMemory(sessionId, nodeId, persistence);
  }

  /**
   * Sets a context value.
   *
   * @param key - Context key
   * @param value - Context value
   */
  /**
   * Sets a context key-value pair.
   *
   * **Validation**: Validates key and value before setting to prevent security issues.
   *
   * @param key - The context key
   * @param value - The context value
   * @throws ValidationError if key or value is invalid
   */
  setContext(key: string, value: unknown): void {
    validateContextKey(key);
    validateContextValue(value, key);
    this.workingMemory.setContextValue(key, value);
  }

  /**
   * Gets a context value.
   *
   * @param key - Context key
   * @returns Context value or undefined
   */
  getContext(key: string): unknown {
    return this.workingMemory.getContextValue(key);
  }

  /**
   * Gets all context.
   *
   * @returns Context object
   */
  getAllContext(): Record<string, unknown> {
    return this.workingMemory.getContext();
  }

  /**
   * Sets entire context object.
   *
   * @param context - Context object
   */
  setAllContext(context: Record<string, unknown>): void {
    this.workingMemory.setContext(context);
  }

  /**
   * Updates context with partial data.
   *
   * @param updates - Partial context updates
   */
  /**
   * Updates multiple context keys at once.
   *
   * **Validation**: Validates all keys and values before updating.
   *
   * @param updates - Object with key-value pairs to update
   * @throws ValidationError if any key or value is invalid
   */
  updateContext(updates: Partial<Record<string, unknown>>): void {
    // Validate all keys and values before updating
    for (const [key, value] of Object.entries(updates)) {
      validateContextKey(key);
      validateContextValue(value, key);
    }

    // Check for circular references in the updates object
    if (hasCircularReference(updates)) {
      throw new ValidationError('Updates object contains circular references');
    }

    this.workingMemory.updateContext(updates);
  }

  /**
   * Merges context from another source (for syncing with remote state).
   * Uses CRDT merge for conflict resolution at the key level.
   *
   * Note: Since LWWRegister works at the object level, we merge the context
   * objects manually to preserve non-conflicting keys from both sides.
   * For conflicting keys, we use LWW semantics with proper timestamps.
   *
   * IMPORTANT: Nested objects are merged at the top level only. If both local
   * and remote have the same key with object values, the entire object is
   * replaced (LWW semantics), not deep-merged. For example:
   * - Local: { user: { name: 'Alice', age: 30 } }
   * - Remote: { user: { name: 'Bob', city: 'NYC' } }
   * - Result: { user: { name: 'Bob', city: 'NYC' } } (remote wins, age is lost)
   *
   * @param remoteContext - Context to merge from (must be a plain object)
   * @throws ValidationError if remoteContext is not a valid object
   */
  async mergeContext(remoteContext: Record<string, unknown>): Promise<void> {
    try {
      // Validate input
      if (!remoteContext || typeof remoteContext !== 'object' || Array.isArray(remoteContext)) {
        throw new ValidationError(
          `remoteContext must be a plain object, got: ${typeof remoteContext}`,
        );
      }

      // Early return for empty merge (no-op)
      if (Object.keys(remoteContext).length === 0) {
        return;
      }

      // Validate remote context (security and performance checks)
      try {
        validateContext(remoteContext);
      } catch (validationError) {
        throw new ValidationError(
          `Invalid remote context: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
        );
      }

      // Check for circular references (deepClone will throw, but we want a better error)
      if (hasCircularReference(remoteContext)) {
        throw new ValidationError(
          'Remote context contains circular references, which are not supported',
        );
      }

      // Load current state
      await this.workingMemory.load();

      // Get current context and actual timestamp from the register
      const currentContext = this.workingMemory.getContext();
      const currentTimestamp = this.workingMemory.getContextTimestamp();
      const now = Date.now();

      // Ensure remote timestamp is always later than current to simulate remote update
      // This ensures remote values win in conflicts (last-writer-wins semantics)
      const remoteTimestamp = Math.max(currentTimestamp + 1, now);

      // Merge objects at key level to preserve all non-conflicting keys
      const mergedContext: Record<string, unknown> = { ...currentContext };

      // Process each remote key
      for (const [key, remoteValue] of Object.entries(remoteContext)) {
        if (!(key in currentContext)) {
          // New key from remote - add it
          mergedContext[key] = remoteValue;
        } else {
          // Conflicting key - use LWWRegister to determine winner
          // Create temporary registers for this key with proper timestamps
          const currentValue = currentContext[key];

          // Current value uses the actual context register timestamp
          // This ensures proper CRDT semantics based on when the context was last updated
          const currentKeyReg = new LWWRegister(this.nodeId, currentValue, currentTimestamp);

          // Remote value gets a timestamp guaranteed to be later (simulating remote update)
          const remoteKeyReg = new LWWRegister(
            `${this.nodeId}-remote`,
            remoteValue,
            remoteTimestamp,
          );

          // Merge to get winner (remote will always win due to later timestamp)
          const mergedKeyReg = currentKeyReg.merge(remoteKeyReg);
          mergedContext[key] = mergedKeyReg.get();
        }
      }

      // Update context with merged values
      // Note: setContext() will update the register's timestamp to the current time,
      // which is correct for a merge operation (it represents a new local update
      // that incorporates remote changes, so it should have a new timestamp)
      this.workingMemory.setContext(mergedContext);

      // Save merged state
      await this.workingMemory.save();
    } catch (error) {
      // Wrap errors with context for better debugging
      if (error instanceof ValidationError || error instanceof MemoryError) {
        throw error; // Re-throw known errors as-is
      }
      throw new MemoryError(
        `Failed to merge context: ${error instanceof Error ? error.message : String(error)}`,
        'MERGE_ERROR',
        500,
      );
    }
  }

  /**
   * Removes a context key.
   *
   * @param key - Context key to remove
   */
  removeContext(key: string): void {
    const current = this.workingMemory.getContext();
    const updated = { ...current };
    Reflect.deleteProperty(updated, key);
    this.workingMemory.setContext(updated);
  }

  /**
   * Syncs with database.
   * Loads existing context, merges with local state, saves back.
   *
   * @throws Error if persistence is not configured
   */
  async sync(): Promise<void> {
    const contextId = `${this.sessionId}:${this.agentId}`;

    // Load existing context from database (using raw SQL for Neon HTTP compatibility)
    const existing = await findAgentContextById(this.db, contextId);

    if (existing) {
      // Load WorkingMemory state
      await this.workingMemory.load();

      // Merge with existing context (if any non-CRDT context exists)
      const existingContext = (existing.context as Record<string, unknown>) || {};
      const crdtData = existingContext._crdt as Record<string, unknown> | undefined;

      // If there's non-CRDT context, throw error (data migration required)
      if (existingContext && !crdtData) {
        throw new MigrationError(
          `Agent context found but missing CRDT state. ` +
            `Data migration required. All contexts must use CRDT format. ` +
            `Context ID: ${existing.id}`,
        );
      }
    } else {
      // No existing context, just load (will initialize empty)
      await this.workingMemory.load();
    }

    // Save merged state
    await this.workingMemory.save();
  }

  /**
   * Saves context to database.
   *
   * @throws Error if persistence is not configured
   */
  async save(): Promise<void> {
    await this.workingMemory.save();
  }

  /**
   * Loads context from database.
   *
   * @throws Error if persistence is not configured
   */
  async load(): Promise<void> {
    await this.workingMemory.load();
  }

  /**
   * Gets the underlying WorkingMemory instance.
   *
   * @returns WorkingMemory instance
   */
  getWorkingMemory(): WorkingMemory {
    return this.workingMemory;
  }

  /**
   * Gets session ID.
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Gets agent ID.
   */
  getAgentId(): string {
    return this.agentId;
  }
}
