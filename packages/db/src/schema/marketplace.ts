/**
 * MCP Marketplace Tables (Phase 5.5)
 *
 * Community developers publish MCP servers with a per-call price.
 * RevealUI acts as a payment proxy: callers pay via x402 (USDC on Base),
 * RevealUI takes 20%, developer earns 80%.
 *
 * Payment batching: individual USDC micropayments accumulate in
 * marketplace_transactions. Stripe Connect transfers are batched
 * (daily/weekly) rather than immediate  -  Stripe's minimum transfer is $0.50
 * which exceeds typical per-call amounts.
 */

import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

// =============================================================================
// Marketplace Servers
// =============================================================================

/**
 * Registry of community-published MCP servers available through the marketplace.
 * Each server has a per-call price in USDC; callers pay via x402.
 */
export const marketplaceServers = pgTable(
  'marketplace_servers',
  {
    /** Nanoid-style short ID (e.g. 'mcp_abc123xyz') */
    id: text('id').primaryKey(),

    /** Human-readable display name */
    name: text('name').notNull(),

    /** Short description of what the server does */
    description: text('description').notNull(),

    /**
     * Canonical MCP server endpoint (HTTPS required in production).
     * Kept internal  -  callers invoke via /api/marketplace/servers/:id/invoke.
     */
    url: text('url').notNull(),

    /** Top-level category for discovery filtering */
    category: text('category').notNull().default('other'),

    /** Searchable tags */
    tags: text('tags').array().$type<string[]>().notNull().default([]),

    /**
     * Per-call price in human-readable USDC (e.g. '0.005' = $0.005).
     * USDC has 6 decimal places; atomic units = price * 1_000_000.
     */
    pricePerCallUsdc: text('price_per_call_usdc').notNull().default('0.001'),

    /** User who published this server */
    developerId: text('developer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Stripe Connect Express account ID (acct_...).
     * Populated after the developer completes Connect onboarding.
     * Required before automatic payouts can be initiated.
     */
    stripeAccountId: text('stripe_account_id'),

    /**
     * Lifecycle status:
     * - pending:   newly published, not yet discoverable (reserved for future approval flow)
     * - active:    discoverable and callable
     * - suspended: temporarily hidden (admin action)
     */
    status: text('status').notNull().default('active'),

    /** Total successful invocations (incremented on each completed call) */
    callCount: integer('call_count').notNull().default(0),

    /** Arbitrary developer-supplied metadata (contact, docs URL, etc.) */
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  () => [
    check('marketplace_servers_status_check', sql`status IN ('pending', 'active', 'suspended')`),
  ],
);

// =============================================================================
// Marketplace Transactions
// =============================================================================

/**
 * Per-call payment ledger.
 * One row per successful marketplace invocation.
 * Used for developer earnings dashboards, payout calculations, and auditing.
 */
export const marketplaceTransactions = pgTable(
  'marketplace_transactions',
  {
    id: text('id').primaryKey(),

    /** Server that was called */
    serverId: text('server_id')
      .notNull()
      .references(() => marketplaceServers.id, { onDelete: 'cascade' }),

    /**
     * User who made the call, if authenticated.
     * Nullable  -  x402 payments can come from anonymous agents.
     */
    callerId: text('caller_id'),

    /** Total amount paid by caller in human-readable USDC */
    amountUsdc: text('amount_usdc').notNull(),

    /** Platform fee (20%) in human-readable USDC */
    platformFeeUsdc: text('platform_fee_usdc').notNull(),

    /** Developer earnings (80%) in human-readable USDC */
    developerAmountUsdc: text('developer_amount_usdc').notNull(),

    /**
     * Stripe transfer ID (tr_...) once a payout has been initiated.
     * Null until batch payout runs.
     */
    stripeTransferId: text('stripe_transfer_id'),

    /** Payment method used: 'x402' */
    paymentMethod: text('payment_method').notNull().default('x402'),

    /**
     * Transaction status:
     * - pending:   payment verified, server call in-flight
     * - completed: server responded successfully
     * - failed:    server call failed (payment still taken  -  refund flow TBD)
     */
    status: text('status').notNull().default('pending'),

    /** Additional context (request hash, network, etc.) */
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('marketplace_transactions_server_id_idx').on(table.serverId),
    index('marketplace_transactions_status_idx').on(table.status),
    index('marketplace_transactions_created_at_idx').on(table.createdAt),
    check(
      'marketplace_transactions_status_check',
      sql`status IN ('pending', 'completed', 'failed')`,
    ),
  ],
);

// =============================================================================
// Type exports
// =============================================================================

export type MarketplaceServer = typeof marketplaceServers.$inferSelect;
export type NewMarketplaceServer = typeof marketplaceServers.$inferInsert;
export type MarketplaceTransaction = typeof marketplaceTransactions.$inferSelect;
export type NewMarketplaceTransaction = typeof marketplaceTransactions.$inferInsert;
