/**
 * Node ID Service
 *
 * Provides deterministic node IDs for CRDT operations using a hybrid approach:
 * - Primary: SHA-256 hash of entity ID (fast, deterministic, no DB lookup)
 * - Fallback: Database table for collision resolution and manual management
 *
 * This ensures:
 * - Same entity always gets same node ID (deterministic)
 * - Collision-resistant (SHA-256 + DB fallback)
 * - Fast (hash is primary, DB only on collision)
 */

import { createHash, randomUUID } from 'node:crypto';
import { logger } from '@revealui/core/utils/logger';
import type { Database } from '@revealui/db/client';
import { nodeIdMappings } from '@revealui/db/schema';
import { findNodeIdMappingByHash } from '../utils/sql-helpers.js';

export type EntityType = 'session' | 'user';

/**
 * Node ID Service
 */
export class NodeIdService {
  constructor(private db: Database) {}

  /**
   * Gets or creates a node ID for an entity.
   *
   * Strategy:
   * 1. Generate SHA-256 hash of entityId
   * 2. Check database for existing mapping
   * 3. If exists, return stored nodeId
   * 4. If not, create new mapping with UUID
   * 5. Handle collisions (same hash, different entityId)
   *
   * @param entityType - Type of entity ('session' or 'user')
   * @param entityId - Entity identifier (sessionId or userId)
   * @returns Node ID (UUID string)
   */
  async getNodeId(entityType: EntityType, entityId: string): Promise<string> {
    return this.withRetry(async () => {
      // Validate inputs
      this.validateInputs(entityType, entityId);

      // Generate SHA-256 hash
      const hash = this.hashEntityId(entityId);

      // Check database for existing mapping (using raw SQL for Neon HTTP compatibility)
      const existing = await findNodeIdMappingByHash(this.db, hash);

      if (existing) {
        // Verify entityId matches (collision detection)
        if (existing.entityId !== entityId || existing.entityType !== entityType) {
          // Collision detected - resolve it
          return this.resolveCollision(hash, entityType, entityId, 1);
        }
        // Return existing node ID
        return existing.nodeId;
      }

      // No existing mapping - create new one
      const newNodeId = randomUUID();
      await this.db.insert(nodeIdMappings).values({
        id: hash,
        entityType,
        entityId,
        nodeId: newNodeId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return newNodeId;
    });
  }

  /**
   * Resolves a hash collision (same hash, different entityId).
   *
   * Strategy: Generate a new hash using entityType + entityId to ensure uniqueness.
   *
   * @param hash - Original hash that collided
   * @param entityType - Type of entity
   * @param entityId - Entity identifier
   * @param attempt - Current collision resolution attempt (default: 1)
   * @returns Node ID (UUID string)
   * @throws Error if max collision attempts exceeded
   */
  private async resolveCollision(
    hash: string,
    entityType: EntityType,
    entityId: string,
    attempt: number = 1,
  ): Promise<string> {
    const MaxCollisionAttempts = 10;

    if (attempt > MaxCollisionAttempts) {
      throw new Error(
        `Failed to resolve node ID collision after ${MaxCollisionAttempts} attempts. ` +
          `This is extremely rare. Please contact support.`,
      );
    }

    // Log collision for monitoring
    logger.warn('Node ID collision detected', {
      attempt,
      maxAttempts: MaxCollisionAttempts,
      hash,
      entityType,
      entityId,
    });

    // Generate collision-resistant hash using entityType + entityId
    const collisionHash = this.hashEntityId(`${entityType}:${entityId}:${attempt}`);

    // Check if collision hash already exists (using raw SQL for Neon HTTP compatibility)
    const existing = await findNodeIdMappingByHash(this.db, collisionHash);

    if (existing) {
      // Verify this is actually our entity (not another collision)
      if (existing.entityId === entityId && existing.entityType === entityType) {
        // This is our mapping - use it
        return existing.nodeId;
      }
      // Another collision - recurse with incremented attempt
      return this.resolveCollision(collisionHash, entityType, entityId, attempt + 1);
    }

    // Create new mapping with collision hash
    const newNodeId = randomUUID();
    await this.db.insert(nodeIdMappings).values({
      id: collisionHash,
      entityType,
      entityId,
      nodeId: newNodeId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return newNodeId;
  }

  /**
   * Generates SHA-256 hash of entity ID.
   *
   * @param entityId - Entity identifier
   * @returns Hexadecimal hash string (64 characters)
   */
  private hashEntityId(entityId: string): string {
    return createHash('sha256').update(entityId).digest('hex');
  }

  /**
   * Validates input parameters.
   *
   * @param entityType - Type of entity
   * @param entityId - Entity identifier
   * @throws Error if inputs are invalid
   */
  private validateInputs(entityType: string, entityId: string): void {
    if (entityType !== 'session' && entityType !== 'user') {
      throw new Error(`Invalid entityType: ${entityType}. Must be 'session' or 'user'`);
    }

    if (!entityId || typeof entityId !== 'string' || entityId.trim().length === 0) {
      throw new Error(`Invalid entityId: must be a non-empty string`);
    }

    // Additional validation: entityId should be reasonable length
    // Very long entityIds might indicate an attack or data corruption
    const MaxEntityIdLength = 1000;
    if (entityId.length > MaxEntityIdLength) {
      throw new Error(
        `Invalid entityId: length ${entityId.length} exceeds maximum of ${MaxEntityIdLength} characters`,
      );
    }
  }

  /**
   * Retry wrapper for database operations with exponential backoff.
   *
   * @param operation - Async operation to retry
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param baseDelay - Base delay in milliseconds for exponential backoff (default: 100)
   * @returns Result of the operation
   * @throws Error if all retries fail
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 100,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on validation errors
        if (lastError.message.includes('Invalid')) {
          throw lastError;
        }

        // Don't retry on collision resolution limit exceeded
        if (lastError.message.includes('Failed to resolve node ID collision')) {
          throw lastError;
        }

        // Exponential backoff: 100ms, 200ms, 400ms
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * 2 ** attempt;
          logger.warn('Database operation failed, retrying', {
            attempt: attempt + 1,
            maxRetries,
            delay,
            error: lastError.message,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Database operation failed after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }
}
