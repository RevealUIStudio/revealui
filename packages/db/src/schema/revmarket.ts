/**
 * RevMarket — Autonomous Agent Marketplace Tables (Phase 5.16)
 *
 * Extends the MCP Marketplace (Phase 5.5) with autonomous agent task execution.
 * Agents register with skills and pricing, users submit tasks, the system
 * matches tasks to capable agents, and results are delivered with billing.
 */

import { index, integer, jsonb, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

// =============================================================================
// Marketplace Agents — publishable autonomous agent definitions
// =============================================================================

export const marketplaceAgents = pgTable(
  'marketplace_agents',
  {
    /** Nanoid short ID (e.g. 'agent_abc123') */
    id: text('id').primaryKey(),

    /** Human-readable agent name */
    name: text('name').notNull(),

    /** What this agent does — shown in browse/search */
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
  ],
);

// =============================================================================
// Agent Skills — capabilities each agent advertises
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
// Agent Reviews — user ratings and feedback
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
// Task Submissions — user requests for agent work
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
export type TaskSubmission = typeof taskSubmissions.$inferSelect;
export type NewTaskSubmission = typeof taskSubmissions.$inferInsert;
