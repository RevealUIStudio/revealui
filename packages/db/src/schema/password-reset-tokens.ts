/**
 * Password Reset Tokens table
 *
 * Stores temporary tokens for password reset flows.
 * Tokens are single-use and expire after a configured time.
 * Token values are stored as HMAC-SHA256 hashes with a per-token salt
 * for protection against rainbow table attacks on DB breach.
 */

import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

// =============================================================================
// Password Reset Tokens Table
// =============================================================================

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    tokenHash: text('token_hash').notNull().unique(),
    // Per-token random salt used in HMAC-SHA256 hashing (16 bytes hex = 32 chars)
    tokenSalt: text('token_salt').notNull().default(''),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // R5-H6: Index for cleanup queries that scan by expiry
    index('password_reset_tokens_expires_at_idx').on(table.expiresAt),
  ],
);

// =============================================================================
// Type exports for Drizzle
// =============================================================================

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
