/**
 * Agent tables - Derived from @revealui/contracts agents module
 *
 * These tables store AI agent context, memory, and conversations.
 * The schema structure mirrors the Zod schemas in @revealui/contracts/agents.
 *
 * Note: Vector columns require pgvector extension to be enabled in PostgreSQL.
 */

import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { sites } from './sites'
import { users } from './users'

// =============================================================================
// Custom Vector Type for pgvector
// =============================================================================

// Define vector type for embeddings (requires pgvector extension)
const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    return `vector(${(config as { dimensions: number })?.dimensions ?? 1536})`
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`
  },
  fromDriver(value: string): number[] {
    // Parse PostgreSQL vector format: [1,2,3]
    const parsed = JSON.parse(value.replace(/^\[/, '[').replace(/\]$/, ']')) as number[]
    return parsed
  },
})

// =============================================================================
// Agent Contexts Table
// =============================================================================

export const agentContexts = pgTable('agent_contexts', {
  // Primary identifier (format: sessionId:agentId)
  id: text('id').primaryKey(),

  // Schema versioning
  version: integer('version').notNull().default(1),

  // Relationships
  sessionId: text('session_id').notNull(),
  agentId: text('agent_id').notNull(),

  // Context data (JSON blob for working memory, focus, etc.)
  context: jsonb('context').default({}),

  // Priority for context retrieval (0-1)
  priority: real('priority').default(0.5),

  // Optional embedding for semantic retrieval
  embedding: vector('embedding', { dimensions: 1536 }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// =============================================================================
// Agent Memories Table (Long-term memory)
// =============================================================================

export const agentMemories = pgTable('agent_memories', {
  // Primary identifier
  id: text('id').primaryKey(),

  // Schema versioning
  version: integer('version').notNull().default(1),

  // Memory content
  content: text('content').notNull(),

  // Memory type: fact, preference, decision, feedback, example, correction, skill, warning
  type: text('type').notNull(),

  // Source of this memory
  source: jsonb('source').notNull(),

  // Vector embedding for semantic search
  embedding: vector('embedding', { dimensions: 1536 }),

  // Full embedding metadata (model, dimension, generatedAt)
  embeddingMetadata: jsonb('embedding_metadata'),

  // Metadata (importance, tags, expiry, etc.)
  metadata: jsonb('metadata').default({}),

  // Access tracking
  accessCount: integer('access_count').default(0),
  accessedAt: timestamp('accessed_at', { withTimezone: true }),

  // Verification status
  verified: boolean('verified').default(false),
  verifiedBy: text('verified_by').references(() => users.id, { onDelete: 'set null' }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),

  // Scope: which site/agent this memory applies to
  siteId: text('site_id').references(() => sites.id, { onDelete: 'cascade' }),
  agentId: text('agent_id'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
})

// =============================================================================
// Conversations Table
// =============================================================================

export const conversations = pgTable('conversations', {
  // Primary identifier
  id: text('id').primaryKey(),

  // Schema versioning
  version: integer('version').notNull().default(1),

  // Relationships
  sessionId: text('session_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').notNull(),

  // Messages (JSON array of ConversationMessage objects)
  messages: jsonb('messages').$type<unknown[]>().default([]),

  // Status: active, paused, completed, abandoned
  status: text('status').notNull().default('active'),

  // Metadata (title, tags, summary, etc.)
  metadata: jsonb('metadata'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// =============================================================================
// Agent Actions Table (Audit log of agent actions)
// =============================================================================

export const agentActions = pgTable('agent_actions', {
  // Primary identifier
  id: text('id').primaryKey(),

  // Schema versioning
  version: integer('version').notNull().default(1),

  // Relationships
  conversationId: text('conversation_id').references(() => conversations.id, {
    onDelete: 'cascade',
  }),
  agentId: text('agent_id').notNull(),

  // Action details
  tool: text('tool').notNull(),
  params: jsonb('params'),
  result: jsonb('result'),

  // Status: pending, running, completed, failed, cancelled
  status: text('status').notNull().default('pending'),
  error: text('error'),

  // Timing
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),

  // Context for understanding the action
  reasoning: text('reasoning'),
  confidence: real('confidence'),
})

// =============================================================================
// Type exports for Drizzle
// =============================================================================

export type AgentContext = typeof agentContexts.$inferSelect
export type NewAgentContext = typeof agentContexts.$inferInsert
export type AgentMemory = typeof agentMemories.$inferSelect
export type NewAgentMemory = typeof agentMemories.$inferInsert
export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert
export type AgentAction = typeof agentActions.$inferSelect
export type NewAgentAction = typeof agentActions.$inferInsert
