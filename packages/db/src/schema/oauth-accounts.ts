/**
 * OAuth Accounts table — linked provider identities per user
 *
 * Stores the mapping between local users and their OAuth provider accounts.
 * Supports multiple providers per user (Google, GitHub, Vercel, etc.).
 * Follows the same pattern as user_api_keys: separate table instead of
 * nullable columns on users to avoid table bloat.
 */

import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: text('id').primaryKey(),

    // Owner
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Provider identity
    provider: text('provider').notNull(), // 'google' | 'github' | 'vercel'
    providerUserId: text('provider_user_id').notNull(),
    providerEmail: text('provider_email'),
    providerName: text('provider_name'),
    providerAvatarUrl: text('provider_avatar_url'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),

    // Soft-delete: null = active, timestamp = when unlinked
    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    // GDPR anonymization: null = not anonymized, timestamp = when PII (providerEmail/Name/AvatarUrl) was wiped
    anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('oauth_accounts_provider_user_idx').on(t.provider, t.providerUserId),
    index('oauth_accounts_user_id_idx').on(t.userId),
    index('oauth_accounts_deleted_at_idx').on(t.deletedAt),
  ],
);

export type OauthAccount = typeof oauthAccounts.$inferSelect;
export type NewOauthAccount = typeof oauthAccounts.$inferInsert;
