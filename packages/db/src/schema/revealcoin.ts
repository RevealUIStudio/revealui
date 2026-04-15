/**
 * RevealCoin Payment Tables
 *
 * Tracks verified RVUI payments and price snapshots for anti-manipulation
 * safeguards (TWAP pricing, rate limiting, duplicate tx rejection, discount caps).
 */

import { sql } from 'drizzle-orm';
import { check, index, numeric, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

// =============================================================================
// RevealCoin Payments
// =============================================================================

export const revealcoinPayments = pgTable(
  'revealcoin_payments',
  {
    /** Unique payment ID (UUID). */
    id: text('id').primaryKey(),

    /** Solana transaction signature (base58). Unique  -  prevents replay. */
    txSignature: text('tx_signature').notNull(),

    /** Payer's Solana wallet address (base58 public key). */
    walletAddress: text('wallet_address').notNull(),

    /** RevealUI user who initiated the payment. */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** RVUI amount transferred (raw token units as string for precision). */
    amountRvui: text('amount_rvc').notNull(),

    /** USD equivalent at time of payment (TWAP-based). */
    amountUsd: numeric('amount_usd', { precision: 12, scale: 4 }).notNull(),

    /** USD discount applied (difference vs fiat price). */
    discountUsd: numeric('discount_usd', { precision: 12, scale: 4 }).notNull().default('0'),

    /** Payment purpose (e.g., 'subscription:pro', 'ai_credits', 'agent_task'). */
    purpose: text('purpose').notNull(),

    /** Payment verification status. */
    status: text('status').notNull().default('verified'),

    /** When the payment was recorded. */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('revealcoin_payments_tx_sig_idx').on(table.txSignature),
    index('revealcoin_payments_user_id_idx').on(table.userId),
    index('revealcoin_payments_wallet_idx').on(table.walletAddress),
    index('revealcoin_payments_created_at_idx').on(table.createdAt),
  ],
);

/** Row type for select queries. */
export type RevealcoinPaymentRow = typeof revealcoinPayments.$inferSelect;

/** Insert type for new records. */
export type RevealcoinPaymentInsert = typeof revealcoinPayments.$inferInsert;

// =============================================================================
// Price Snapshots (for TWAP calculation)
// =============================================================================

export const revealcoinPriceSnapshots = pgTable(
  'revealcoin_price_snapshots',
  {
    /** Unique snapshot ID (UUID). */
    id: text('id').primaryKey(),

    /** RVUI price in USD at this point in time. */
    priceUsd: numeric('price_usd', { precision: 18, scale: 8 }).notNull(),

    /** Price data source (e.g., 'jupiter', 'raydium', 'manual'). */
    source: text('source').notNull(),

    /** When this price was recorded. */
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('revealcoin_price_snapshots_recorded_at_idx').on(table.recordedAt),
    check(
      'revealcoin_price_snapshots_source_check',
      sql`source IN ('jupiter', 'raydium', 'manual')`,
    ),
  ],
);

/** Row type for select queries. */
export type RevealcoinPriceSnapshotRow = typeof revealcoinPriceSnapshots.$inferSelect;

/** Insert type for new records. */
export type RevealcoinPriceSnapshotInsert = typeof revealcoinPriceSnapshots.$inferInsert;
