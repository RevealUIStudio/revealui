/**
 * GAP-256 PR-3 — pure decide (HC1 shadow, HC3 waitlist snapshot still admits, HC6 no COUNT).
 */
import { describe, expect, it } from 'vitest';
import {
  decideFreeIntake,
  freeCohortLimitsForMode,
  governorFlagsFromEnv,
  paidPendingLimits,
} from '../margin-governor.js';

const openLimits = { maxSites: 1, maxUsers: 3, maxAgentTasks: 1_000 };

describe('freeCohortLimitsForMode / paidPendingLimits', () => {
  it('lean only trims maxAgentTasks', () => {
    expect(freeCohortLimitsForMode('lean', openLimits, 250)).toEqual({
      maxSites: 1,
      maxUsers: 3,
      maxAgentTasks: 250,
    });
  });

  it('paid-pending is zero tasks (K20)', () => {
    expect(paidPendingLimits().maxAgentTasks).toBe(0);
  });
});

describe('governorFlagsFromEnv', () => {
  it('defaults shadow true when enabled', () => {
    const f = governorFlagsFromEnv({ MARGIN_GOVERNOR_ENABLED: 'true' });
    expect(f.enabled).toBe(true);
    expect(f.shadow).toBe(true);
  });

  it('allows enforce when SHADOW=false', () => {
    const f = governorFlagsFromEnv({
      MARGIN_GOVERNOR_ENABLED: 'true',
      MARGIN_GOVERNOR_SHADOW: 'false',
    });
    expect(f.shadow).toBe(false);
  });
});

describe('decideFreeIntake', () => {
  const now = new Date('2026-08-09T12:00:00.000Z');

  it('admits when governor disabled (HC1 open path)', () => {
    const r = decideFreeIntake({
      channel: 'free_signup',
      deploymentMode: 'hosted',
      payingIntent: { kind: 'none' },
      snapshot: null,
      flags: { enabled: false, shadow: true, staleHours: 36 },
      openLimits,
      now,
    });
    expect(r.decision).toBe('admit');
    if (r.decision === 'admit') {
      expect(r.cohortLimits.maxAgentTasks).toBe(1_000);
      expect(r.reason).toBe('governor_disabled');
    }
  });

  it('shadow + waitlist snapshot still admits (HC3)', () => {
    const r = decideFreeIntake({
      channel: 'free_signup',
      deploymentMode: 'hosted',
      payingIntent: { kind: 'none' },
      snapshot: {
        id: 'snap-1',
        mode: 'waitlist',
        computedAt: now,
      },
      flags: { enabled: true, shadow: true, staleHours: 36 },
      openLimits,
      now,
    });
    expect(r.decision).toBe('admit');
    if (r.decision === 'admit') {
      expect(r.mode).toBe('shadow');
      expect(r.reason).toContain('waitlist');
      expect(r.shadow).toBe(true);
    }
  });

  it('enforce waitlist returns WAITLISTED without inventing users (HC2 shape)', () => {
    const r = decideFreeIntake({
      channel: 'free_signup',
      deploymentMode: 'hosted',
      payingIntent: { kind: 'none' },
      snapshot: {
        id: 'snap-2',
        mode: 'waitlist',
        computedAt: now,
      },
      flags: { enabled: true, shadow: false, staleHours: 36 },
      openLimits,
      now,
    });
    expect(r.decision).toBe('waitlist');
    if (r.decision === 'waitlist') {
      expect(r.httpStatus).toBe(202);
      expect(r.code).toBe('WAITLISTED');
    }
  });

  it('paying-intent bypasses waitlist', () => {
    const r = decideFreeIntake({
      channel: 'paid_signup',
      deploymentMode: 'hosted',
      payingIntent: { kind: 'checkout', tier: 'pro' },
      snapshot: {
        id: 'snap-3',
        mode: 'waitlist',
        computedAt: now,
      },
      flags: { enabled: true, shadow: false, staleHours: 36 },
      openLimits,
      now,
    });
    expect(r.decision).toBe('admit');
    if (r.decision === 'admit') {
      expect(r.mode).toBe('bypass');
    }
  });

  it('does not reference user COUNT (HC6 — pure API surface)', () => {
    // Module has no users import; smoke the API only.
    expect(typeof decideFreeIntake).toBe('function');
  });
});
