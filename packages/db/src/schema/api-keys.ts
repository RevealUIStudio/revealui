/**
 * API Key tables  -  encrypted credential storage for inference endpoints
 *
 * Server-side AES-256-GCM envelope encryption for background agent workflows.
 * Keys are encrypted at rest with a KEK from REVEALUI_KEK env var.
 * Only the last 4 characters are stored in plaintext (keyHint) for UI display.
 */

import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

// =============================================================================
// User API Keys Table
// =============================================================================

export const userApiKeys = pgTable(
  'user_api_keys',
  {
    id: text('id').primaryKey(),

    // Owner
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Which LLM provider this key belongs to
    provider: text('provider').notNull(), // 'ollama' | 'huggingface' | 'vultr' | 'inference-snaps'

    // AES-256-GCM envelope-encrypted API key
    // Format: <base64(iv)>.<base64(authTag)>.<base64(ciphertext)>
    encryptedKey: text('encrypted_key').notNull(),

    // Last 4 characters of the plaintext key shown in the UI (e.g. "...ab12")
    keyHint: text('key_hint'),

    // User-visible label (e.g. "My Anthropic key")
    label: text('label'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),

    // Soft-delete: null = active, timestamp = when revoked
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('user_api_keys_user_id_idx').on(table.userId),
    index('user_api_keys_user_provider_idx').on(table.userId, table.provider),
    index('user_api_keys_deleted_at_idx').on(table.deletedAt),
  ],
);

export type UserApiKey = typeof userApiKeys.$inferSelect;
export type NewUserApiKey = typeof userApiKeys.$inferInsert;

// =============================================================================
// Tenant Provider Configs Table
// =============================================================================

export const tenantProviderConfigs = pgTable(
  'tenant_provider_configs',
  {
    id: text('id').primaryKey(),

    // Owner
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Which LLM provider this config applies to
    provider: text('provider').notNull(),

    // Whether this is the default provider for this user's agents
    isDefault: boolean('is_default').notNull().default(false),

    // Preferred model override (e.g. "claude-sonnet-4-6", "gpt-4o")
    model: text('model'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [index('tenant_provider_configs_user_id_idx').on(table.userId)],
);

export type TenantProviderConfig = typeof tenantProviderConfigs.$inferSelect;
export type NewTenantProviderConfig = typeof tenantProviderConfigs.$inferInsert;
