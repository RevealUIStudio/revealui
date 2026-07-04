/**
 * Goal harness  -  goal-driven coordination for the RevDev Harness daemon.
 *
 * @packageDocumentation
 */

export type {
  CriterionRecordResult,
  GoalHarnessOptions,
  GoalTransitionResult,
  ProposeTaskResult,
} from './goal-harness.js';
export { GoalHarness } from './goal-harness.js';
export type {
  CreateGoalInput,
  CriterionStatus,
  GoalAction,
  GoalActionItem,
  GoalOwner,
  GoalPriority,
  GoalProgress,
  GoalStatus,
  GoalWithCriteria,
} from './goal-schema.js';
export {
  CRITERION_STATUSES,
  createGoalInputSchema,
  GOAL_ACTIONS,
  GOAL_OWNERS,
  GOAL_PRIORITIES,
  GOAL_STATUSES,
} from './goal-schema.js';
