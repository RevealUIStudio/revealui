/**
 * GoalHarness  -  goal-driven coordination engine over DaemonStore.
 *
 * Owns the goal lifecycle (open -> active -> done, with blocked/abandoned
 * branches), enforces fail-closed completion (every criterion met, every
 * linked task completed, evidence required for "met"), and derives progress
 * plus next actions for agents.
 *
 * Propose-only by design: the engine creates claimable rows in the daemon
 * `tasks` table and never spawns agents. Agent execution stays behind the
 * daemon's separately-gated agent surface.
 */

import { randomUUID } from 'node:crypto';
import type { DaemonStore } from '../storage/daemon-store.js';
import type { AgentTask, GoalCriterionRow, GoalRow } from '../storage/schema.js';
import type {
  CreateGoalInput,
  GoalActionItem,
  GoalOwner,
  GoalPriority,
  GoalProgress,
  GoalStatus,
  GoalWithCriteria,
} from './goal-schema.js';
import { createGoalInputSchema } from './goal-schema.js';

/** Options for constructing a GoalHarness. */
export interface GoalHarnessOptions {
  /** Initialized DaemonStore providing persistence. */
  store: DaemonStore;
  /** Agent identity recorded on events and criterion verifications. */
  agentId: string;
}

/** Result of a guarded goal state transition. */
export interface GoalTransitionResult {
  success: boolean;
  reason?: string;
  goal?: GoalRow;
  /** Blocker goal ids still unresolved (activateGoal only). */
  unresolvedBlockers?: string[];
  /** Everything still gating completion (completeGoal only). */
  unmet?: string[];
}

/** Result of a criterion mutation. */
export interface CriterionRecordResult {
  success: boolean;
  reason?: string;
  criterion?: GoalCriterionRow;
}

/** Result of proposing a claimable task for a criterion. */
export interface ProposeTaskResult {
  success: boolean;
  reason?: string;
  /** False when an existing live task was returned instead of a new one. */
  created?: boolean;
  task?: AgentTask;
  criterion?: GoalCriterionRow;
}

const TERMINAL_STATUSES: ReadonlySet<GoalStatus> = new Set(['done', 'abandoned']);

const ALLOWED_TRANSITIONS: ReadonlyMap<GoalStatus, ReadonlySet<GoalStatus>> = new Map<
  GoalStatus,
  ReadonlySet<GoalStatus>
>([
  ['open', new Set<GoalStatus>(['active', 'blocked', 'abandoned'])],
  ['active', new Set<GoalStatus>(['blocked', 'done', 'abandoned'])],
  ['blocked', new Set<GoalStatus>(['active', 'abandoned'])],
  ['done', new Set<GoalStatus>()],
  ['abandoned', new Set<GoalStatus>()],
]);

function canTransition(from: GoalStatus, to: GoalStatus): boolean {
  return ALLOWED_TRANSITIONS.get(from)?.has(to) ?? false;
}

export class GoalHarness {
  private readonly store: DaemonStore;
  private readonly agentId: string;

  constructor(options: GoalHarnessOptions) {
    this.store = options.store;
    this.agentId = options.agentId;
  }

  /** Create a goal with optional initial acceptance criteria. */
  async createGoal(input: CreateGoalInput): Promise<GoalWithCriteria> {
    const parsed = createGoalInputSchema.parse(input);
    const goalId = `goal-${randomUUID()}`;
    const goal = await this.store.createGoal({
      id: goalId,
      title: parsed.title,
      description: parsed.description,
      priority: parsed.priority,
      owner: parsed.owner,
      parentGoalId: parsed.parentGoalId,
      blockedBy: parsed.blockedBy,
      createdBy: this.agentId,
    });
    const criteria: GoalCriterionRow[] = [];
    for (const description of parsed.criteria) {
      criteria.push(
        await this.store.addGoalCriterion({ id: `crit-${randomUUID()}`, goalId, description }),
      );
    }
    await this.store.logEvent({
      agentId: this.agentId,
      eventType: 'goal.created',
      payload: { goalId, title: parsed.title, criteria: criteria.length },
    });
    return { goal, criteria };
  }

  /** Get a goal together with its criteria. */
  async getGoal(goalId: string): Promise<GoalWithCriteria | null> {
    const goal = await this.store.getGoal(goalId);
    if (!goal) return null;
    const criteria = await this.store.listGoalCriteria(goalId);
    return { goal, criteria };
  }

  /** List goals, optionally filtered. */
  async listGoals(filter?: {
    status?: GoalStatus;
    priority?: GoalPriority;
    owner?: GoalOwner;
    parentGoalId?: string;
  }): Promise<GoalRow[]> {
    return this.store.listGoals(filter);
  }

  /** Activate a goal. Refuses while any blocked-by goal is unresolved. */
  async activateGoal(goalId: string): Promise<GoalTransitionResult> {
    const goal = await this.store.getGoal(goalId);
    if (!goal) return { success: false, reason: `goal not found: ${goalId}` };
    if (!canTransition(goal.status, 'active')) {
      return { success: false, reason: `cannot activate a goal in status '${goal.status}'` };
    }
    const unresolved: string[] = [];
    for (const blockerId of goal.blocked_by) {
      const blocker = await this.store.getGoal(blockerId);
      if (!(blocker && TERMINAL_STATUSES.has(blocker.status))) {
        unresolved.push(blockerId);
      }
    }
    if (unresolved.length > 0) {
      return {
        success: false,
        reason: 'unresolved blockers',
        unresolvedBlockers: unresolved,
      };
    }
    const updated = await this.store.setGoalStatus(goalId, 'active', '');
    await this.store.logEvent({
      agentId: this.agentId,
      eventType: 'goal.activated',
      payload: { goalId },
    });
    return { success: true, goal: updated ?? undefined };
  }

  /** Block a goal with a reason. */
  async blockGoal(goalId: string, reason: string): Promise<GoalTransitionResult> {
    const goal = await this.store.getGoal(goalId);
    if (!goal) return { success: false, reason: `goal not found: ${goalId}` };
    if (!canTransition(goal.status, 'blocked')) {
      return { success: false, reason: `cannot block a goal in status '${goal.status}'` };
    }
    const updated = await this.store.setGoalStatus(goalId, 'blocked', reason);
    await this.store.logEvent({
      agentId: this.agentId,
      eventType: 'goal.blocked',
      payload: { goalId, reason },
    });
    return { success: true, goal: updated ?? undefined };
  }

  /** Abandon a goal with a reason (terminal). */
  async abandonGoal(goalId: string, reason: string): Promise<GoalTransitionResult> {
    const goal = await this.store.getGoal(goalId);
    if (!goal) return { success: false, reason: `goal not found: ${goalId}` };
    if (!canTransition(goal.status, 'abandoned')) {
      return { success: false, reason: `cannot abandon a goal in status '${goal.status}'` };
    }
    const updated = await this.store.setGoalStatus(goalId, 'abandoned', reason);
    await this.store.logEvent({
      agentId: this.agentId,
      eventType: 'goal.abandoned',
      payload: { goalId, reason },
    });
    return { success: true, goal: updated ?? undefined };
  }

  /**
   * Complete a goal. Fail-closed: refuses unless every criterion is met and
   * every linked task is completed (a goal with zero criteria never completes).
   */
  async completeGoal(goalId: string): Promise<GoalTransitionResult> {
    const goal = await this.store.getGoal(goalId);
    if (!goal) return { success: false, reason: `goal not found: ${goalId}` };
    if (!canTransition(goal.status, 'done')) {
      return { success: false, reason: `cannot complete a goal in status '${goal.status}'` };
    }
    const progress = await this.progress(goalId);
    if (!progress?.readyToComplete) {
      return {
        success: false,
        reason: 'completion gated by unmet acceptance criteria',
        unmet: progress?.unmet ?? [],
      };
    }
    const updated = await this.store.setGoalStatus(goalId, 'done', '');
    await this.store.logEvent({
      agentId: this.agentId,
      eventType: 'goal.completed',
      payload: { goalId },
    });
    return { success: true, goal: updated ?? undefined };
  }

  /** Add an acceptance criterion to a non-terminal goal. */
  async addCriterion(goalId: string, description: string): Promise<CriterionRecordResult> {
    const trimmed = description.trim();
    if (trimmed.length === 0) {
      return { success: false, reason: 'criterion description is required' };
    }
    const goal = await this.store.getGoal(goalId);
    if (!goal) return { success: false, reason: `goal not found: ${goalId}` };
    if (TERMINAL_STATUSES.has(goal.status)) {
      return { success: false, reason: `goal is terminal ('${goal.status}')` };
    }
    const criterion = await this.store.addGoalCriterion({
      id: `crit-${randomUUID()}`,
      goalId,
      description: trimmed,
    });
    await this.store.logEvent({
      agentId: this.agentId,
      eventType: 'goal.criterion-added',
      payload: { goalId, criterionId: criterion.id },
    });
    return { success: true, criterion };
  }

  /**
   * Record a criterion verdict. Marking a criterion met requires non-empty
   * evidence (what was run/observed)  -  claims without evidence are refused.
   */
  async recordCriterion(
    criterionId: string,
    verdict: 'met' | 'failed',
    evidence = '',
  ): Promise<CriterionRecordResult> {
    const criterion = await this.store.getGoalCriterion(criterionId);
    if (!criterion) return { success: false, reason: `criterion not found: ${criterionId}` };
    const goal = await this.store.getGoal(criterion.goal_id);
    if (goal && TERMINAL_STATUSES.has(goal.status)) {
      return { success: false, reason: `goal is terminal ('${goal.status}')` };
    }
    if (verdict === 'met' && evidence.trim().length === 0) {
      return { success: false, reason: 'evidence is required to mark a criterion met' };
    }
    const updated = await this.store.recordGoalCriterion({
      id: criterionId,
      status: verdict,
      evidence,
      verifiedBy: this.agentId,
    });
    if (!updated) return { success: false, reason: `criterion not found: ${criterionId}` };
    await this.store.logEvent({
      agentId: this.agentId,
      eventType: verdict === 'met' ? 'goal.criterion-met' : 'goal.criterion-failed',
      payload: { goalId: updated.goal_id, criterionId },
    });
    return { success: true, criterion: updated };
  }

  /** Reset a failed criterion to pending, clearing evidence and task link. */
  async resetCriterion(criterionId: string): Promise<CriterionRecordResult> {
    const criterion = await this.store.getGoalCriterion(criterionId);
    if (!criterion) return { success: false, reason: `criterion not found: ${criterionId}` };
    const goal = await this.store.getGoal(criterion.goal_id);
    if (goal && TERMINAL_STATUSES.has(goal.status)) {
      return { success: false, reason: `goal is terminal ('${goal.status}')` };
    }
    if (criterion.status !== 'failed') {
      return {
        success: false,
        reason: `only failed criteria can be reset (status: '${criterion.status}')`,
      };
    }
    const reset = await this.store.resetGoalCriterion(criterionId);
    if (!reset) return { success: false, reason: `criterion not found: ${criterionId}` };
    await this.store.logEvent({
      agentId: this.agentId,
      eventType: 'goal.criterion-reset',
      payload: { goalId: reset.goal_id, criterionId },
    });
    return { success: true, criterion: reset };
  }

  /**
   * Propose a claimable daemon task for a pending criterion of an active goal.
   * Idempotent while a live task is already linked (returns it, created=false).
   */
  async proposeTaskForCriterion(criterionId: string): Promise<ProposeTaskResult> {
    const criterion = await this.store.getGoalCriterion(criterionId);
    if (!criterion) return { success: false, reason: `criterion not found: ${criterionId}` };
    const goal = await this.store.getGoal(criterion.goal_id);
    if (!goal) return { success: false, reason: `goal not found: ${criterion.goal_id}` };
    if (goal.status !== 'active') {
      return {
        success: false,
        reason: `goal must be active to propose tasks (status: '${goal.status}')`,
      };
    }
    if (criterion.status !== 'pending') {
      return { success: false, reason: `criterion is '${criterion.status}', not pending` };
    }
    if (criterion.task_id) {
      const existing = await this.store.getTask(criterion.task_id);
      if (existing) return { success: true, created: false, task: existing, criterion };
    }
    const task = await this.store.createTask({
      id: `goal-task-${randomUUID()}`,
      description: `[goal ${goal.id}] ${goal.title} :: ${criterion.description}`,
    });
    const linked = await this.store.linkGoalCriterionTask(criterionId, task.id);
    await this.store.logEvent({
      agentId: this.agentId,
      eventType: 'goal.task-proposed',
      payload: { goalId: goal.id, criterionId, taskId: task.id },
    });
    return { success: true, created: true, task, criterion: linked ?? criterion };
  }

  /** Compute a progress snapshot for a goal. */
  async progress(goalId: string): Promise<GoalProgress | null> {
    const goal = await this.store.getGoal(goalId);
    if (!goal) return null;
    const criteria = await this.store.listGoalCriteria(goalId);
    const criteriaCounts = { total: criteria.length, met: 0, failed: 0, pending: 0 };
    const taskCounts = { total: 0, completed: 0, claimed: 0, open: 0 };
    const unmet: string[] = [];
    if (criteria.length === 0) unmet.push('no acceptance criteria defined');
    for (const criterion of criteria) {
      if (criterion.status === 'met') {
        criteriaCounts.met++;
      } else if (criterion.status === 'failed') {
        criteriaCounts.failed++;
        unmet.push(`criterion failed: ${criterion.description}`);
      } else {
        criteriaCounts.pending++;
        unmet.push(`criterion pending: ${criterion.description}`);
      }
      if (criterion.task_id) {
        const task = await this.store.getTask(criterion.task_id);
        if (task) {
          taskCounts.total++;
          if (task.status === 'completed') {
            taskCounts.completed++;
          } else if (task.status === 'claimed') {
            taskCounts.claimed++;
            unmet.push(`task in progress: ${task.id}`);
          } else {
            taskCounts.open++;
            unmet.push(`task unclaimed: ${task.id}`);
          }
        }
      }
    }
    const percent =
      criteriaCounts.total === 0
        ? 0
        : Math.round((criteriaCounts.met / criteriaCounts.total) * 100);
    return {
      goalId,
      status: goal.status,
      criteria: criteriaCounts,
      tasks: taskCounts,
      percent,
      readyToComplete: unmet.length === 0,
      unmet,
    };
  }

  /** Derive the actionable next steps for a goal's unmet criteria. */
  async nextActions(goalId: string): Promise<GoalActionItem[]> {
    const criteria = await this.store.listGoalCriteria(goalId);
    const actions: GoalActionItem[] = [];
    for (const criterion of criteria) {
      if (criterion.status === 'met') continue;
      if (criterion.status === 'failed') {
        actions.push({
          criterionId: criterion.id,
          description: criterion.description,
          action: 'rework',
          taskId: criterion.task_id,
        });
        continue;
      }
      if (!criterion.task_id) {
        actions.push({
          criterionId: criterion.id,
          description: criterion.description,
          action: 'propose-task',
          taskId: null,
        });
        continue;
      }
      const task = await this.store.getTask(criterion.task_id);
      if (task && task.status !== 'completed') {
        actions.push({
          criterionId: criterion.id,
          description: criterion.description,
          action: 'await-task',
          taskId: task.id,
        });
      } else {
        actions.push({
          criterionId: criterion.id,
          description: criterion.description,
          action: 'verify',
          taskId: criterion.task_id,
        });
      }
    }
    return actions;
  }
}
