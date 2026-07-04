/**
 * Goal harness contracts  -  Zod schemas and types for goal-driven coordination.
 *
 * A goal is a durable, verifiable objective. Acceptance criteria gate
 * completion (evidence is required to mark a criterion met), and progress
 * derives from the criteria plus the claimable daemon tasks linked to them.
 * The goal layer is propose-only: it emits tasks into the daemon task queue
 * for agents to claim and never spawns agents itself.
 */

import { z } from 'zod';
import type { GoalCriterionRow, GoalRow } from '../storage/schema.js';

export const GOAL_STATUSES = ['open', 'active', 'blocked', 'done', 'abandoned'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_PRIORITIES = ['blocker', 'high', 'medium', 'low'] as const;
export type GoalPriority = (typeof GOAL_PRIORITIES)[number];

export const GOAL_OWNERS = ['agent', 'human'] as const;
export type GoalOwner = (typeof GOAL_OWNERS)[number];

export const CRITERION_STATUSES = ['pending', 'met', 'failed'] as const;
export type CriterionStatus = (typeof CRITERION_STATUSES)[number];

export const GOAL_ACTIONS = ['propose-task', 'await-task', 'verify', 'rework'] as const;
export type GoalAction = (typeof GOAL_ACTIONS)[number];

/** Input contract for creating a goal (criteria are initial acceptance criteria). */
export const createGoalInputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).default(''),
  priority: z.enum(GOAL_PRIORITIES).default('medium'),
  owner: z.enum(GOAL_OWNERS).default('agent'),
  parentGoalId: z.string().min(1).optional(),
  blockedBy: z.array(z.string().min(1)).default([]),
  criteria: z.array(z.string().min(1).max(1000)).default([]),
});
export type CreateGoalInput = z.input<typeof createGoalInputSchema>;

/** A goal together with its acceptance criteria. */
export interface GoalWithCriteria {
  goal: GoalRow;
  criteria: GoalCriterionRow[];
}

/** Derived progress snapshot for a goal. */
export interface GoalProgress {
  goalId: string;
  status: GoalRow['status'];
  criteria: { total: number; met: number; failed: number; pending: number };
  tasks: { total: number; completed: number; claimed: number; open: number };
  /** 0-100, met criteria over total; 0 while no criteria exist. */
  percent: number;
  /** True when every criterion is met and every linked task is completed. */
  readyToComplete: boolean;
  /** Human-readable list of everything still gating completion. */
  unmet: string[];
}

/** One actionable next step derived from a goal's criterion state. */
export interface GoalActionItem {
  criterionId: string;
  description: string;
  action: GoalAction;
  taskId: string | null;
}
