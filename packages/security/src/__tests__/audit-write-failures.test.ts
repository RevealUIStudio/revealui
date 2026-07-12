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
});
