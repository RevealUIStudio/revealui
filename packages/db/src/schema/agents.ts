/**
 * Agent tables - Derived from @revealui/contracts agents module
 *
 * These tables store AI agent context, memory, and conversations.
 * The schema structure mirrors the Zod schemas in @revealui/contracts/agents.
 *
 * Note: Vector columns require pgvector extension to be enabled in PostgreSQL.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sites } from './sites.js';
import { users } from './users.js';

// =============================================================================
// Custom Vector Type for pgvector
// =============================================================================

// Define vector type for embeddings (requires pgvector extension)
const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    return `vector(${(config as { dimensions: number })?.dimensions ?? 1536})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    // Parse PostgreSQL vector format: [1,2,3]
    const parsed = JSON.parse(value.replace(/^\[/, '[').replace(/\]$/, ']')) as number[];
    return parsed;
  },
});

// =============================================================================
// Agent Contexts Table
// =============================================================================

export const agentContexts = pgTable(
  'agent_contexts',
  {
    // Primary identifier (format: sessionId:agentId)
    id: text('id').primaryKey(),

    // Schema versioning
    version: integer('version').notNull().default(1),

    // Relationships
    sessionId: text('session_id')
      .notNull()
      .references(() => aiMemorySessions.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => registeredAgents.id, { onDelete: 'cascade' }),

    // Context data (JSON blob for working memory, focus, etc.)
    context: jsonb('context').default({}),

    // Priority for context retrieval (0-1)
    priority: real('priority').default(0.5),

    // Optional embedding for semantic retrieval
    embedding: vector('embedding', { dimensions: 768 }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('agent_contexts_session_id_idx').on(table.sessionId),
    index('agent_contexts_agent_id_idx').on(table.agentId),
  ],
);

// =============================================================================
// Agent Memories Table (Long-term memory)
// =============================================================================

export const agentMemories = pgTable(
  'agent_memories',
  {
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
    embedding: vector('embedding', { dimensions: 768 }),

    // Full embedding metadata (model, dimension, generatedAt)
    embeddingMetadata: jsonb('embedding_metadata'),

    // Metadata (importance, tags, expiry, etc.)
    metadata: jsonb('metadata').default({}),

    // Access tracking
    accessCount: integer('access_count').default(0),
    accessedAt: timestamp('accessed_at', { withTimezone: true }),

    // Verification status
    verified: boolean('verified').default(false),
    verifiedBy: text('verified_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),

    // Scope: which site/agent this memory applies to
    siteId: text('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    agentId: text('agent_id'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('agent_memories_site_id_idx').on(table.siteId),
    index('agent_memories_agent_id_idx').on(table.agentId),
    index('agent_memories_verified_idx').on(table.verified),
    index('agent_memories_expires_at_idx').on(table.expiresAt),
    index('agent_memories_type_idx').on(table.type),
  ],
);

// =============================================================================
// Conversations Table
// =============================================================================

export const conversations = pgTable(
  'conversations',
  {
    // Primary identifier
    id: text('id').primaryKey(),

    // Relationships
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: text('agent_id').notNull(),

    // Conversation details
    title: text('title'),
    status: text('status').notNull().default('active'),

    // Multi-device sync fields
    deviceId: text('device_id'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),

    // Schema versioning
    version: integer('version').notNull().default(1),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('conversations_user_id_idx').on(table.userId),
    index('conversations_status_idx').on(table.status),
  ],
);

// =============================================================================
// Messages Table (separate from conversations for sync)
// =============================================================================

export const messages = pgTable(
  'messages',
  {
    // Primary identifier
    id: text('id').primaryKey(),

    // Relationships
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),

    // Message content
    role: text('role').notNull(), // 'user', 'assistant', 'system'
    content: text('content').notNull(),

    // Timing
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('messages_conversation_id_idx').on(table.conversationId),
    index('messages_role_idx').on(table.role),
  ],
);

// =============================================================================
// User Devices Table (for multi-device sync)
// =============================================================================

export const userDevices = pgTable('user_devices', {
  // Primary identifier
  id: text('id').primaryKey(),

  // Relationships
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  deviceId: text('device_id').notNull().unique(),

  // Device information
  deviceName: text('device_name'),
  deviceType: text('device_type'), // 'desktop', 'mobile', 'tablet', 'cli'
  userAgent: text('user_agent'),

  // Device auth (Studio/CLI → API bearer token)
  tokenHash: text('token_hash'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  tokenIssuedAt: timestamp('token_issued_at', { withTimezone: true }),

  // Sync status
  lastSeen: timestamp('last_seen', { withTimezone: true }).defaultNow(),
  isActive: boolean('is_active').default(true),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .$onUpdateFn(() => new Date())
    .defaultNow()
    .notNull(),
});

// =============================================================================
// Sync Metadata Table (for tracking sync state)
// =============================================================================

export const syncMetadata = pgTable(
  'sync_metadata',
  {
    // Primary identifier
    id: text('id').primaryKey(),

    // Relationships
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Sync state
    lastSyncTimestamp: timestamp('last_sync_timestamp', {
      withTimezone: true,
    }).defaultNow(),
    syncVersion: integer('sync_version').default(1),
    deviceCount: integer('device_count').default(1),

    // Conflict tracking
    conflictsResolved: integer('conflicts_resolved').default(0),
    lastConflictAt: timestamp('last_conflict_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [index('sync_metadata_user_id_idx').on(table.userId)],
);

// =============================================================================
// Agent Actions Table (Audit log of agent actions)
// =============================================================================

export const agentActions = pgTable(
  'agent_actions',
  {
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
  },
  (table) => [
    index('agent_actions_conversation_id_idx').on(table.conversationId),
    index('agent_actions_agent_id_idx').on(table.agentId),
    index('agent_actions_status_idx').on(table.status),
  ],
);

// =============================================================================
// AI Memory Sessions Table (Ownership binding for CRDT memory sessions)
// =============================================================================

/**
 * Binds a CRDT working-memory sessionId to the user who created it.
 * Inserted on first POST to /api/memory/working/:sessionId or
 * /api/memory/context/:sessionId/:agentId; checked on every subsequent access.
 */
export const aiMemorySessions = pgTable('ai_memory_sessions', {
  // sessionId from the client (client-generated UUID)
  id: text('id').primaryKey(),

  // User who owns this session  -  enforced on read/write
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AiMemorySession = typeof aiMemorySessions.$inferSelect;
export type NewAiMemorySession = typeof aiMemorySessions.$inferInsert;

// =============================================================================
// Registered Agents Table (Persisted A2A agent definitions)
// =============================================================================

export const registeredAgents = pgTable(
  'registered_agents',
  {
    id: text('id').primaryKey(),
    definition: jsonb('definition').$type<unknown>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [index('registered_agents_updated_at_idx').on(table.updatedAt)],
);

// =============================================================================
// Type exports for Drizzle
// =============================================================================

// =============================================================================
// Agent Task Usage Table (Track B  -  metered billing)
// =============================================================================

/**
 * Tracks agent task execution counts per user per billing cycle.
 * Used by requireTaskQuota() middleware and the billing usage widget.
 * Composite PK (userId, cycleStart) means one row per user per month.
 */
export const agentTaskUsage = pgTable(
  'agent_task_usage',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** UTC timestamp of the first moment of the billing cycle (truncated to month). */
    cycleStart: timestamp('cycle_start', { withTimezone: true }).notNull(),

    /** Total tasks executed this cycle. */
    count: integer('count').notNull().default(0),

    /** Tasks beyond the tier quota (for overage billing). */
    overage: integer('overage').notNull().default(0),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.cycleStart] })],
);

export type AgentTaskUsage = typeof agentTaskUsage.$inferSelect;
export type NewAgentTaskUsage = typeof agentTaskUsage.$inferInsert;

// =============================================================================
// Agent Credit Balance (Track B  -  prepaid credit bundles)
// =============================================================================

/**
 * Tracks prepaid agent task credits purchased via credit bundles.
 * Credits never expire and stack with the monthly tier allowance.
 * One row per user  -  balance is decremented after tier quota is exhausted.
 */
export const agentCreditBalance = pgTable(
  'agent_credit_balance',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Total credits remaining (decremented on use after tier quota exhausted). */
    balance: integer('balance').notNull().default(0),

    /** Lifetime total credits ever purchased (for analytics). */
    totalPurchased: integer('total_purchased').notNull().default(0),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  () => [
    check('agent_credit_balance_non_negative', sql`balance >= 0`),
    check('agent_credit_total_non_negative', sql`total_purchased >= 0`),
  ],
);

export type AgentCreditBalance = typeof agentCreditBalance.$inferSelect;
export type NewAgentCreditBalance = typeof agentCreditBalance.$inferInsert;

export type AgentContext = typeof agentContexts.$inferSelect;
export type NewAgentContext = typeof agentContexts.$inferInsert;
export type AgentMemory = typeof agentMemories.$inferSelect;
export type NewAgentMemory = typeof agentMemories.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type UserDevice = typeof userDevices.$inferSelect;
export type NewUserDevice = typeof userDevices.$inferInsert;
export type SyncMetadata = typeof syncMetadata.$inferSelect;
export type NewSyncMetadata = typeof syncMetadata.$inferInsert;
export type AgentAction = typeof agentActions.$inferSelect;
export type NewAgentAction = typeof agentActions.$inferInsert;
export type RegisteredAgent = typeof registeredAgents.$inferSelect;
export type NewRegisteredAgent = typeof registeredAgents.$inferInsert;
