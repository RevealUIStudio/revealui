/**
 * SQL Helper Utilities
 *
 * Provides type-safe raw SQL query helpers to work around Neon HTTP driver
 * compatibility issues with Drizzle's relational query builder.
 *
 * These helpers use Drizzle's sql tagged template for type safety and
 * SQL injection prevention.
 */

import type { AgentMemory } from '@revealui/contracts/agents';
import type { NodeIdMappingsRow } from '@revealui/contracts/generated';
import type { Database } from '@revealui/db/client';
import { sql } from 'drizzle-orm';

type QueryResult = unknown[] | { rows?: unknown[] };
type EmbeddingMetadataRow = {
  model: string;
  vector: number[];
  dimension: number;
  generatedAt: string;
};
type AgentMemoryRow = {
  id: string;
  version: number | null;
  content: string;
  type: string;
  source: unknown;
  embedding: number[] | null;
  embedding_metadata: EmbeddingMetadataRow | null;
  metadata: unknown;
  access_count: number | null;
  accessed_at: Date | null;
  verified: boolean | null;
  created_at: Date;
  expires_at: Date | null;
};
type AgentContextRow = {
  id: string;
  version: number | null;
  session_id: string;
  agent_id: string;
  context: unknown;
  priority: number | null;
  embedding: number[] | null;
  created_at: Date;
  updated_at: Date;
};

const getRows = (result: QueryResult): unknown[] => {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && typeof result === 'object' && Array.isArray(result.rows)) {
    return result.rows;
  }
  return [];
};

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
  const result = await db.execute(
    sql`SELECT id, entity_type, entity_id, node_id, created_at, updated_at
        FROM node_id_mappings
        WHERE id = ${hash}
        LIMIT 1`,
  );

  // Handle different result formats (Neon HTTP vs direct Postgres)
  const rows = getRows(result as QueryResult);
  if (!rows[0]) return undefined;

  // Transform snake_case to camelCase to match NodeIdMappingsRow type
  const row = rows[0] as {
    id: string;
    entity_type: string;
    entity_id: string;
    node_id: string;
    created_at: Date;
    updated_at: Date;
  };

  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    nodeId: row.node_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as NodeIdMappingsRow;
}

/**
 * Finds a node ID mapping by entity ID and type.
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
  const result = await db.execute(
    sql`SELECT id, entity_type, entity_id, node_id, created_at, updated_at
        FROM node_id_mappings
        WHERE entity_type = ${entityType} AND entity_id = ${entityId}
        LIMIT 1`,
  );

  const rows = getRows(result as QueryResult);
  if (!rows[0]) return undefined;

  // Transform snake_case to camelCase to match NodeIdMappingsRow type
  const row = rows[0] as {
    id: string;
    entity_type: string;
    entity_id: string;
    node_id: string;
    created_at: Date;
    updated_at: Date;
  };

  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    nodeId: row.node_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as NodeIdMappingsRow;
}

// =============================================================================
// Agent Memories Queries
// =============================================================================

/**
 * Finds an agent memory by ID (returns raw database record format).
 *
 * @deprecated Use VectorMemoryService.getById() instead. This function queries
 * agent_memories which is now in the vector database (Supabase), not REST database.
 * If you need to query memories, use VectorMemoryService which uses the correct database.
 *
 * @param db - Database client (NOTE: Should be vector client, but type doesn't enforce this)
 * @param memoryId - Memory identifier
 * @returns Raw database memory record or undefined if not found
 */
export async function findAgentMemoryById(
  db: Database,
  memoryId: string,
): Promise<
  | {
      id: string;
      version: number;
      content: string;
      type: string;
      source: unknown;
      embedding: number[] | null;
      embeddingMetadata: unknown;
      metadata: unknown;
      accessCount: number | null;
      accessedAt: Date | null;
      verified: boolean | null;
      createdAt: Date;
      expiresAt: Date | null;
    }
  | undefined
> {
  // NOTE: This queries agent_memories which is in vector database
  // Using raw SQL so it works, but caller must use vector client
  const result = await db.execute(
    sql`SELECT id, version, content, type, source, embedding, embedding_metadata, 
               metadata, access_count, accessed_at, verified, verified_by, 
               verified_at, site_id, agent_id, created_at, expires_at
        FROM agent_memories 
        WHERE id = ${memoryId} 
        LIMIT 1`,
  );

  const rows = getRows(result as QueryResult);
  if (!rows[0]) return undefined;

  const row = rows[0] as AgentMemoryRow;
  return {
    id: row.id,
    version: row.version || 1,
    content: row.content,
    type: row.type,
    source: row.source,
    embedding: row.embedding,
    embeddingMetadata: row.embedding_metadata,
    metadata: row.metadata,
    accessCount: row.access_count,
    accessedAt: row.accessed_at,
    verified: row.verified,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Finds agent memories by user ID.
 *
 * @deprecated Use VectorMemoryService.searchSimilar() or VectorMemoryService with filters instead.
 * This function queries agent_memories which is now in the vector database (Supabase).
 * If you need to query memories, use VectorMemoryService which uses the correct database.
 *
 * @param db - Database client (NOTE: Should be vector client, but type doesn't enforce this)
 * @param userId - User identifier
 * @returns Array of agent memories
 */
export async function findAgentMemoriesByUserId(
  db: Database,
  userId: string,
): Promise<AgentMemory[]> {
  const result = await db.execute(
    sql`SELECT id, version, content, type, source, embedding, embedding_metadata, 
               metadata, access_count, accessed_at, verified, verified_by, 
               verified_at, site_id, agent_id, created_at, expires_at
        FROM agent_memories 
        WHERE (source->>'id')::text = ${userId} 
        ORDER BY created_at DESC`,
  );

  const rows = getRows(result as QueryResult);
  return rows.map((row) => {
    const record = row as AgentMemoryRow;
    const metadata = record.embedding_metadata;
    return {
      id: record.id,
      version: record.version || 1,
      content: record.content,
      type: record.type,
      source: record.source,
      embedding: metadata
        ? {
            model: metadata.model,
            vector: record.embedding || metadata.vector,
            dimension: metadata.dimension,
            generatedAt: metadata.generatedAt,
          }
        : undefined,
      metadata: (record.metadata || {}) as AgentMemory['metadata'],
      accessedAt: record.accessed_at?.toISOString() || new Date().toISOString(),
      accessCount: record.access_count || 0,
      verified: record.verified ?? false,
      createdAt: record.created_at,
      expiresAt: record.expires_at,
    };
  }) as unknown as AgentMemory[];
}

// =============================================================================
// Agent Contexts Queries
// =============================================================================

/**
 * Finds an agent context by CRDT ID (returns raw database record format).
 *
 * @param db - Database client
 * @param crdtId - CRDT identifier (format: sessionId:agentId)
 * @returns Raw database context record or undefined if not found
 */
export async function findAgentContextById(
  db: Database,
  crdtId: string,
): Promise<
  | {
      id: string;
      version: number;
      sessionId: string;
      agentId: string;
      context: unknown;
      priority: number | null;
      embedding: number[] | null;
      createdAt: Date;
      updatedAt: Date;
    }
  | undefined
> {
  const result = await db.execute(
    sql`SELECT id, version, session_id, agent_id, context, priority, 
               embedding, created_at, updated_at
        FROM agent_contexts 
        WHERE id = ${crdtId} 
        LIMIT 1`,
  );

  const rows = getRows(result as QueryResult);
  if (!rows[0]) return undefined;

  const row = rows[0] as AgentContextRow;
  return {
    id: row.id,
    version: row.version || 1,
    sessionId: row.session_id,
    agentId: row.agent_id,
    context: row.context || {},
    priority: row.priority || 0.5,
    embedding: row.embedding,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// =============================================================================
// Users Queries
// =============================================================================

/**
 * Finds a user by ID.
 *
 * @param db - Database client
 * @param userId - User identifier
 * @returns User record or undefined if not found
 */
export async function findUserById(
  db: Database,
  userId: string,
): Promise<{ id: string; preferences: unknown } | undefined> {
  const result = await db.execute(
    sql`SELECT id, preferences 
        FROM users 
        WHERE id = ${userId} 
        LIMIT 1`,
  );

  const rows = getRows(result as QueryResult);
  return rows[0] as { id: string; preferences: unknown } | undefined;
}
