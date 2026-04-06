/**
 * Coordination tables — Multi-agent workboard, sessions, events, work items.
 *
 * These tables are the server-side counterparts of the PGLite schema in
 * @revealui/harnesses. The daemon syncs local PGLite state to/from
 * these tables via ElectricSQL shape subscriptions.
 *
 * Used by: CMS dashboard (agent activity), Forge customers (multi-machine coordination)
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// =============================================================================
// Coordination Agents (persistent identities across sessions)
// =============================================================================

export const coordinationAgents = pgTable(
  'coordination_agents',
  {
    id: text('id').primaryKey(),
    env: text('env').notNull(),
    firstSeen: timestamp('first_seen', { withTimezone: true }).defaultNow().notNull(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).defaultNow().notNull(),
    totalSessions: integer('total_sessions').default(0).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [index('coordination_agents_last_seen_idx').on(table.lastSeen)],
);

// =============================================================================
// Coordination Sessions (active + historical)
// =============================================================================

export const coordinationSessions = pgTable(
  'coordination_sessions',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id')
      .notNull()
      .references(() => coordinationAgents.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    task: text('task').default('(starting)').notNull(),
    status: text('status').notNull().default('active'),
    pid: integer('pid'),
    tools: jsonb('tools').$type<Record<string, number>>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('coordination_sessions_agent_status_idx').on(table.agentId, table.status),
    index('coordination_sessions_started_at_idx').on(table.startedAt),
  ],
);

// =============================================================================
// File Claims (advisory conflict detection)
// =============================================================================

export const coordinationFileClaims = pgTable(
  'coordination_file_claims',
  {
    filePath: text('file_path').notNull(),
    sessionId: text('session_id')
      .notNull()
      .references(() => coordinationSessions.id, { onDelete: 'cascade' }),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.filePath, table.sessionId] }),
    index('coordination_file_claims_session_id_idx').on(table.sessionId),
  ],
);

// =============================================================================
// Coordination Events (rich event log)
// =============================================================================

export const coordinationEvents = pgTable(
  'coordination_events',
  {
    id: serial('id').primaryKey(),
    sessionId: text('session_id').references(() => coordinationSessions.id),
    agentId: text('agent_id').notNull(),
    type: text('type').notNull(),
    level: text('level').default('info').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('coordination_events_agent_type_idx').on(table.agentId, table.type, table.createdAt),
  ],
);

// =============================================================================
// Work Items (atomic tasks with ownership)
// =============================================================================

export const coordinationWorkItems = pgTable(
  'coordination_work_items',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('open'),
    priority: integer('priority').default(0).notNull(),
    ownerAgent: text('owner_agent'),
    ownerSession: text('owner_session').references(() => coordinationSessions.id),
    parentId: text('parent_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [index('coordination_work_items_status_owner_idx').on(table.status, table.ownerAgent)],
);

// =============================================================================
// Inter-Agent Mail
// =============================================================================

export const coordinationMail = pgTable(
  'coordination_mail',
  {
    id: serial('id').primaryKey(),
    fromAgent: text('from_agent').notNull(),
    toAgent: text('to_agent').notNull(),
    subject: text('subject').notNull(),
    body: text('body'),
    read: boolean('read').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('coordination_mail_to_read_idx').on(table.toAgent, table.read)],
);

// =============================================================================
// Work Queues (priority-based message passing)
// =============================================================================

export const coordinationQueueItems = pgTable(
  'coordination_queue_items',
  {
    id: serial('id').primaryKey(),
    targetAgent: text('target_agent').notNull(),
    priority: text('priority').notNull().default('normal'),
    fromAgent: text('from_agent').notNull(),
    message: text('message').notNull(),
    consumed: boolean('consumed').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (table) => [
    index('coordination_queue_target_consumed_idx').on(table.targetAgent, table.consumed),
  ],
);

// =============================================================================
// Type exports
// =============================================================================

export type CoordinationAgent = typeof coordinationAgents.$inferSelect;
export type NewCoordinationAgent = typeof coordinationAgents.$inferInsert;
export type CoordinationSession = typeof coordinationSessions.$inferSelect;
export type NewCoordinationSession = typeof coordinationSessions.$inferInsert;
export type CoordinationFileClaim = typeof coordinationFileClaims.$inferSelect;
export type NewCoordinationFileClaim = typeof coordinationFileClaims.$inferInsert;
export type CoordinationEvent = typeof coordinationEvents.$inferSelect;
export type NewCoordinationEvent = typeof coordinationEvents.$inferInsert;
export type CoordinationWorkItem = typeof coordinationWorkItems.$inferSelect;
export type NewCoordinationWorkItem = typeof coordinationWorkItems.$inferInsert;
export type CoordinationMailMessage = typeof coordinationMail.$inferSelect;
export type NewCoordinationMailMessage = typeof coordinationMail.$inferInsert;
export type CoordinationQueueItem = typeof coordinationQueueItems.$inferSelect;
export type NewCoordinationQueueItem = typeof coordinationQueueItems.$inferInsert;
