/**
 * Memory-layer query helpers
 *
 * Small, typed helpers for lookups performed by the agent-memory persistence
 * layer. Every helper returns a Drizzle-inferred row shape — no manual
 * snake_case → camelCase transformation needed.
 *
 * History: originally written with `db.execute(sql`…`)` + hand-rolled result
 * unwrapping as a defensive posture against an early Neon HTTP driver
 * incompatibility with Drizzle's relational query builder (`db.query.*`).
 * Ported to the core query builder (`db.select().from(…).where(…).limit(1)`)
 * in Phase 6.1 — the same callers already use `.update()` and `.insert()`
 * against the same tables on the same Database client without issue, and the
 * core builder is a different code path from the relational one.
 */

import type { NodeIdMappingsRow } from '@revealui/contracts/generated';
import type { Database } from '@revealui/db/client';
import type { AgentContext, User } from '@revealui/db/schema';
import { agentContexts, nodeIdMappings, users } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';

// =============================================================================
// Node ID Mappings Queries
// =============================================================================

/**
 * Finds a node ID mapping by hash (primary key).
 *
 * @param db - Database client
 * @param hash - SHA-256 hash of entity ID
 * @returns Node ID mapping or undefined if not found
 */
export async function findNodeIdMappingByHash(
  db: Database,
  hash: string,
): Promise<NodeIdMappingsRow | undefined> {
  const [row] = await db.select().from(nodeIdMappings).where(eq(nodeIdMappings.id, hash)).limit(1);
  return row as NodeIdMappingsRow | undefined;
}

/**
 * Finds a node ID mapping by entity type + entity ID.
 *
 * @param db - Database client
 * @param entityType - Type of entity ('session' or 'user')
 * @param entityId - Entity identifier
 * @returns Node ID mapping or undefined if not found
 */
export async function findNodeIdMappingByEntity(
  db: Database,
  entityType: 'session' | 'user',
  entityId: string,
): Promise<NodeIdMappingsRow | undefined> {
  const [row] = await db
    .select()
    .from(nodeIdMappings)
    .where(and(eq(nodeIdMappings.entityType, entityType), eq(nodeIdMappings.entityId, entityId)))
    .limit(1);
  return row as NodeIdMappingsRow | undefined;
}

// =============================================================================
// Agent Contexts Queries
// =============================================================================

/**
 * Finds an agent context by CRDT ID.
 *
 * @param db - Database client
 * @param crdtId - CRDT identifier (format: sessionId:agentId)
 * @returns Agent context row or undefined if not found
 */
export async function findAgentContextById(
  db: Database,
  crdtId: string,
): Promise<AgentContext | undefined> {
  const [row] = await db.select().from(agentContexts).where(eq(agentContexts.id, crdtId)).limit(1);
  return row;
}

// =============================================================================
// Users Queries
// =============================================================================

/**
 * Finds a user by ID, returning only the columns the memory layer needs.
 *
 * @param db - Database client
 * @param userId - User identifier
 * @returns User record (id + preferences) or undefined if not found
 */
export async function findUserById(
  db: Database,
  userId: string,
): Promise<Pick<User, 'id' | 'preferences'> | undefined> {
  const [row] = await db
    .select({ id: users.id, preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}
