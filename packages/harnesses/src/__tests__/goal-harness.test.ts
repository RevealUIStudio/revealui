/**
 * Tests for GoalHarness  -  goal-driven coordination over DaemonStore.
 *
 * Uses in-memory PGlite (no data directory) for isolation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: () => true,
}));

vi.mock('@revealui/core/license', () => ({
  initializeLicense: async () => {},
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { GoalHarness } from '../goals/goal-harness.js';
import { DaemonStore } from '../storage/daemon-store.js';

function must<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error('expected a value');
  return value;
}

describe('GoalHarness', () => {
  let store: DaemonStore;
  let harness: GoalHarness;

  beforeEach(async () => {
    // In-memory PGlite: no dataDir means ephemeral
    store = new DaemonStore({ dataDir: '' });
    await store.init();
    harness = new GoalHarness({ store, agentId: 'tester' });
  });

  afterEach(async () => {
    await store.close();
  });

  it('creates a goal with initial criteria', async () => {
    const { goal, criteria } = await harness.createGoal({
      title: 'Ship the goal harness',
      description: 'Goal-driven coordination for the daemon',
      priority: 'high',
      criteria: ['typecheck passes', 'tests pass'],
    });
    expect(goal.status).toBe('open');
    expect(goal.priority).toBe('high');
    expect(goal.owner).toBe('agent');
    expect(goal.created_by).toBe('tester');
    expect(criteria).toHaveLength(2);
    expect(criteria[0]?.status).toBe('pending');
  });

  it('rejects an empty title', async () => {
    await expect(harness.createGoal({ title: '' })).rejects.toThrow();
  });

  it('refuses to activate while a blocker is open', async () => {
    const blocker = await harness.createGoal({ title: 'Blocker goal' });
    const { goal } = await harness.createGoal({
      title: 'Dependent goal',
      blockedBy: [blocker.goal.id],
    });

    const refused = await harness.activateGoal(goal.id);
    expect(refused.success).toBe(false);
    expect(refused.unresolvedBlockers).toEqual([blocker.goal.id]);

    await harness.abandonGoal(blocker.goal.id, 'not needed');
    const activated = await harness.activateGoal(goal.id);
    expect(activated.success).toBe(true);
    expect(activated.goal?.status).toBe('active');
  });

  it('requires evidence to mark a criterion met', async () => {
    const { criteria } = await harness.createGoal({ title: 'Evidence goal', criteria: ['c1'] });
    const criterion = must(criteria[0]);

    const refused = await harness.recordCriterion(criterion.id, 'met', '');
    expect(refused.success).toBe(false);

    const recorded = await harness.recordCriterion(criterion.id, 'met', 'vitest run: all passed');
    expect(recorded.success).toBe(true);
    expect(recorded.criterion?.status).toBe('met');
    expect(recorded.criterion?.verified_by).toBe('tester');
    expect(recorded.criterion?.verified_at).not.toBeNull();
  });

  it('proposes a claimable task for a criterion and tracks it in progress', async () => {
    const { goal, criteria } = await harness.createGoal({ title: 'Task goal', criteria: ['c1'] });
    const criterion = must(criteria[0]);

    // Propose-only surface is gated on an active goal
    const early = await harness.proposeTaskForCriterion(criterion.id);
    expect(early.success).toBe(false);

    await harness.activateGoal(goal.id);
    const proposed = await harness.proposeTaskForCriterion(criterion.id);
    expect(proposed.success).toBe(true);
    expect(proposed.created).toBe(true);
    const taskId = must(proposed.task).id;

    // Shows up in the daemon task queue as claimable
    const open = await store.listTasks({ status: 'open' });
    expect(open.map((t) => t.id)).toContain(taskId);

    // Idempotent while the linked task is live
    const again = await harness.proposeTaskForCriterion(criterion.id);
    expect(again.created).toBe(false);
    expect(again.task?.id).toBe(taskId);

    // Work the task through the existing claim/complete flow
    await store.claimTask(taskId, 'worker-1');
    await store.completeTask(taskId, 'worker-1');

    const progress = await harness.progress(goal.id);
    expect(progress?.tasks.completed).toBe(1);
    // Task done but criterion still awaits verification
    expect(progress?.readyToComplete).toBe(false);
  });

  it('fails closed on completion until every criterion is met', async () => {
    const { goal, criteria } = await harness.createGoal({
      title: 'Completion goal',
      criteria: ['c1', 'c2'],
    });
    await harness.activateGoal(goal.id);

    const refused = await harness.completeGoal(goal.id);
    expect(refused.success).toBe(false);
    expect(refused.unmet?.length).toBeGreaterThan(0);

    await harness.recordCriterion(must(criteria[0]).id, 'met', 'verified manually');
    await harness.recordCriterion(must(criteria[1]).id, 'met', 'verified manually');

    const completed = await harness.completeGoal(goal.id);
    expect(completed.success).toBe(true);
    expect(completed.goal?.status).toBe('done');
    expect(completed.goal?.closed_at).not.toBeNull();
  });

  it('refuses to complete a goal with no criteria', async () => {
    const { goal } = await harness.createGoal({ title: 'No criteria' });
    await harness.activateGoal(goal.id);
    const refused = await harness.completeGoal(goal.id);
    expect(refused.success).toBe(false);
    expect(refused.unmet).toContain('no acceptance criteria defined');
  });

  it('treats terminal goals as immutable', async () => {
    const { goal } = await harness.createGoal({ title: 'Short-lived goal' });
    await harness.abandonGoal(goal.id, 'superseded');

    const reactivate = await harness.activateGoal(goal.id);
    expect(reactivate.success).toBe(false);

    const lateCriterion = await harness.addCriterion(goal.id, 'late criterion');
    expect(lateCriterion.success).toBe(false);
  });

  it('computes percent from met criteria', async () => {
    const { goal, criteria } = await harness.createGoal({
      title: 'Percent goal',
      criteria: ['c1', 'c2'],
    });
    await harness.recordCriterion(must(criteria[0]).id, 'met', 'done and verified');
    const progress = await harness.progress(goal.id);
    expect(progress?.percent).toBe(50);
    expect(progress?.criteria).toEqual({ total: 2, met: 1, failed: 0, pending: 1 });
  });

  it('derives next actions across the criterion lifecycle', async () => {
    const { goal, criteria } = await harness.createGoal({ title: 'Loop goal', criteria: ['c1'] });
    const criterion = must(criteria[0]);
    await harness.activateGoal(goal.id);

    let actions = await harness.nextActions(goal.id);
    expect(actions[0]?.action).toBe('propose-task');

    const proposed = await harness.proposeTaskForCriterion(criterion.id);
    const taskId = must(proposed.task).id;
    actions = await harness.nextActions(goal.id);
    expect(actions[0]?.action).toBe('await-task');

    await store.claimTask(taskId, 'worker-1');
    await store.completeTask(taskId, 'worker-1');
    actions = await harness.nextActions(goal.id);
    expect(actions[0]?.action).toBe('verify');

    await harness.recordCriterion(criterion.id, 'failed', 'verification found a regression');
    actions = await harness.nextActions(goal.id);
    expect(actions[0]?.action).toBe('rework');

    // Rework: reset clears evidence and the task link so a fresh task can be proposed
    const reset = await harness.resetCriterion(criterion.id);
    expect(reset.success).toBe(true);
    expect(reset.criterion?.task_id).toBeNull();
    actions = await harness.nextActions(goal.id);
    expect(actions[0]?.action).toBe('propose-task');
  });

  it('filters goal lists', async () => {
    await harness.createGoal({ title: 'High goal', priority: 'high' });
    const { goal: mediumGoal } = await harness.createGoal({ title: 'Medium goal' });
    await harness.activateGoal(mediumGoal.id);

    const high = await harness.listGoals({ priority: 'high' });
    expect(high).toHaveLength(1);
    expect(high[0]?.title).toBe('High goal');

    const active = await harness.listGoals({ status: 'active' });
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe(mediumGoal.id);
  });

  it('logs goal events to the daemon audit trail', async () => {
    const { goal } = await harness.createGoal({ title: 'Audited goal', criteria: ['c1'] });
    await harness.activateGoal(goal.id);

    const events = await store.getRecentEvents(10);
    const types = events.map((e) => e.event_type);
    expect(types).toContain('goal.created');
    expect(types).toContain('goal.activated');
    expect(events.every((e) => e.agent_id === 'tester')).toBe(true);
  });
});
