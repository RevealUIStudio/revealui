/**
 * Password Reset Tokens table
 *
 * Stores temporary tokens for password reset flows.
 * Tokens are single-use and expire after a configured time.
 * Token values are stored as hashes (SHA-256) for security.
 */
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';
// =============================================================================
// Password Reset Tokens Table
// =============================================================================
export const passwordResetTokens = pgTable('password_reset_tokens', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
//# sourceMappingURL=password-reset-tokens.js.map