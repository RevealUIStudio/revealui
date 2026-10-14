/**
 * Per-call LLM receipts.
 *
 * One row per model invocation. Stores model, provider, key source, token
 * counts, and an estimated cost. Prompt text, response text, and key
 * material are not columns on this table and must not be written here.
 */

import { sql } from 'drizzle-orm';
import { bigint, check, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';
import { users } from './users.js';

export const LLM_KEY_SOURCES = ['byok', 'site', 'env'] as const;
export type LlmKeySource = (typeof LLM_KEY_SOURCES)[number];

export const llmCallReceipts = pgTable(
  'llm_call_receipts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
    /** Call site label, for example admin.chat. Not prompt content. */
    route: text('route').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    keySource: text('key_source').notNull().$type<LlmKeySource>(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    /** Estimated cost in millionths of one USD (1 USD = 1_000_000). */
    estimatedCostMicros: bigint('estimated_cost_micros', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('llm_call_receipts_user_id_idx').on(table.userId),
    index('llm_call_receipts_account_id_idx').on(table.accountId),
    index('llm_call_receipts_created_at_idx').on(table.createdAt),
    check('llm_call_receipts_key_source_check', sql`key_source IN ('byok', 'site', 'env')`),
  ],
);

export type LlmCallReceipt = typeof llmCallReceipts.$inferSelect;
export type NewLlmCallReceipt = typeof llmCallReceipts.$inferInsert;
