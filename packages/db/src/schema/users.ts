/**
 * User and Session tables - Derived from @revealui/contracts UserSchema
 *
 * These tables store user accounts and authentication sessions.
 * The schema structure mirrors the Zod schemas in @revealui/contracts/entities.
 */

import { boolean, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// =============================================================================
// Users Table
// =============================================================================

export const users = pgTable(
  'users',
  {
    // Primary identifier
    id: text('id').primaryKey(),

    // Schema versioning for migrations
    schemaVersion: text('schema_version').notNull().default('1'),

    // User type: human, agent, or system
    type: text('type').notNull().default('human'),

    // Basic info
    name: text('name').notNull(),
    email: text('email'),
    avatarUrl: text('avatar_url'),

    // Authentication
    password: text('password'), // Bcrypt hash of password (nullable for OAuth users)

    // Role and status
    role: text('role').notNull().default('viewer'),
    status: text('status').notNull().default('active'),

    // Agent-specific fields (nullable for human users)
    agentModel: text('agent_model'),
    agentCapabilities: jsonb('agent_capabilities').$type<string[]>(),
    agentConfig: jsonb('agent_config'),

    // User preferences (JSON blob)
    preferences: jsonb('preferences'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),

    // RevealUI/PayloadCMS compatibility - stores additional collection data
    _json: jsonb('_json').default('{}'),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_type_idx').on(table.type),
    index('users_status_idx').on(table.status),
  ],
)

// =============================================================================
// Sessions Table
// =============================================================================

export const sessions = pgTable(
  'sessions',
  {
    // Primary identifier
    id: text('id').primaryKey(),

    // Schema versioning
    schemaVersion: text('schema_version').notNull().default('1'),

    // Session relationships
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Token for session validation (hashed)
    tokenHash: text('token_hash').notNull(),

    // Session metadata
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    persistent: boolean('persistent').default(false),

    // Activity tracking
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_token_hash_idx').on(table.tokenHash),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
)

// =============================================================================
// Type exports for Drizzle
// =============================================================================

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
