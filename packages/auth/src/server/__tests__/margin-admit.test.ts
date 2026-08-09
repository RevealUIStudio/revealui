/**
 * GAP-256 — OPEN_FREE_LIMITS lockstep + pure decide shapes used by admit.
 *
 * Full admitFreeIntake I/O is covered via enqueue helpers + server route tests.
 */

import { decideFreeIntake } from '@revealui/core/margin-governor';
import { describe, expect, it } from 'vitest';

/** Mirror of OPEN_FREE_LIMITS in margin-admit.ts */
const OPEN_FREE_LIMITS = {
  maxSites: 1,
  maxUsers: 3,
  maxAgentTasks: 1_000,
} as const;

describe('OPEN_FREE_LIMITS lockstep', () => {
  it('matches hosted free tier (1 site / 3 users / 1k tasks)', () => {
    expect(OPEN_FREE_LIMITS).toEqual({
      maxSites: 1,
      maxUsers: 3,
      maxAgentTasks: 1_000,
    });
  });
});

describe('decide path used by admit (PR-4)', () => {
  const now = new Date('2026-08-09T12:00:00.000Z');
  const snapshot = {
    id: 'snap',
    mode: 'waitlist' as const,
    computedAt: now,
  };

  it('free_signup enforce waitlist → waitlist decision (enqueue path)', () => {
    const r = decideFreeIntake({
      channel: 'free_signup',
      deploymentMode: 'hosted',
      payingIntent: { kind: 'none' },
      snapshot,
      flags: { enabled: true, shadow: false, staleHours: 36 },
      openLimits: OPEN_FREE_LIMITS,
      now,
    });
    expect(r.decision).toBe('waitlist');
  });

  it('waitlist_claim_free under waitlist → admit', () => {
    const r = decideFreeIntake({
      channel: 'waitlist_claim_free',
      deploymentMode: 'hosted',
      payingIntent: { kind: 'none' },
      snapshot,
      flags: { enabled: true, shadow: false, staleHours: 36 },
      openLimits: OPEN_FREE_LIMITS,
      now,
    });
    expect(r.decision).toBe('admit');
    if (r.decision === 'admit') {
      expect(r.reason).toBe('waitlist_claim');
    }
  });
});
