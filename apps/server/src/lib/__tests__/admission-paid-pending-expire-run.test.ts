import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAID_PENDING_EXPIRE_HOURS,
  isAdmissionPaidPendingExpireEnabled,
  paidPendingExpireTtlMs,
  shouldExpirePaidPending,
} from '../admission-paid-pending-expire-run.js';

const now = new Date('2026-08-31T00:00:00.000Z');
const stale = new Date('2026-08-28T00:00:00.000Z');
const fresh = new Date('2026-08-30T12:00:00.000Z');
const ttlMs = DEFAULT_PAID_PENDING_EXPIRE_HOURS * 60 * 60 * 1000;

const pending = {
  source: 'signup',
  accountStatus: 'active',
  meteringStatus: 'active',
  maxAgentTasks: 0,
  aiLocal: false,
  cogsBreakerTrippedAt: null,
  lastEventAt: stale,
  updatedAt: stale,
};

describe('isAdmissionPaidPendingExpireEnabled', () => {
  it('is off by default', () => {
    expect(isAdmissionPaidPendingExpireEnabled({})).toBe(false);
    expect(
      isAdmissionPaidPendingExpireEnabled({ ADMISSION_PAID_PENDING_EXPIRE_ENABLED: '1' }),
    ).toBe(false);
  });

  it('is on only when exactly true', () => {
    expect(
      isAdmissionPaidPendingExpireEnabled({ ADMISSION_PAID_PENDING_EXPIRE_ENABLED: 'true' }),
    ).toBe(true);
  });
});

describe('paidPendingExpireTtlMs', () => {
  it('defaults to 48h', () => {
    expect(paidPendingExpireTtlMs({})).toBe(ttlMs);
  });

  it('parses hours and rejects invalid', () => {
    expect(paidPendingExpireTtlMs({ ADMISSION_PAID_PENDING_EXPIRE_HOURS: '24' })).toBe(
      24 * 60 * 60 * 1000,
    );
    expect(paidPendingExpireTtlMs({ ADMISSION_PAID_PENDING_EXPIRE_HOURS: '0' })).toBe(ttlMs);
    expect(paidPendingExpireTtlMs({ ADMISSION_PAID_PENDING_EXPIRE_HOURS: 'nope' })).toBe(ttlMs);
  });
});

describe('shouldExpirePaidPending', () => {
  it('expires stale unpaid paid-pending', () => {
    expect(shouldExpirePaidPending(pending, now, ttlMs)).toBe(true);
  });

  it('keeps fresh paid-pending', () => {
    expect(
      shouldExpirePaidPending({ ...pending, lastEventAt: fresh, updatedAt: fresh }, now, ttlMs),
    ).toBe(false);
  });

  it('never expires stripe/grant or free cohort with AI on', () => {
    expect(shouldExpirePaidPending({ ...pending, source: 'stripe' }, now, ttlMs)).toBe(false);
    expect(shouldExpirePaidPending({ ...pending, aiLocal: true }, now, ttlMs)).toBe(false);
    expect(shouldExpirePaidPending({ ...pending, maxAgentTasks: 1000 }, now, ttlMs)).toBe(false);
  });

  it('skips breaker-tripped and already paused/suspended', () => {
    expect(shouldExpirePaidPending({ ...pending, cogsBreakerTrippedAt: stale }, now, ttlMs)).toBe(
      false,
    );
    expect(shouldExpirePaidPending({ ...pending, meteringStatus: 'paused' }, now, ttlMs)).toBe(
      false,
    );
    expect(shouldExpirePaidPending({ ...pending, accountStatus: 'suspended' }, now, ttlMs)).toBe(
      false,
    );
  });
});
