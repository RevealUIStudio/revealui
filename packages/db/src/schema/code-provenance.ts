/**
 * Code Provenance Tracking Schema
 *
 * Tracks authorship and review status of code at file/function granularity.
 * Designed for auditing AI-generated vs human-written code over time.
 *
 * Tables:
 * - codeProvenance: File-level authorship tracking
 * - codeReviews: Append-only review log per provenance entry
 */

import { sql } from 'drizzle-orm';
import { check, integer, jsonb, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';

// =============================================================================
// Code Provenance
// =============================================================================

export const codeProvenance = pgTable(
  'code_provenance',
  {
    id: text('id').primaryKey(),
    schemaVersion: text('schema_version').notNull().default('1'),

    /** Relative file path from repo root */
    filePath: text('file_path').notNull(),

    /** Optional function/class scope */
    functionName: text('function_name'),

    /** Optional line range */
    lineStart: integer('line_start'),
    lineEnd: integer('line_end'),

    /** Author type: ai_generated, human_written, ai_assisted, mixed */
    authorType: text('author_type').notNull(),

    /** AI model identifier (e.g. 'claude-opus-4.6') */
    aiModel: text('ai_model'),

    /** Claude Code session ID */
    aiSessionId: text('ai_session_id'),

    /** Git commit hash that introduced this code */
    gitCommitHash: text('git_commit_hash'),

    /** Git author name */
    gitAuthor: text('git_author'),

    /** Confidence score 0-1 */
    confidence: real('confidence').notNull().default(1.0),

    /** Review status */
    reviewStatus: text('review_status').notNull().default('unreviewed'),

    /** Who reviewed it */
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),

    /** When it was reviewed */
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),

    /** Lines of code tracked */
    linesOfCode: integer('lines_of_code').notNull().default(0),

    /** Extensible metadata */
    metadata: jsonb('metadata').default('{}').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    check(
      'code_provenance_author_type_check',
      sql`author_type IN ('ai_generated', 'human_written', 'ai_assisted', 'mixed')`,
    ),
    check(
      'code_provenance_review_status_check',
      sql`review_status IN ('unreviewed', 'reviewed', 'approved', 'rejected')`,
    ),
  ],
);

export type CodeProvenance = typeof codeProvenance.$inferSelect;
export type NewCodeProvenance = typeof codeProvenance.$inferInsert;

// =============================================================================
// Code Reviews (append-only log)
// =============================================================================

export const codeReviews = pgTable(
  'code_reviews',
  {
    id: text('id').primaryKey(),

    /** Which provenance entry this review belongs to */
    provenanceId: text('provenance_id')
      .notNull()
      .references(() => codeProvenance.id, { onDelete: 'cascade' }),

    /** Reviewer (null for automated reviews) */
    reviewerId: text('reviewer_id').references(() => users.id, { onDelete: 'set null' }),

    /** Review type: human_review, ai_review, human_approval, ai_suggestion */
    reviewType: text('review_type').notNull(),

    /** Decision: approved, rejected, needs_changes, informational */
    status: text('status').notNull(),

    /** Optional review comment */
    comment: text('comment'),

    /** Extensible metadata */
    metadata: jsonb('metadata').default('{}').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'code_reviews_review_type_check',
      sql`review_type IN ('human_review', 'ai_review', 'human_approval', 'ai_suggestion')`,
    ),
    check(
      'code_reviews_status_check',
      sql`status IN ('approved', 'rejected', 'needs_changes', 'informational')`,
    ),
  ],
);

export type CodeReview = typeof codeReviews.$inferSelect;
export type NewCodeReview = typeof codeReviews.$inferInsert;
