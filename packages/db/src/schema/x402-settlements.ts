/**
 * Durable x402 settlement records.
 *
 * One row per settled payment authorization. The payment nonce is unique so a
 * second presentation of the same signed payload cannot create another row.
 */

import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const X402_SETTLEMENT_STATUSES = ['settled'] as const;

export type X402SettlementStatus = (typeof X402_SETTLEMENT_STATUSES)[number];

export const x402Settlements = pgTable(
  'x402_settlements',
  {
    id: text('id').primaryKey(),

    /** EIP-3009 authorization nonce, or another unique payment identifier. */
    paymentNonce: text('payment_nonce').notNull(),

    /** Facilitator settlement transaction hash. */
    txHash: text('tx_hash').notNull(),

    /** Settled amount in USDC atomic units (6 decimals). */
    amount: text('amount').notNull(),

    /** Payer address from the signed authorization. */
    payer: text('payer').notNull(),

    /** Canonical resource URL this settlement pays for. */
    resource: text('resource').notNull(),

    /** Settlement status. Only a settled row can back a developer payout. */
    status: text('status').$type<X402SettlementStatus>().notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('x402_settlements_payment_nonce_uidx').on(table.paymentNonce),
    check('x402_settlements_status_check', sql`status IN ('settled')`),
  ],
);

export type X402Settlement = typeof x402Settlements.$inferSelect;
export type NewX402Settlement = typeof x402Settlements.$inferInsert;
