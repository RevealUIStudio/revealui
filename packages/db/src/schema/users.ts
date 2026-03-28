/**
 * User and Session tables - Derived from @revealui/contracts UserSchema
 *
 * These tables store user accounts and authentication sessions.
 * The schema structure mirrors the Zod schemas in @revealui/contracts/entities.
 */

import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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

    // Email verification (grace period — login allowed, reminders shown)
    emailVerified: boolean('email_verified').default(false).notNull(),
    // SHA-256 hash of the raw verification token sent in the email link
    emailVerificationToken: text('email_verification_token'),
    emailVerificationTokenExpiresAt: timestamp('email_verification_token_expires_at', {
      withTimezone: true,
    }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),

    // Terms of Service acceptance (required for legal compliance)
    tosAcceptedAt: timestamp('tos_accepted_at', { withTimezone: true }),
    tosVersion: text('tos_version'), // e.g. '2026-03-01' — version accepted at signup

    // Stripe integration
    stripeCustomerId: text('stripe_customer_id'),

    // MFA/2FA (TOTP-based)
    mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
    mfaSecret: text('mfa_secret'), // Base32-encoded TOTP secret (encrypted at rest via DB-level encryption)
    mfaBackupCodes: jsonb('mfa_backup_codes').$type<string[]>(), // Bcrypt-hashed one-time recovery codes
    mfaVerifiedAt: timestamp('mfa_verified_at', { withTimezone: true }),

    // SSH terminal auth (Phase E — `ssh terminal.revealui.com`)
    sshKeyFingerprint: text('ssh_key_fingerprint'),

    // User preferences (JSON blob)
    preferences: jsonb('preferences'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),

    // Soft-delete: null = active, timestamp = when deleted
    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    // GDPR anonymization: null = not anonymized, timestamp = when PII was wiped
    anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),

    _json: jsonb('_json').default('{}'),
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    index('users_type_idx').on(table.type),
    index('users_status_idx').on(table.status),
    index('users_deleted_at_idx').on(table.deletedAt),
    index('users_status_deleted_at_idx').on(table.status, table.deletedAt),
    index('users_active_email_idx').on(table.email).where(sql`deleted_at IS NULL`),
    index('users_active_status_idx').on(table.status).where(sql`deleted_at IS NULL`),
    index('users_stripe_customer_id_idx').on(table.stripeCustomerId),
    index('users_ssh_key_fingerprint_idx').on(table.sshKeyFingerprint),
    index('users_email_verified_idx').on(table.emailVerified),
  ],
);

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

    // Extensible metadata (e.g., 2FA method used, passkey credential ID)
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    // Activity tracking
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    // Soft-delete: null = active, timestamp = when explicitly revoked
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_token_hash_idx').on(table.tokenHash),
    index('sessions_expires_at_idx').on(table.expiresAt),
    // R5-H6: Composite index for logout-all and session cleanup queries
    index('sessions_user_expires_idx').on(table.userId, table.expiresAt),
    index('sessions_deleted_at_idx').on(table.deletedAt),
  ],
);

// =============================================================================
// Type exports for Drizzle
// =============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
