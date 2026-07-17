/**
 * Nudge selection — pure priority + dismissal logic (GAP-300 §7).
 *
 * Deliberately DB-free: `buildCandidates` (./triggers.ts) decides which
 * nudge ids currently hold their trigger (tier-gated, milestone-gated),
 * and this module picks one to show, honoring the snooze/retirement
 * contract. Keeping DB access out of this file is what makes priority
 * ordering, snooze timing, and retirement fully unit-testable.
 */

import type { MilestoneRank, NudgeId } from './definitions.js';

export interface NudgeCandidate {
  id: NudgeId;
  milestone: MilestoneRank;
}

export interface DismissalRecord {
  dismissCount: number;
  lastDismissedAt: Date;
}

export const SNOOZE_MS = 48 * 60 * 60 * 1000;
export const MAX_DISMISS_COUNT = 2;

const MILESTONE_ORDER: Record<MilestoneRank, number> = {
  hour1: 0,
  hour24: 1,
  day7: 2,
};

/**
 * Whether a candidate whose trigger currently holds is still eligible to
 * display, given its dismissal history. A candidate with no dismissal
 * record is always eligible. `dismissCount >= MAX_DISMISS_COUNT` retires
 * the nudge permanently, regardless of how long ago that happened.
 */
export function isNudgeEligible(record: DismissalRecord | undefined, now: Date): boolean {
  if (!record) return true;
  if (record.dismissCount >= MAX_DISMISS_COUNT) return false;
  const snoozeUntilMs = record.lastDismissedAt.getTime() + SNOOZE_MS;
  return now.getTime() >= snoozeUntilMs;
}

/**
 * Picks the single nudge to show, or null when none qualify. `candidates`
 * must already be filtered to trigger-holding nudges (the caller's job,
 * via `buildCandidates`) — a nudge whose milestone has landed is simply
 * absent from `candidates`, which is what makes retirement-on-milestone
 * automatic rather than a separate piece of state to maintain.
 */
export function selectNudge(
  candidates: readonly NudgeCandidate[],
  dismissals: ReadonlyMap<NudgeId, DismissalRecord>,
  now: Date,
): NudgeId | null {
  const eligible = candidates.filter((candidate) =>
    isNudgeEligible(dismissals.get(candidate.id), now),
  );
  if (eligible.length === 0) return null;

  const [first] = [...eligible].sort(
    (a, b) => MILESTONE_ORDER[a.milestone] - MILESTONE_ORDER[b.milestone],
  );
  return first ? first.id : null;
}
