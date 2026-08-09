/**
 * GAP-256 PR-1 — margin-aware admission schema (Layers 2+3 foundation).
 *
 * Tables:
 * - margin_snapshots — daily aggregate cost/revenue/mode for the governor
 * - account_margin_daily — per-account analytics rollup (cost ≠ agent_tasks)
 * - admission_waitlist — free-intake waitlist (NOT marketing `waitlist`)
 *
 * Also models account_entitlements COGS breaker columns (migration alters that table).
 *
 * @see docs/specs/2026-08-09-gap-256-margin-admission-layers-2-3.md (jv)
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';

/** Governor mode stored on each snapshot (and used as mode_at_enqueue). */
export type MarginGovernorMode = 'open' | 'lean' | 'waitlist';

export type AdmissionWaitlistStatus = 'pending' | 'invited' | 'converted' | 'cancelled' | 'expired';

/**
 * Daily platform margin snapshot. Hot path for admit reads the latest row only
 * (never live global COUNT of users).
 */
export const marginSnapshots = pgTable(
  'margin_snapshots',
  {
    id: text('id').primaryKey(),

    /** UTC calendar day this snapshot covers (unique). */
    periodDate: date('period_date').notNull(),

    freeCostCents: bigint('free_cost_cents', { mode: 'number' }).notNull().default(0),
    paidCostCents: bigint('paid_cost_cents', { mode: 'number' }).notNull().default(0),
    totalCostCents: bigint('total_cost_cents', { mode: 'number' }).notNull().default(0),
    revenueCents: bigint('revenue_cents', { mode: 'number' }).notNull().default(0),
    /** revenue - total_cost for the period */
    netCents: bigint('net_cents', { mode: 'number' }).notNull().default(0),
    /** Linear trend projection 7d ahead (cents); null when insufficient points */
    projected7dCents: bigint('projected_7d_cents', { mode: 'number' }),
    /**
     * free_cost / max(total_cost, 1) as a decimal string for portability
     * (e.g. "0.42"). Job writes; pure decide parses.
     */
    freeCostRatio: text('free_cost_ratio'),

    mode: text('mode').notNull().default('open').$type<MarginGovernorMode>(),

    /** Rate table used for this computation (auditability). */
    rates: jsonb('rates').$type<Record<string, unknown>>().notNull().default({}),
    /** Trend fit details (window size, slope, r2, points). */
    trend: jsonb('trend').$type<Record<string, unknown>>().notNull().default({}),

    accountCountFree: integer('account_count_free'),
    accountCountPaid: integer('account_count_paid'),

    computedAt: timestamp('computed_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('margin_snapshots_period_date_uidx').on(table.periodDate),
    index('margin_snapshots_computed_at_idx').on(table.computedAt),
    index('margin_snapshots_mode_idx').on(table.mode),
    check('margin_snapshots_mode_check', sql`mode IN ('open', 'lean', 'waitlist')`),
  ],
);

/**
 * Per-account daily cost/revenue rollup for analytics.
 * `cost_cents` uses the K8 usage_meters formula only; `agent_tasks` is separate.
 */
export const accountMarginDaily = pgTable(
  'account_margin_daily',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    periodDate: date('period_date').notNull(),
    costCents: bigint('cost_cents', { mode: 'number' }).notNull().default(0),
    /** Analytics only — never added into cost_cents (K8). */
    agentTasks: bigint('agent_tasks', { mode: 'number' }).notNull().default(0),
    revenueCents: bigint('revenue_cents', { mode: 'number' }).notNull().default(0),
    tier: text('tier'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('account_margin_daily_account_period_uidx').on(table.accountId, table.periodDate),
    index('account_margin_daily_period_date_idx').on(table.periodDate),
    index('account_margin_daily_account_id_idx').on(table.accountId),
  ],
);

/**
 * Free-intake waitlist under margin pressure.
 * Distinct from marketing `waitlist` (landing emails).
 */
export const admissionWaitlist = pgTable(
  'admission_waitlist',
  {
    id: text('id').primaryKey(),
    /** Normalized lower/trim email */
    email: text('email').notNull(),
    status: text('status').notNull().default('pending').$type<AdmissionWaitlistStatus>(),
    /** SHA-256 of one-time claim token; raw token never stored */
    tokenHash: text('token_hash').notNull(),
    snapshotId: text('snapshot_id'),
    modeAtEnqueue: text('mode_at_enqueue').notNull().default('waitlist'),
    position: integer('position'),
    source: text('source').notNull().default('free_signup'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    convertedAt: timestamp('converted_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('admission_waitlist_status_created_idx').on(table.status, table.createdAt),
    index('admission_waitlist_email_idx').on(table.email),
    // Partial unique: one pending row per email (SQL migration + uniqueIndex where)
    uniqueIndex('admission_waitlist_email_pending_uidx')
      .on(table.email)
      .where(sql`status = 'pending'`),
    check(
      'admission_waitlist_status_check',
      sql`status IN ('pending', 'invited', 'converted', 'cancelled', 'expired')`,
    ),
  ],
);

export type MarginSnapshot = typeof marginSnapshots.$inferSelect;
export type NewMarginSnapshot = typeof marginSnapshots.$inferInsert;
export type AccountMarginDaily = typeof accountMarginDaily.$inferSelect;
export type NewAccountMarginDaily = typeof accountMarginDaily.$inferInsert;
export type AdmissionWaitlistRow = typeof admissionWaitlist.$inferSelect;
export type NewAdmissionWaitlistRow = typeof admissionWaitlist.$inferInsert;
