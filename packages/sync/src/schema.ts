/**
 * ElectricSQL Schema Definitions
 *
 * Type definitions for ElectricSQL tables that mirror the Drizzle ORM schema
 * for agent tables. These types are used by ElectricSQL client and hooks.
 *
 * Note: ElectricSQL generates its schema from PostgreSQL migrations.
 * After running `pnpm dlx electric-sql generate`, the generated types will
 * be imported and used. Until then, these manual types are used as fallback.
 */

/**
 * Generated ElectricSQL database type.
 * This will be available after running `pnpm dlx electric-sql generate`.
 *
 * For now, we use the fallback type. Once generation is complete,
 * you can update this import to use the generated type.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - Generated file, may not exist yet
type GeneratedDatabaseType = unknown

// Note: We cannot dynamically import types in TypeScript.
// The generated types will need to be manually imported or the type system
// will use the fallback until generation is complete.

// =============================================================================
// Agent Context
// =============================================================================

export interface AgentContext {
  /** Primary identifier (format: sessionId:agentId) */
  id: string
  /** Schema version */
  version: number
  /** Session this context belongs to */
  session_id: string
  /** Agent that owns this context */
  agent_id: string
  /** Context data (JSONB) - structured for the specific agent */
  context: Record<string, unknown> | null
  /** Context priority (higher = more important) */
  priority: number | null
  /** When this context was created */
  created_at: Date
  /** When this context was last updated */
  updated_at: Date
}

// =============================================================================
// Agent Memory
// =============================================================================

export interface AgentMemory {
  /** Primary identifier */
  id: string
  /** Schema version */
  version: number
  /** Memory content */
  content: string
  /** Memory type: fact, preference, decision, feedback, example, correction, skill, warning */
  type: string
  /** Source of this memory (JSONB) */
  source: Record<string, unknown>
  /** Metadata (importance, tags, expiry, etc.) */
  metadata: Record<string, unknown> | null
  /** Access count */
  access_count: number | null
  /** Last access timestamp */
  accessed_at: Date | null
  /** Whether this memory has been verified by a human */
  verified: boolean | null
  /** User who verified this memory */
  verified_by: string | null
  /** When this memory was verified */
  verified_at: Date | null
  /** Related site ID */
  site_id: string | null
  /** Related agent ID */
  agent_id: string | null
  /** When this memory was created */
  created_at: Date
  /** When this memory expires */
  expires_at: Date | null
}

// =============================================================================
// Conversation
// =============================================================================

export interface Conversation {
  /** Primary identifier */
  id: string
  /** Schema version */
  version: number
  /** Session this conversation belongs to */
  session_id: string
  /** User involved in this conversation */
  user_id: string
  /** Agent involved in this conversation */
  agent_id: string
  /** Messages (JSON array) */
  messages: unknown[] | null
  /** Conversation status: active, paused, completed, abandoned */
  status: string
  /** Metadata (title, tags, summary, etc.) */
  metadata: Record<string, unknown> | null
  /** When this conversation was created */
  created_at: Date
  /** When this conversation was last updated */
  updated_at: Date
}

// =============================================================================
// Agent Action
// =============================================================================

export interface AgentAction {
  /** Primary identifier */
  id: string
  /** Schema version */
  version: number
  /** Related conversation ID */
  conversation_id: string | null
  /** Agent that took this action */
  agent_id: string
  /** Tool/action name */
  tool: string
  /** Parameters passed to the action */
  params: Record<string, unknown> | null
  /** Result of the action */
  result: Record<string, unknown> | null
  /** Action status: pending, running, completed, failed, cancelled */
  status: string
  /** Error message (if failed) */
  error: string | null
  /** When this action started */
  started_at: Date
  /** When this action completed */
  completed_at: Date | null
  /** Duration in milliseconds */
  duration_ms: number | null
  /** Reasoning/context for the action */
  reasoning: string | null
  /** Confidence score */
  confidence: number | null
}

// =============================================================================
// Database Schema Type
// =============================================================================

/**
 * Fallback Database interface for ElectricSQL.
 * Used when generated types are not yet available.
 *
 * Once ElectricSQL generates types from your PostgreSQL schema,
 * this will be replaced with the generated ElectricDatabase type.
 */
export interface DatabaseFallback {
  // ElectricSQL database instance methods
  unsafeExec(sql: string, params?: unknown[]): Promise<void>

  // Table accessors (will be properly typed after schema generation)
  agent_contexts: {
    liveMany(query?: { where?: Record<string, unknown> }): unknown
    liveFirst(query?: { where?: Record<string, unknown> }): unknown
    create(data: Partial<AgentContext>): Promise<AgentContext>
    update(query: { where: Record<string, unknown>; data: Partial<AgentContext> }): Promise<void>
    delete(query: { where: Record<string, unknown> }): Promise<void>
  }
  agent_memories: {
    liveMany(query?: {
      where?: Record<string, unknown>
      orderBy?: Record<string, string>
      take?: number
    }): unknown
    liveFirst(query?: { where?: Record<string, unknown> }): unknown
    create(data: Partial<AgentMemory>): Promise<AgentMemory>
    update(query: { where: Record<string, unknown>; data: Partial<AgentMemory> }): Promise<void>
    delete(query: { where: Record<string, unknown> }): Promise<void>
  }
  conversations: {
    liveMany(query?: {
      where?: Record<string, unknown>
      orderBy?: Record<string, string>
      take?: number
    }): unknown
    liveFirst(query?: { where?: Record<string, unknown> }): unknown
    create(data: Partial<Conversation>): Promise<Conversation>
    update(query: { where: Record<string, unknown>; data: Partial<Conversation> }): Promise<void>
    delete(query: { where: Record<string, unknown> }): Promise<void>
  }
  agent_actions: {
    liveMany(query?: { where?: Record<string, unknown> }): unknown
    liveFirst(query?: { where?: Record<string, unknown> }): unknown
    create(data: Partial<AgentAction>): Promise<AgentAction>
    update(query: { where: Record<string, unknown>; data: Partial<AgentAction> }): Promise<void>
    delete(query: { where: Record<string, unknown> }): Promise<void>
  }
}

/**
 * Database type for ElectricSQL.
 *
 * Before schema generation: Uses DatabaseFallback (manual type definitions)
 * After schema generation: Import and use GeneratedDatabaseType directly
 *
 * To use generated types:
 * 1. Run `pnpm dlx electric-sql generate`
 * 2. Update this file to import: `import type { ElectricDatabase } from '../../.electric/client'`
 * 3. Change export to: `export type Database = ElectricDatabase`
 *
 * For now, we use the fallback type which provides basic type safety
 * but may not match the exact generated API.
 */
export type Database = DatabaseFallback

// TODO: After running `pnpm dlx electric-sql generate`, update this to:
// import type { ElectricDatabase } from '../../.electric/client'
// export type Database = ElectricDatabase
