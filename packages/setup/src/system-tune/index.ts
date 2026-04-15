/**
 * System Tune — Hardware-Aware Auto-Config
 *
 * Detects host hardware/platform and generates a tuning plan.
 * Pure detection + plan generation; CLI surface lives in @revealui/cli.
 */

export { detectSystem } from './detect.js';
export { generateAutoplan, generatePlan, matchProfile } from './plan.js';
export { PROFILES } from './profiles.js';
export type {
  PlanAction,
  PlatformClass,
  SystemInfo,
  TunePlan,
  TuneProfile,
  TuneValues,
  WslConfigTune,
} from './types.js';
