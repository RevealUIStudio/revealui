/**
 * Onboarding Nudge Dismissals — server-tracked snooze state (GAP-300 §7).
 *
 * The BeforeDashboard nudge surface shows one per-tier, milestone-gated
 * nudge at a time. Dismissal is a snooze, not a kill: this table is the
 * server-side replacement for the OnboardingChecklist's `localStorage`
 * kill-switch pattern, which §1 flags as exactly wrong for this surface.
 *
 * One row per (user, nudge). `dismissCount` is capped at 2 by the writer:
 * the first dismissal snoozes for 48h (selection logic re-checks the
 * trigger after that window), the second retires the nudge permanently.
 */

import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const nudgeDismissals = pgTable(
  'nudge_dismissals',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** One of the NudgeId values in apps/server/src/lib/nudges/definitions.ts. */
    nudgeId: text('nudge_id').notNull(),

    /** 1 = snoozed 48h; 2 = permanently retired. Never exceeds 2. */
    dismissCount: integer('dismiss_count').notNull().default(1),

    lastDismissedAt: timestamp('last_dismissed_at', { withTimezone: true }).defaultNow().notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('nudge_dismissals_user_nudge_idx').on(table.userId, table.nudgeId),
    index('nudge_dismissals_user_id_idx').on(table.userId),
    check('nudge_dismissals_dismiss_count_check', sql`dismiss_count BETWEEN 1 AND 2`),
  ],
);

export type NudgeDismissal = typeof nudgeDismissals.$inferSelect;
export type NewNudgeDismissal = typeof nudgeDismissals.$inferInsert;
