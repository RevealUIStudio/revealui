import { describe, expect, it } from 'vitest';
import {
  executionAfterFailure,
  initialPaymentAttempt,
  type PriorAutoRefund,
  planAttemptRefunds,
  planCancelRefunds,
  planDisputeOpen,
  planJoshuaDecision,
  planPublisherReply,
  REFUND_ASSET,
  type RefundPaymentAttempt,
  usdcToCents,
} from './revmarket-refund-policy.js';

const NOW = new Date('2026-09-16T00:00:00.000Z');
const COMPLETED = new Date('2026-09-15T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function attempt(
  overrides: Partial<RefundPaymentAttempt> & Pick<RefundPaymentAttempt, 'id'>,
): RefundPaymentAttempt {
  return {
    attemptNo: 1,
    amountUsdc: '10.00',
    status: 'paid',
    ...overrides,
  };
}

function prior(cents: number, ageMs: number): PriorAutoRefund {
  return { amountUsdCents: cents, createdAt: new Date(NOW.getTime() - ageMs) };
}

describe('USDC on Base amounts', () => {
  it('converts 1.00 USDC to 100 cents and ignores an uncharged attempt', () => {
    expect(usdcToCents('1.00')).toBe(100);
    expect(usdcToCents('31.25')).toBe(3125);
    expect(initialPaymentAttempt({ charged: true })).toEqual({
      attemptNo: 1,
      asset: REFUND_ASSET,
      status: 'paid',
    });
    expect(initialPaymentAttempt({ charged: false }).status).toBe('not_charged');
  });
});

describe('failed run', () => {
  it('retries once and does not refund or accrue', () => {
    const first = executionAfterFailure({ priorFailures: 0 });
    expect(first).toEqual({ action: 'retry', failureCount: 1, accrueEarning: false });
  });

  it('refunds each paid attempt after the retry and never accrues', () => {
    const second = executionAfterFailure({ priorFailures: 1 });
    expect(second.action).toBe('terminal_fail');
    expect(second.accrueEarning).toBe(false);

    const rows = planAttemptRefunds({
      attempts: [
        attempt({ id: 'a1', attemptNo: 1, amountUsdc: '10.00' }),
        attempt({ id: 'a2', attemptNo: 2, amountUsdc: '4.50', status: 'not_charged' }),
        attempt({ id: 'a3', attemptNo: 3, amountUsdc: '2.00' }),
      ],
      priorAutoRefunds: [],
      now: NOW,
      baseKind: 'auto_fail',
    });

    expect(rows.map((row) => row.paymentAttemptId)).toEqual(['a1', 'a3']);
    expect(rows.every((row) => row.kind === 'auto_fail' && row.accrueEarning === false)).toBe(true);
    expect(rows.map((row) => row.amountUsdCents)).toEqual([1000, 200]);
  });
});

describe('cancel', () => {
  it('refunds only while pending or queued', () => {
    const queued = planCancelRefunds({
      phase: 'queued',
      attempts: [attempt({ id: 'a1' })],
      priorAutoRefunds: [],
      now: NOW,
    });
    expect(queued.refundable).toBe(true);
    expect(queued.refunds).toHaveLength(1);
    expect(queued.refunds[0]?.kind).toBe('cancel');

    const pending = planCancelRefunds({
      phase: 'pending',
      attempts: [attempt({ id: 'a1' })],
      priorAutoRefunds: [],
      now: NOW,
    });
    expect(pending.refunds).toHaveLength(1);

    for (const phase of ['running', 'completed', 'failed', 'cancelled']) {
      const blocked = planCancelRefunds({
        phase,
        attempts: [attempt({ id: 'a1' })],
        priorAutoRefunds: [],
        now: NOW,
      });
      expect(blocked).toEqual({ refundable: false, refunds: [] });
    }
  });
});

describe('disputes', () => {
  it('requires a written reason and a completed task inside 7 days', () => {
    expect(
      planDisputeOpen({
        phase: 'completed',
        reason: '   ',
        completedAt: COMPLETED,
        now: NOW,
        priorDisputeCount: 0,
      }),
    ).toEqual({ ok: false, error: 'written reason required' });

    expect(
      planDisputeOpen({
        phase: 'running',
        reason: 'output was wrong',
        completedAt: COMPLETED,
        now: NOW,
        priorDisputeCount: 0,
      }).ok,
    ).toBe(false);

    const open = planDisputeOpen({
      phase: 'completed',
      reason: ' output was wrong ',
      completedAt: COMPLETED,
      now: NOW,
      priorDisputeCount: 0,
    });
    expect(open.ok).toBe(true);
    if (open.ok) {
      expect(open.earningStatus).toBe('held_for_dispute');
      expect(open.reason).toBe('output was wrong');
      expect(open.windowEndsAt.getTime() - COMPLETED.getTime()).toBe(7 * DAY);
    }

    const late = planDisputeOpen({
      phase: 'completed',
      reason: 'too late',
      completedAt: COMPLETED,
      now: new Date(COMPLETED.getTime() + 7 * DAY + 1),
      priorDisputeCount: 0,
    });
    expect(late).toEqual({ ok: false, error: 'dispute window closed' });
  });

  it('lets the publisher reply once', () => {
    expect(planPublisherReply({ existingReply: null, reply: ' we shipped the file ' })).toEqual({
      ok: true,
      reply: 'we shipped the file',
    });
    expect(planPublisherReply({ existingReply: 'already said', reply: 'again' })).toEqual({
      ok: false,
      error: 'publisher already replied',
    });
    expect(planPublisherReply({ existingReply: null, reply: '  ' })).toEqual({
      ok: false,
      error: 'reply required',
    });
  });

  it('flags the 4th dispute in the window and still opens it', () => {
    const third = planDisputeOpen({
      phase: 'completed',
      reason: 'third',
      completedAt: COMPLETED,
      now: NOW,
      priorDisputeCount: 2,
    });
    expect(third.ok && third.abuseFlag).toBe(false);

    const fourth = planDisputeOpen({
      phase: 'completed',
      reason: 'fourth',
      completedAt: COMPLETED,
      now: NOW,
      priorDisputeCount: 3,
    });
    expect(fourth.ok).toBe(true);
    if (fourth.ok) expect(fourth.abuseFlag).toBe(true);
  });

  it('drops the earning on an approved refund and leaves the cap to Joshua', () => {
    const approved = planJoshuaDecision({
      decision: 'refund',
      earningStatus: 'held_for_dispute',
      attempts: [
        attempt({ id: 'a1', amountUsdc: '40.00' }),
        attempt({ id: 'a2', attemptNo: 2, amountUsdc: '5.00' }),
      ],
      reason: 'customer was right',
    });
    expect(approved.decision).toBe('refund');
    if (approved.decision !== 'refund') return;
    expect(approved.nextEarningStatus).toBe('dropped');
    expect(approved.refunds).toHaveLength(2);
    expect(approved.refunds.every((row) => row.kind === 'dispute' && row.sender === 'joshua')).toBe(
      true,
    );

    const denied = planJoshuaDecision({
      decision: 'deny',
      earningStatus: 'held_for_dispute',
      attempts: [attempt({ id: 'a1' })],
      reason: 'output matched the request',
    });
    expect(denied).toEqual({ decision: 'deny', nextEarningStatus: 'accrued' });
  });
});

describe('automatic refund cap', () => {
  it('holds the refund that would pass $25 in 7 days and ignores older refunds', () => {
    const held = planAttemptRefunds({
      attempts: [attempt({ id: 'a1', amountUsdc: '1.00' })],
      priorAutoRefunds: [prior(2500, DAY)],
      now: NOW,
      baseKind: 'auto_fail',
    });
    expect(held[0]?.kind).toBe('cap_held');
    expect(held[0]?.sender).toBe('joshua');
    expect(held[0]?.accrueEarning).toBe(false);

    const fits = planAttemptRefunds({
      attempts: [attempt({ id: 'a1', amountUsdc: '0.01' })],
      priorAutoRefunds: [prior(2499, DAY)],
      now: NOW,
      baseKind: 'cancel',
    });
    expect(fits[0]?.kind).toBe('cancel');

    const expired = planAttemptRefunds({
      attempts: [attempt({ id: 'a1', amountUsdc: '10.00' })],
      priorAutoRefunds: [prior(2500, 8 * DAY)],
      now: NOW,
      baseKind: 'auto_fail',
    });
    expect(expired[0]?.kind).toBe('auto_fail');
  });
});
