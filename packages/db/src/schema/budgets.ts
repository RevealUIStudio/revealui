/**
 * Customer spend controls (spec 02).
 *
 * These rows are the customer's own limits. Plan quotas (`agent_task_usage`)
 * stay the vendor entitlement and are not stored here.
 *
 * Scope identity (owner defaults, 2026-09-24):
 * - account: `accounts.id` (fleet-level budget)
 * - agent: stable registered agent id (`registered_agents.id`), not a per-ticket principal
 * - goal: root ticket id (`tickets.id` where `parent_ticket_id` IS NULL)
 *
 * An open `hard_stop` incident is the pause. There is no separate pause flag.
 * `run` caps stay in code (`maxSteps`, `chargeAction`, `maxIterations`).
 */

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';

export const BUDGET_SCOPE_TYPES = ['account', 'agent', 'goal'] as const;
export type BudgetScopeType = (typeof BUDGET_SCOPE_TYPES)[number];

export const BUDGET_METRICS = ['cost_micros', 'governed_actions', 'tasks'] as const;
export type BudgetMetric = (typeof BUDGET_METRICS)[number];

export const BUDGET_WINDOW_KINDS = ['calendar_month_utc', 'calendar_day_utc', 'lifetime'] as const;
export type BudgetWindowKind = (typeof BUDGET_WINDOW_KINDS)[number];

export const BUDGET_THRESHOLD_TYPES = ['warn', 'hard_stop'] as const;
export type BudgetThresholdType = (typeof BUDGET_THRESHOLD_TYPES)[number];

export const BUDGET_INCIDENT_STATUSES = ['open', 'resolved'] as const;
export type BudgetIncidentStatus = (typeof BUDGET_INCIDENT_STATUSES)[number];

export const BUDGET_RESOLUTIONS = [
  'limit_raised',
  'policy_deactivated',
  'override',
  'window_rolled',
] as const;
export type BudgetResolution = (typeof BUDGET_RESOLUTIONS)[number];

export const budgetPolicies = pgTable(
  'budget_policies',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    scopeType: text('scope_type').$type<BudgetScopeType>().notNull(),
    /** accountId, registered agent id, or root ticket id. */
    scopeId: text('scope_id').notNull(),
    metric: text('metric').$type<BudgetMetric>().notNull(),
    windowKind: text('window_kind').$type<BudgetWindowKind>().notNull(),
    limitAmount: bigint('limit_amount', { mode: 'number' }).notNull(),
    /** Null means warnings are off. When set, 1–99. Default for enabled warnings is 80. */
    warnPercent: integer('warn_percent'),
    hardStop: boolean('hard_stop').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    createdByUserId: text('created_by_user_id').notNull(),
    updatedByUserId: text('updated_by_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('budget_policies_scope_metric_window_uq').on(
      table.accountId,
      table.scopeType,
      table.scopeId,
      table.metric,
      table.windowKind,
    ),
    index('budget_policies_account_active_idx').on(table.accountId, table.isActive),
    check('budget_policies_scope_type_check', sql`scope_type IN ('account', 'agent', 'goal')`),
    check(
      'budget_policies_metric_check',
      sql`metric IN ('cost_micros', 'governed_actions', 'tasks')`,
    ),
    check(
      'budget_policies_window_check',
      sql`window_kind IN ('calendar_month_utc', 'calendar_day_utc', 'lifetime')`,
    ),
    check(
      'budget_policies_warn_check',
      sql`warn_percent IS NULL OR (warn_percent > 0 AND warn_percent < 100)`,
    ),
    check('budget_policies_limit_check', sql`limit_amount >= 0`),
  ],
);

export const budgetLedgers = pgTable(
  'budget_ledgers',
  {
    policyId: text('policy_id')
      .notNull()
      .references(() => budgetPolicies.id, { onDelete: 'cascade' }),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    spent: bigint('spent', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.policyId, table.windowStart] }),
    check('budget_ledgers_spent_check', sql`spent >= 0`),
  ],
);

export const budgetIncidents = pgTable(
  'budget_incidents',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    /**
     * CASCADE so an account delete can remove policies and their incidents
     * together. NO ACTION here deadlocks the account cascade (policies go
     * away while incidents still reference them).
     */
    policyId: text('policy_id')
      .notNull()
      .references(() => budgetPolicies.id, { onDelete: 'cascade' }),
    scopeType: text('scope_type').$type<BudgetScopeType>().notNull(),
    scopeId: text('scope_id').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    thresholdType: text('threshold_type').$type<BudgetThresholdType>().notNull(),
    amountLimit: bigint('amount_limit', { mode: 'number' }).notNull(),
    amountObserved: bigint('amount_observed', { mode: 'number' }).notNull(),
    status: text('status').$type<BudgetIncidentStatus>().notNull().default('open'),
    resolution: text('resolution').$type<BudgetResolution | null>(),
    resolvedByUserId: text('resolved_by_user_id'),
    openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('budget_incidents_policy_window_threshold_uq').on(
      table.policyId,
      table.windowStart,
      table.thresholdType,
    ),
    index('budget_incidents_scope_open_idx').on(
      table.accountId,
      table.scopeType,
      table.scopeId,
      table.status,
    ),
    check('budget_incidents_scope_type_check', sql`scope_type IN ('account', 'agent', 'goal')`),
    check('budget_incidents_threshold_check', sql`threshold_type IN ('warn', 'hard_stop')`),
    check('budget_incidents_status_check', sql`status IN ('open', 'resolved')`),
    check(
      'budget_incidents_resolution_check',
      sql`resolution IS NULL OR resolution IN ('limit_raised', 'policy_deactivated', 'override', 'window_rolled')`,
    ),
  ],
);

export type BudgetPolicy = typeof budgetPolicies.$inferSelect;
export type NewBudgetPolicy = typeof budgetPolicies.$inferInsert;
export type BudgetLedger = typeof budgetLedgers.$inferSelect;
export type NewBudgetLedger = typeof budgetLedgers.$inferInsert;
export type BudgetIncident = typeof budgetIncidents.$inferSelect;
export type NewBudgetIncident = typeof budgetIncidents.$inferInsert;
