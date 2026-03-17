/**
 * Magic Links table
 *
 * Stores single-use, time-limited tokens for passwordless email authentication.
 * Token values are stored as HMAC-SHA256 hashes with a per-token salt
 * for protection against rainbow table attacks on DB breach.
 */

import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

// =============================================================================
// Magic Links Table
// =============================================================================

export const magicLinks = pgTable(
  'magic_links',
  {
    id: text('id').primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // HMAC-SHA256 hash of the raw token sent in the email link
    tokenHash: text('token_hash').notNull(),
    // Per-token random salt used in HMAC-SHA256 hashing (16 bytes hex = 32 chars)
    tokenSalt: text('token_salt').notNull(),

    // Expiry and usage tracking
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('magic_links_user_id_idx').on(table.userId),
    uniqueIndex('magic_links_token_hash_idx').on(table.tokenHash),
    index('magic_links_expires_at_idx').on(table.expiresAt),
  ],
);

// =============================================================================
// Type exports for Drizzle
// =============================================================================

export type MagicLink = typeof magicLinks.$inferSelect;
export type NewMagicLink = typeof magicLinks.$inferInsert;
