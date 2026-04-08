/**
 * User Preferences Manager
 *
 * Manages user preferences with CRDT support for conflict-free updates
 * from multiple devices. Uses LWWRegister for last-writer-wins semantics.
 */

import type { UserPreferences } from '@revealui/contracts/entities';
import { UserPreferencesSchema } from '@revealui/contracts/entities';
import { createLogger } from '@revealui/core/observability/logger';
import type { Database } from '@revealui/db/client';
import { users } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { LWWRegister, type LWWRegisterData } from '../crdt/lww-register.js';
import {
  DatabaseConnectionError,
  DatabaseConstraintError,
  DatabaseOperationError,
  NotFoundError,
  ValidationError,
} from '../errors/index.js';
import { deepClone } from '../utils/deep-clone.js';
import { findUserById } from '../utils/sql-helpers.js';

// =============================================================================
// User Preferences Manager
// =============================================================================

/**
 * Manages user preferences with CRDT support.
 *
 * Note: This implementation stores CRDT state directly in users.preferences JSONB field.
 * All preferences must be in CRDT format - legacy format is not supported.
 *
 * @example
 * ```typescript
 * const manager = new UserPreferencesManager('user-123', 'node-abc', db)
 * await manager.load()
 *
 * await manager.updatePreferences({ theme: 'dark' })
 * const prefs = manager.getPreferences()
 *
 * await manager.save()
 * ```
 */
export class UserPreferencesManager {
  private preferences: LWWRegister<UserPreferences>;
  private userId: string;
  private nodeId: string;
  private db: Database;
  private logger = createLogger({ component: 'UserPreferences' });

  /**
   * Creates a new UserPreferencesManager.
   *
   * @param userId - User identifier
   * @param nodeId - Node identifier (for CRDT operations)
   * @param db - Database client
   */
  constructor(userId: string, nodeId: string, db: Database) {
    this.userId = userId;
    this.nodeId = nodeId;
    this.db = db;

    // Initialize with default preferences
    const defaultPrefs: UserPreferences = {
      theme: 'system',
      language: 'en',
      timezone: 'UTC',
    };
    this.preferences = new LWWRegister<UserPreferences>(nodeId, defaultPrefs);
  }

  /**
   * Gets the current preferences.
   *
   * @returns Current user preferences
   */
  getPreferences(): UserPreferences {
    return this.preferences.get();
  }

  /**
   * Updates preferences with partial data.
   * Merges with existing preferences.
   *
   * @param updates - Partial preferences updates
   */
  updatePreferences(updates: Partial<UserPreferences>): void {
    const current = this.preferences.get();
    const merged: UserPreferences = {
      ...current,
      ...updates,
      // Deep merge for nested objects
      notifications: updates.notifications
        ? { ...current.notifications, ...updates.notifications }
        : current.notifications,
      editor: updates.editor ? { ...current.editor, ...updates.editor } : current.editor,
      ai: updates.ai ? { ...current.ai, ...updates.ai } : current.ai,
    };

    // Validate before setting
    const validationResult = UserPreferencesSchema.safeParse(merged);
    if (!validationResult.success) {
      throw new ValidationError(`Invalid preferences: ${validationResult.error.message}`);
    }

    this.preferences.set(validationResult.data);
  }

  /**
   * Sets entire preferences object.
   *
   * @param preferences - Complete preferences object
   */
  setPreferences(preferences: UserPreferences): void {
    // Validate before setting
    const validationResult = UserPreferencesSchema.safeParse(preferences);
    if (!validationResult.success) {
      throw new ValidationError(`Invalid preferences: ${validationResult.error.message}`);
    }

    this.preferences.set(validationResult.data);
  }

  /**
   * Gets a specific preference value.
   *
   * @param key - Preference key (supports dot notation for nested keys)
   * @returns Preference value or undefined
   */
  getPreference(key: string): unknown {
    const prefs = this.preferences.get();
    const keys = key.split('.');
    let value: unknown = prefs;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Sets a specific preference value.
   *
   * @param key - Preference key (supports dot notation for nested keys)
   * @param value - Preference value
   */
  setPreference(key: string, value: unknown): void {
    // Deep clone to avoid mutations
    const prefs = deepClone(this.preferences.get());
    const keys = key.split('.');
    const lastKey = keys[keys.length - 1];
    if (!lastKey) {
      throw new ValidationError(`Invalid preference key: "${key}"`);
    }
    const parentKeys = keys.slice(0, -1);

    // Navigate to parent object in cloned structure
    let parent: Record<string, unknown> = prefs as Record<string, unknown>;
    for (const k of parentKeys) {
      if (!(k in parent) || typeof parent[k] !== 'object' || parent[k] === null) {
        parent[k] = {};
      }
      parent = parent[k] as Record<string, unknown>;
    }

    // Set the value in cloned structure
    parent[lastKey] = value;

    // Validate and set
    const validationResult = UserPreferencesSchema.safeParse(prefs);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid preferences after update: ${validationResult.error.message}`,
      );
    }

    this.preferences.set(validationResult.data);
  }

  /**
   * Merges another UserPreferencesManager into this one.
   * Uses CRDT merge for conflict resolution.
   *
   * @param other - UserPreferencesManager to merge
   * @returns New merged UserPreferencesManager
   */
  merge(other: UserPreferencesManager): UserPreferencesManager {
    const merged = new UserPreferencesManager(this.userId, this.nodeId, this.db);
    merged.preferences = this.preferences.merge(other.preferences);
    return merged;
  }

  /**
   * Loads preferences from database.
   * Stores CRDT state directly in users.preferences JSONB field.
   * Requires preferences to be in CRDT format.
   *
   * @throws DatabaseConnectionError if database connection fails
   * @throws DatabaseOperationError if database operation fails
   * @throws ValidationError if preferences are not in CRDT format
   */
  async load(): Promise<void> {
    try {
      // Load user record (using raw SQL for Neon HTTP compatibility)
      const user = await findUserById(this.db, this.userId);

      if (!user) {
        // User doesn't exist, use defaults
        return;
      }

      // Check if preferences exist
      if (user.preferences && typeof user.preferences === 'object' && user.preferences !== null) {
        const prefsRecord = user.preferences as Record<string, unknown>;

        // Check for CRDT state in _crdt field
        if (prefsRecord._crdt && typeof prefsRecord._crdt === 'object') {
          const crdtData = prefsRecord._crdt as Record<string, unknown>;
          const lwwData = crdtData.lww_register as LWWRegisterData<UserPreferences> | undefined;

          if (lwwData && 'value' in lwwData) {
            const validationResult = UserPreferencesSchema.safeParse(lwwData.value);

            if (validationResult.success) {
              this.preferences = LWWRegister.fromData<UserPreferences>(lwwData);
              return;
            }
          }
        }

        // Preferences exist but are not in CRDT format
        // Per legacy code removal policy, we do not support legacy format
        throw new ValidationError(
          `User preferences for ${this.userId} are not in valid CRDT format. ` +
            `Expected CRDT structure with _crdt.lww_register.value, but got: ${JSON.stringify(user.preferences).substring(0, 100)}. ` +
            `All preferences must be stored in CRDT format.`,
        );
      }
    } catch (error) {
      // Handle specific error types
      if (error instanceof ValidationError) {
        throw error;
      }

      // Database errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes('connection') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('econnrefused') ||
          errorMessage.includes('connect econnrefused')
        ) {
          this.logger.error(
            `Database connection error loading preferences for user ${this.userId}`,
            error,
          );
          throw new DatabaseConnectionError('Failed to load user preferences', error);
        }

        if (
          errorMessage.includes('violates') ||
          errorMessage.includes('constraint') ||
          errorMessage.includes('foreign key')
        ) {
          this.logger.error(
            `Database constraint error loading preferences for user ${this.userId}`,
            error,
          );
          throw new DatabaseConstraintError('Failed to load user preferences', error);
        }
      }

      // Generic database operation error
      this.logger.error(
        `Failed to load preferences for user ${this.userId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw new DatabaseOperationError(
        'Failed to load user preferences',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Saves preferences to database.
   * Stores CRDT state directly in users.preferences JSONB field.
   *
   * @throws NotFoundError if user does not exist
   * @throws DatabaseConnectionError if database connection fails
   * @throws DatabaseConstraintError if database constraint violation occurs
   * @throws DatabaseOperationError if database operation fails
   */
  async save(): Promise<void> {
    try {
      // Store CRDT state in users.preferences JSONB field
      // Structure: { _crdt: { lww_register: {...} } }
      const crdtData = this.preferences.toData();
      const preferencesValue = {
        _crdt: {
          lww_register: crdtData,
        },
      };

      // Check if user exists (using raw SQL for Neon HTTP compatibility)
      const existingUser = await findUserById(this.db, this.userId);

      if (!existingUser) {
        throw new NotFoundError(`User ${this.userId}`);
      }

      // Update users table with CRDT state in preferences JSONB
      await this.db
        .update(users)
        .set({
          preferences: preferencesValue,
          updatedAt: new Date(),
        })
        .where(eq(users.id, this.userId));
    } catch (error) {
      // Handle specific error types (re-throw as-is)
      if (
        error instanceof NotFoundError ||
        error instanceof DatabaseConnectionError ||
        error instanceof DatabaseConstraintError ||
        error instanceof DatabaseOperationError
      ) {
        throw error;
      }

      // Handle database errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes('connection') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('econnrefused') ||
          errorMessage.includes('connect econnrefused')
        ) {
          this.logger.error(
            `Database connection error saving preferences for user ${this.userId}`,
            error,
          );
          throw new DatabaseConnectionError('Failed to save user preferences', error);
        }

        if (
          errorMessage.includes('violates') ||
          errorMessage.includes('constraint') ||
          errorMessage.includes('foreign key') ||
          errorMessage.includes('duplicate')
        ) {
          this.logger.error(
            `Database constraint error saving preferences for user ${this.userId}`,
            error,
          );
          throw new DatabaseConstraintError('Failed to save user preferences', error);
        }
      }

      // Generic database operation error
      this.logger.error(
        `Failed to save preferences for user ${this.userId}`,
        error instanceof Error ? error : new Error(String(error)),
      );
      throw new DatabaseOperationError(
        'Failed to save user preferences',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Serializes preferences to plain object.
   *
   * @returns Serialized data
   */
  toData(): LWWRegisterData<UserPreferences> {
    return this.preferences.toData();
  }

  /**
   * Deserializes preferences from plain object.
   *
   * @param data - Serialized data
   * @param userId - User identifier
   * @param nodeId - Node identifier
   * @param db - Database client
   * @returns New UserPreferencesManager instance
   */
  static fromData(
    data: LWWRegisterData<UserPreferences>,
    userId: string,
    nodeId: string,
    db: Database,
  ): UserPreferencesManager {
    const manager = new UserPreferencesManager(userId, nodeId, db);
    manager.preferences = LWWRegister.fromData<UserPreferences>(data);
    return manager;
  }

  /**
   * Creates a copy of this UserPreferencesManager.
   *
   * @returns New UserPreferencesManager with same state
   */
  clone(): UserPreferencesManager {
    return UserPreferencesManager.fromData(this.toData(), this.userId, this.nodeId, this.db);
  }

  /**
   * Gets the user ID.
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Gets the node ID.
   */
  getNodeId(): string {
    return this.nodeId;
  }
}
