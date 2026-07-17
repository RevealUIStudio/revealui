import { describe, expect, it } from 'vitest';
import type { NudgeId } from '../definitions.js';
import type { DismissalRecord, NudgeCandidate } from '../selection.js';
import { isNudgeEligible, SNOOZE_MS, selectNudge } from '../selection.js';

const NOW = new Date('2026-07-17T12:00:00.000Z');

describe('selectNudge', () => {
  it('returns null when there are no candidates', () => {
    expect(selectNudge([], new Map(), NOW)).toBeNull();
  });

  it('picks the only candidate when one holds', () => {
    const candidates: NudgeCandidate[] = [{ id: 'free-first-reply', milestone: 'hour1' }];
    expect(selectNudge(candidates, new Map(), NOW)).toBe('free-first-reply');
  });

  it('orders by milestone priority: hour1 beats hour24 beats day7', () => {
    const candidates: NudgeCandidate[] = [
      { id: 'ent-second-tenant', milestone: 'day7' },
      { id: 'max-local-inference', milestone: 'hour24' },
      { id: 'pro-first-action', milestone: 'hour1' },
    ];
    expect(selectNudge(candidates, new Map(), NOW)).toBe('pro-first-action');
  });

  it('falls through to the next-highest-priority candidate when the top one is snoozed', () => {
    const candidates: NudgeCandidate[] = [
      { id: 'pro-first-action', milestone: 'hour1' },
      { id: 'max-local-inference', milestone: 'hour24' },
    ];
    const dismissals = new Map<NudgeId, DismissalRecord>([
      ['pro-first-action', { dismissCount: 1, lastDismissedAt: NOW }],
    ]);
    expect(selectNudge(candidates, dismissals, NOW)).toBe('max-local-inference');
  });

  it('a candidate absent from the list (milestone already landed) is never selected', () => {
    // free-first-content would rank ahead of free-first-reply's own priority
    // scheme in no way here — this asserts that omission alone (the caller's
    // job once the milestone lands) is sufficient, no separate retirement
    // flag needed.
    const candidates: NudgeCandidate[] = [{ id: 'free-first-content', milestone: 'hour24' }];
    expect(selectNudge(candidates, new Map(), NOW)).toBe('free-first-content');
    expect(selectNudge([], new Map(), NOW)).toBeNull();
  });
});

describe('isNudgeEligible', () => {
  it('is eligible with no dismissal record', () => {
    expect(isNudgeEligible(undefined, NOW)).toBe(true);
  });

  it('is snoozed immediately after a first dismissal', () => {
    const record: DismissalRecord = { dismissCount: 1, lastDismissedAt: NOW };
    expect(isNudgeEligible(record, NOW)).toBe(false);
  });

  it('stays snoozed just before the 48h window elapses', () => {
    const record: DismissalRecord = { dismissCount: 1, lastDismissedAt: NOW };
    const almostThere = new Date(NOW.getTime() + SNOOZE_MS - 1);
    expect(isNudgeEligible(record, almostThere)).toBe(false);
  });

  it('returns after exactly 48h if still unmet', () => {
    const record: DismissalRecord = { dismissCount: 1, lastDismissedAt: NOW };
    const exactlyThere = new Date(NOW.getTime() + SNOOZE_MS);
    expect(isNudgeEligible(record, exactlyThere)).toBe(true);
  });

  it('is permanently retired after a second dismissal, even long after', () => {
    const record: DismissalRecord = { dismissCount: 2, lastDismissedAt: NOW };
    const farFuture = new Date(NOW.getTime() + SNOOZE_MS * 100);
    expect(isNudgeEligible(record, farFuture)).toBe(false);
  });

  it('treats a dismissCount above the max as retired too (defensive)', () => {
    const record: DismissalRecord = { dismissCount: 3, lastDismissedAt: NOW };
    expect(isNudgeEligible(record, new Date(NOW.getTime() + SNOOZE_MS * 100))).toBe(false);
  });
});
