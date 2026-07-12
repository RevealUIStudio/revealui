import { logger } from '@revealui/utils/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyAuditWriteFailure,
  getAuditWriteFailureStatsForTest,
  recordAuditWriteResult,
  resetAuditWriteFailureStatsForTest,
} from '../audit-write-failures.js';

vi.mock('@revealui/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe('classifyAuditWriteFailure', () => {
  it('classifies the getAuditSecret() message as missing_secret', () => {
    const err = new Error(
      'Audit HMAC signing requires REVEALUI_AUDIT_HMAC_SECRET (or REVEALUI_SECRET fallback) to be set.',
    );
    expect(classifyAuditWriteFailure(err)).toBe('missing_secret');
  });

  it('classifies Postgres check_violation (23514) as constraint_violation', () => {
    expect(classifyAuditWriteFailure({ code: '23514' })).toBe('constraint_violation');
  });

  it('classifies Postgres unique_violation (23505) as constraint_violation', () => {
    expect(classifyAuditWriteFailure({ code: '23505' })).toBe('constraint_violation');
  });

  it('classifies Postgres undefined_column (42703) as schema_mismatch', () => {
    expect(classifyAuditWriteFailure({ code: '42703' })).toBe('schema_mismatch');
  });

  it('classifies Postgres undefined_table (42P01) as schema_mismatch', () => {
    expect(classifyAuditWriteFailure({ code: '42P01' })).toBe('schema_mismatch');
  });

  it('falls back to db_error for an unrecognized code', () => {
    expect(classifyAuditWriteFailure({ code: '08006' })).toBe('db_error');
  });

  it('classifies a code nested under .cause (drizzle-orm wraps every driver error this way)', () => {
    const wrapped = new Error('Failed query: insert into "audit_log" ...');
    wrapped.cause = { code: '23514' };
    expect(classifyAuditWriteFailure(wrapped)).toBe('constraint_violation');
  });

  it('prefers a top-level code over a nested .cause code', () => {
    const wrapped = new Error('boom') as Error & { code?: string };
    wrapped.code = '42703';
    wrapped.cause = { code: '23514' };
    expect(classifyAuditWriteFailure(wrapped)).toBe('schema_mismatch');
  });

  it('falls back to db_error for a plain Error with no code', () => {
    expect(classifyAuditWriteFailure(new Error('connection reset'))).toBe('db_error');
  });

  it('falls back to db_error for a non-object throw', () => {
    expect(classifyAuditWriteFailure('boom')).toBe('db_error');
  });
});

describe('recordAuditWriteResult — ratio tracking', () => {
  beforeEach(() => {
    resetAuditWriteFailureStatsForTest();
  });

  afterEach(() => {
    resetAuditWriteFailureStatsForTest();
    vi.clearAllMocks();
  });

  it('does not escalate below the minimum sample size, even at 100% failure', () => {
    for (let i = 0; i < 19; i++) {
      recordAuditWriteResult({ ok: false, reason: 'constraint_violation' });
    }
    const stats = getAuditWriteFailureStatsForTest();
    expect(stats.attempted).toBe(19);
    expect(stats.failed).toBe(19);
  });

  it('tallies failures by reason', () => {
    recordAuditWriteResult({ ok: false, reason: 'constraint_violation' });
    recordAuditWriteResult({ ok: false, reason: 'constraint_violation' });
    recordAuditWriteResult({ ok: false, reason: 'missing_secret' });
    recordAuditWriteResult({ ok: true });

    const stats = getAuditWriteFailureStatsForTest();
    expect(stats.attempted).toBe(4);
    expect(stats.failed).toBe(3);
    expect(stats.byReason.constraint_violation).toBe(2);
    expect(stats.byReason.missing_secret).toBe(1);
  });

  it('does not count a successful write as a failure', () => {
    recordAuditWriteResult({ ok: true });
    const stats = getAuditWriteFailureStatsForTest();
    expect(stats.attempted).toBe(1);
    expect(stats.failed).toBe(0);
  });

  // B2: this module must never log per-attempt or per-failure — every call
  // site already owns its own event-level logging at its own cadence (e.g.
  // middleware/audit.ts's 1-in-10 throttle). A per-failure log here would sit
  // underneath that throttle and multiply log volume during exactly the
  // near-100%-failure condition this module exists to catch.
  it('never logs on an individual failure, no matter how many are recorded', () => {
    for (let i = 0; i < 50; i++) {
      recordAuditWriteResult({ ok: false, reason: 'constraint_violation' });
    }
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('never logs on an individual success', () => {
    for (let i = 0; i < 50; i++) {
      recordAuditWriteResult({ ok: true });
    }
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('escalates via logger.error exactly once while the ratio stays above threshold', () => {
    for (let i = 0; i < 30; i++) {
      recordAuditWriteResult({ ok: false, reason: 'constraint_violation' });
    }
    // Escalation fires the moment the window first reaches MIN_SAMPLE_SIZE
    // (20) with 100% failures, not after all 30 have been recorded — the
    // alarm latches at that point and the remaining 10 calls in this loop
    // don't re-fire it.
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Audit write failure ratio exceeded threshold',
      expect.objectContaining({
        ratio: 1,
        windowSize: 20,
        byReason: expect.objectContaining({ constraint_violation: 20 }),
      }),
    );

    // More failures while still above threshold: no repeat escalation.
    for (let i = 0; i < 10; i++) {
      recordAuditWriteResult({ ok: false, reason: 'constraint_violation' });
    }
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('does not escalate below the 1% threshold', () => {
    // Establish a large pool of successes FIRST so the single failure below
    // is already diluted the instant it's recorded — the ratio is checked on
    // every call, so a failure recorded while the window is still small
    // would transiently exceed 1% even if the eventual steady-state ratio is
    // fine. This ordering is what "below threshold, never escalates" means
    // in a rolling-window check.
    for (let i = 0; i < 200; i++) {
      recordAuditWriteResult({ ok: true });
    }
    recordAuditWriteResult({ ok: false, reason: 'db_error' });
    // 1 failure / 201 attempts ≈ 0.5%, below the 1% threshold.
    expect(logger.error).not.toHaveBeenCalled();
  });

  // S1: the ratio must be windowed (rolling), not a lifetime cumulative
  // count, so the alarm can re-arm after a recovery and fire again on a
  // later, independent failure spike.
  it('re-arms and re-fires after the ratio recovers below threshold and spikes again', () => {
    for (let i = 0; i < 30; i++) {
      recordAuditWriteResult({ ok: false, reason: 'constraint_violation' });
    }
    expect(logger.error).toHaveBeenCalledTimes(1);

    // Recover: enough successes to age every failure out of the rolling
    // window and push the ratio back under 1%.
    for (let i = 0; i < 500; i++) {
      recordAuditWriteResult({ ok: true });
    }
    const recovered = getAuditWriteFailureStatsForTest();
    expect(recovered.failed).toBe(0);

    // A second, independent spike must escalate again — proves the alarm
    // did not latch permanently after the first escalation.
    for (let i = 0; i < 30; i++) {
      recordAuditWriteResult({ ok: false, reason: 'schema_mismatch' });
    }
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
