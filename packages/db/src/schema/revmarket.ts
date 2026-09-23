/**
 * RevMarket  -  Autonomous Agent Marketplace Tables (Phase 5.16)
 *
 * Extends the MCP Marketplace (Phase 5.5) with autonomous agent task execution.
 * Agents register with skills and pricing, users submit tasks, the system
 * matches tasks to capable agents, and results are delivered with billing.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

// =============================================================================
// Marketplace Agents  -  publishable autonomous agent definitions
// =============================================================================

export const marketplaceAgents = pgTable(
  'marketplace_agents',
  {
    /** Nanoid short ID (e.g. 'agent_abc123') */
    id: text('id').primaryKey(),

    /** Human-readable agent name */
    name: text('name').notNull(),

    /** What this agent does  -  shown in browse/search */
    description: text('description').notNull(),

    /** Publisher (developer who listed this agent) */
    publisherId: text('publisher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Version string (semver, e.g. '1.0.0') */
    version: text('version').notNull().default('0.1.0'),

    /** Agent definition (A2A-compatible JSON: capabilities, input/output modes, etc.) */
    definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),

    /** Pricing model: 'per-task' | 'per-minute' | 'flat' */
    pricingModel: text('pricing_model').notNull().default('per-task'),

    /** Base price in USDC (human-readable, e.g. '0.50') */
    basePriceUsdc: text('base_price_usdc').notNull().default('0.10'),

    /** Maximum execution time in seconds (SLA guarantee) */
    maxExecutionSecs: integer('max_execution_secs').notNull().default(300),

    /** Resource requirements (CPU, memory) for execution sandboxing */
    resourceLimits: jsonb('resource_limits')
      .$type<{ maxMemoryMb: number; maxCpuPercent: number }>()
      .default({ maxMemoryMb: 512, maxCpuPercent: 50 }),

    /** Average rating (1-5, updated on each review) */
    rating: real('rating').default(0),

    /** Total number of reviews */
    reviewCount: integer('review_count').notNull().default(0),

    /** Total tasks completed */
    taskCount: integer('task_count').notNull().default(0),

    /** Lifecycle: 'draft' | 'published' | 'suspended' | 'deprecated' */
    status: text('status').notNull().default('draft'),

    /** Category for filtering: 'coding' | 'writing' | 'data' | 'design' | 'other' */
    category: text('category').notNull().default('other'),

    /** Searchable tags */
    tags: text('tags').array().$type<string[]>().notNull().default([]),

    /** Stripe Connect account for payouts */
    stripeAccountId: text('stripe_account_id'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('marketplace_agents_publisher_id_idx').on(table.publisherId),
    index('marketplace_agents_status_idx').on(table.status),
    index('marketplace_agents_category_idx').on(table.category),
    index('marketplace_agents_rating_idx').on(table.rating),
    check(
      'marketplace_agents_pricing_model_check',
      sql`pricing_model IN ('per-task', 'per-minute', 'flat')`,
    ),
    check(
      'marketplace_agents_status_check',
      sql`status IN ('draft', 'published', 'suspended', 'deprecated')`,
    ),
    check(
      'marketplace_agents_category_check',
      sql`category IN ('coding', 'writing', 'data', 'design', 'other')`,
    ),
  ],
);

// =============================================================================
// Agent Skills  -  capabilities each agent advertises
// =============================================================================

export const agentSkills = pgTable(
  'agent_skills',
  {
    id: text('id').primaryKey(),

    /** Agent this skill belongs to */
    agentId: text('agent_id')
      .notNull()
      .references(() => marketplaceAgents.id, { onDelete: 'cascade' }),

    /** Skill name (e.g. 'code-review', 'content-writing', 'data-analysis') */
    name: text('name').notNull(),

    /** Human-readable description */
    description: text('description').notNull(),

    /** Input schema (JSON Schema describing expected task input) */
    inputSchema: jsonb('input_schema').$type<Record<string, unknown>>(),

    /** Output schema (JSON Schema describing expected task output) */
    outputSchema: jsonb('output_schema').$type<Record<string, unknown>>(),

    /** Sample inputs for testing and validation */
    examples: jsonb('examples').$type<Array<{ input: unknown; output: unknown }>>().default([]),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('agent_skills_agent_id_idx').on(table.agentId),
    index('agent_skills_name_idx').on(table.name),
  ],
);

// =============================================================================
// Agent Reviews  -  user ratings and feedback
// =============================================================================

export const agentReviews = pgTable(
  'agent_reviews',
  {
    id: text('id').primaryKey(),

    /** Agent being reviewed */
    agentId: text('agent_id')
      .notNull()
      .references(() => marketplaceAgents.id, { onDelete: 'cascade' }),

    /** User who wrote the review */
    reviewerId: text('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Task that prompted this review */
    taskId: text('task_id'),

    /** 1-5 star rating */
    rating: integer('rating').notNull(),

    /** Optional written review */
    comment: text('comment'),

    /** Verified purchase (user actually ran a task with this agent) */
    verified: integer('verified').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('agent_reviews_agent_id_idx').on(table.agentId),
    index('agent_reviews_reviewer_id_idx').on(table.reviewerId),
  ],
);

// =============================================================================
// Task Submissions  -  user requests for agent work
// =============================================================================

export const taskSubmissions = pgTable(
  'task_submissions',
  {
    id: text('id').primaryKey(),

    /** User who submitted the task */
    submitterId: text('submitter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Agent assigned to this task (null if pending matching) */
    agentId: text('agent_id').references(() => marketplaceAgents.id, { onDelete: 'set null' }),

    /** Skill requested (matches agent_skills.name) */
    skillName: text('skill_name').notNull(),

    /** Task description / prompt */
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),

    /** Structured output from the agent */
    output: jsonb('output').$type<Record<string, unknown>>(),

    /** Artifacts (file URLs, generated assets, etc.) */
    artifacts: jsonb('artifacts')
      .$type<Array<{ name: string; url: string; mimeType: string }>>()
      .default([]),

    /**
     * Task lifecycle:
     * - pending:    submitted, awaiting agent match
     * - queued:     agent assigned, waiting for execution slot
     * - running:    agent is executing
     * - completed:  agent finished successfully
     * - failed:     agent failed or timed out
     * - cancelled:  user cancelled before completion
     */
    status: text('status').notNull().default('pending'),

    /** Priority: 1 (low) to 5 (critical) */
    priority: integer('priority').notNull().default(3),

    /** Billing amount in USDC (set when agent is assigned) */
    costUsdc: text('cost_usdc'),

    /** Payment method used */
    paymentMethod: text('payment_method'),

    /** Execution metadata (start/end times, tokens used, retry count) */
    executionMeta: jsonb('execution_meta').$type<{
      startedAt?: string;
      completedAt?: string;
      durationMs?: number;
      tokensUsed?: number;
      retryCount?: number;
    }>(),

    /** Error message if status is 'failed' */
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .$onUpdateFn(() => new Date())
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('task_submissions_submitter_id_idx').on(table.submitterId),
    index('task_submissions_agent_id_idx').on(table.agentId),
    index('task_submissions_status_idx').on(table.status),
    index('task_submissions_skill_name_idx').on(table.skillName),
    index('task_submissions_created_at_idx').on(table.createdAt),
    check(
      'task_submissions_status_check',
      sql`status IN ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled')`,
    ),
  ],
);

// =============================================================================
// Type exports
// =============================================================================

export type MarketplaceAgent = typeof marketplaceAgents.$inferSelect;
export type NewMarketplaceAgent = typeof marketplaceAgents.$inferInsert;
export type AgentSkill = typeof agentSkills.$inferSelect;
export type NewAgentSkill = typeof agentSkills.$inferInsert;
export type AgentReview = typeof agentReviews.$inferSelect;
export type NewAgentReview = typeof agentReviews.$inferInsert;
// =============================================================================
// Publisher earnings + weekly Connect payouts
//
// One immutable earning per completed task (amount_usd_cents is insert-only).
// One paid payout per publisher per week. A failed payout row does not block
// the next attempt; earnings go back to accrued.
// =============================================================================

export const publisherPayouts = pgTable(
  'publisher_payouts',
  {
    id: text('id').primaryKey(),

    publisherId: text('publisher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Monday UTC date (YYYY-MM-DD) of the sweep week. */
    weekStart: text('week_start').notNull(),

    /** Stripe Transfer id. Null until the transfer succeeds. */
    stripeTransferId: text('stripe_transfer_id'),

    amountUsdCents: integer('amount_usd_cents').notNull(),

    /** pending: reserved; paid: transfer recorded; failed: earnings released. */
    status: text('status').notNull().default('pending'),

    earningIds: jsonb('earning_ids').$type<string[]>().notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    failedAt: timestamp('failed_at', { withTimezone: true }),
  },
  (table) => [
    index('publisher_payouts_publisher_week_idx').on(table.publisherId, table.weekStart),
    uniqueIndex('publisher_payouts_publisher_week_paid_uq')
      .on(table.publisherId, table.weekStart)
      .where(sql`status = 'paid'`),
    check('publisher_payouts_status_check', sql`status IN ('pending', 'paid', 'failed')`),
    check('publisher_payouts_amount_nonneg_check', sql`amount_usd_cents >= 0`),
  ],
);

export const publisherEarnings = pgTable(
  'publisher_earnings',
  {
    id: text('id').primaryKey(),

    publisherId: text('publisher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    agentId: text('agent_id').references(() => marketplaceAgents.id, { onDelete: 'set null' }),

    /** One earning per task. A second completion does not insert another row. */
    taskId: text('task_id')
      .notNull()
      .references(() => taskSubmissions.id, { onDelete: 'cascade' }),

    /** 80% share in USD cents. Insert-only: payout updates must not change this. */
    amountUsdCents: integer('amount_usd_cents').notNull(),

    /**
     * accrued: waiting for the weekly sweep
     * held_for_dispute: excluded until the hold clears
     * released_to_payout: selected for a transfer in flight
     * paid: included in a paid payout
     * dropped: removed (refund / dispute). Never an earning that can be paid.
     */
    status: text('status').notNull().default('accrued'),

    /** Earliest sweep time. Set to completion + 7 days so the dispute window holds. */
    payableAt: timestamp('payable_at', { withTimezone: true }).notNull(),

    payoutId: text('payout_id').references(() => publisherPayouts.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('publisher_earnings_task_id_uq').on(table.taskId),
    index('publisher_earnings_publisher_status_idx').on(table.publisherId, table.status),
    index('publisher_earnings_payable_at_idx').on(table.payableAt),
    index('publisher_earnings_payout_id_idx').on(table.payoutId),
    check(
      'publisher_earnings_status_check',
      sql`status IN ('accrued', 'held_for_dispute', 'released_to_payout', 'paid', 'dropped')`,
    ),
    check('publisher_earnings_amount_nonneg_check', sql`amount_usd_cents >= 0`),
  ],
);

// =============================================================================
// USDC-on-Base payment attempts, refunds, and disputes (GAP-162)
//
// One refund row per paid attempt. RevealCoin is not an asset on these tables.
// =============================================================================

export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: text('id').primaryKey(),

    customerId: text('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    taskId: text('task_id')
      .notNull()
      .references(() => taskSubmissions.id, { onDelete: 'cascade' }),

    amountUsdc: text('amount_usdc').notNull(),

    /** Only USDC on Base. RevealCoin is not accepted. */
    asset: text('asset').notNull().default('usdc-base'),

    /** paid: USDC was verified. not_charged: no money moved. */
    status: text('status').notNull().default('paid'),

    attemptNo: integer('attempt_no').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('payment_attempts_task_attempt_uq').on(table.taskId, table.attemptNo),
    index('payment_attempts_customer_idx').on(table.customerId),
    check('payment_attempts_status_check', sql`status IN ('paid', 'not_charged')`),
    check('payment_attempts_asset_check', sql`asset = 'usdc-base'`),
    check('payment_attempts_attempt_no_check', sql`attempt_no >= 1`),
  ],
);

export const revmarketRefunds = pgTable(
  'revmarket_refunds',
  {
    id: text('id').primaryKey(),

    paymentAttemptId: text('payment_attempt_id')
      .notNull()
      .references(() => paymentAttempts.id, { onDelete: 'cascade' }),

    customerId: text('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    taskId: text('task_id')
      .notNull()
      .references(() => taskSubmissions.id, { onDelete: 'cascade' }),

    reason: text('reason').notNull(),

    kind: text('kind').notNull(),

    amountUsdc: text('amount_usdc').notNull(),

    amountUsdCents: integer('amount_usd_cents').notNull(),

    /** auto: the system books it. awaiting_joshua: Joshua sends the USDC. */
    status: text('status').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('revmarket_refunds_attempt_uq').on(table.paymentAttemptId),
    index('revmarket_refunds_customer_created_idx').on(table.customerId, table.createdAt),
    check(
      'revmarket_refunds_kind_check',
      sql`kind IN ('auto_fail', 'cancel', 'dispute', 'cap_held')`,
    ),
    check('revmarket_refunds_status_check', sql`status IN ('auto', 'awaiting_joshua')`),
    check('revmarket_refunds_amount_nonneg_check', sql`amount_usd_cents >= 0`),
  ],
);

export const revmarketDisputes = pgTable(
  'revmarket_disputes',
  {
    id: text('id').primaryKey(),

    taskId: text('task_id')
      .notNull()
      .references(() => taskSubmissions.id, { onDelete: 'cascade' }),

    customerId: text('customer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    customerReason: text('customer_reason').notNull(),

    publisherReply: text('publisher_reply'),

    joshuaDecision: text('joshua_decision').notNull().default('pending'),

    /** Fourth dispute in 30 days. The dispute still opens. */
    abuseFlag: boolean('abuse_flag').notNull().default(false),

    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),

    windowEndsAt: timestamp('window_ends_at', { withTimezone: true }).notNull(),

    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (table) => [
    unique('revmarket_disputes_task_uq').on(table.taskId),
    index('revmarket_disputes_customer_opened_idx').on(table.customerId, table.openedAt),
    check(
      'revmarket_disputes_decision_check',
      sql`joshua_decision IN ('pending', 'refund', 'deny')`,
    ),
  ],
);

export type TaskSubmission = typeof taskSubmissions.$inferSelect;
export type NewTaskSubmission = typeof taskSubmissions.$inferInsert;
export type PublisherEarning = typeof publisherEarnings.$inferSelect;
export type NewPublisherEarning = typeof publisherEarnings.$inferInsert;
export type PublisherPayout = typeof publisherPayouts.$inferSelect;
export type NewPublisherPayout = typeof publisherPayouts.$inferInsert;
export type PaymentAttempt = typeof paymentAttempts.$inferSelect;
export type NewPaymentAttempt = typeof paymentAttempts.$inferInsert;
export type RevmarketRefund = typeof revmarketRefunds.$inferSelect;
export type NewRevmarketRefund = typeof revmarketRefunds.$inferInsert;
export type RevmarketDispute = typeof revmarketDisputes.$inferSelect;
export type NewRevmarketDispute = typeof revmarketDisputes.$inferInsert;
