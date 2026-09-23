/**
 * GAP-162 refunds and disputes. The rail is USDC on Base.
 * RevealCoin is not a payment asset on this path.
 *
 * A failed run retries once, then each paid attempt gets its own refund row
 * and never becomes an earning. Cancel refunds only while the task is still
 * pending or queued. After completion the customer can open a written-reason
 * dispute inside 7 days; the publisher may reply once; Joshua decides.
 * Automatic refunds pause when the next one would put the customer over
 * $25 in the last 7 days. Joshua sends dispute refunds and cap-held amounts.
 */

export interface RevmarketRefundConfig {
  /** Original run plus one retry. */
  maxAttempts: number;
  /** Dispute window and the earning hold after completion. */
  disputeWindowMs: number;
  /** Rolling window for the dispute-count flag. */
  abuseWindowMs: number;
  /** The dispute that reaches this count is flagged and still opens. */
  abuseDisputeCount: number;
  /** Automatic refunds stop when the next one would pass this total. */
  autoRefundCapCents: number;
  /** Rolling window for the automatic-refund cap. */
  autoRefundWindowMs: number;
}

export const DEFAULT_REFUND_CONFIG: RevmarketRefundConfig = {
  maxAttempts: 2,
  disputeWindowMs: 7 * 24 * 60 * 60 * 1000,
  abuseWindowMs: 30 * 24 * 60 * 60 * 1000,
  abuseDisputeCount: 4,
  autoRefundCapCents: 2500,
  autoRefundWindowMs: 7 * 24 * 60 * 60 * 1000,
};

export const REFUND_ASSET = 'usdc-base' as const;

export type TaskPhase = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type PaymentAttemptStatus = 'paid' | 'not_charged';

export interface RefundPaymentAttempt {
  id: string;
  attemptNo: number;
  amountUsdc: string;
  status: PaymentAttemptStatus;
}

export interface PriorAutoRefund {
  amountUsdCents: number;
  createdAt: Date;
}

export type RefundKind = 'auto_fail' | 'cancel' | 'dispute' | 'cap_held';

export type RefundSender = 'system' | 'joshua';

export interface PlannedRefund {
  paymentAttemptId: string;
  kind: RefundKind;
  reason: string;
  amountUsdc: string;
  amountUsdCents: number;
  sender: RefundSender;
  /** A refunded attempt is never an earning. */
  accrueEarning: false;
}

export type FailureOutcome =
  | { action: 'retry'; failureCount: number; accrueEarning: false }
  | { action: 'terminal_fail'; failureCount: number; accrueEarning: false };

const USDC_PATTERN = /^\d+(\.\d+)?$/;
const MAX_LEDGER_CENTS = 2_147_483_647;

function digitsToBigInt(digits: string): bigint {
  const stripped = digits.replace(/^0+/, '');
  return BigInt(stripped.length > 0 ? stripped : '0');
}

/** Full USDC amount in cents. 1 USDC is 1 USD. Not the publisher's 80% share. */
export function usdcToCents(amountUsdc: string | null | undefined): number {
  if (amountUsdc == null) return 0;
  const trimmed = amountUsdc.trim();
  if (!USDC_PATTERN.test(trimmed)) return 0;

  const [whole = '0', fraction = ''] = trimmed.split('.');
  const micros = `${fraction}${'0'.repeat(6)}`.slice(0, 6);
  const micro = digitsToBigInt(whole) * 1_000_000n + digitsToBigInt(micros);
  const cents = micro / 10_000n;
  if (cents <= 0n || cents > BigInt(MAX_LEDGER_CENTS)) return 0;
  return Number(cents);
}

export function initialPaymentAttempt(input: { charged: boolean }): {
  attemptNo: 1;
  asset: typeof REFUND_ASSET;
  status: PaymentAttemptStatus;
} {
  return {
    attemptNo: 1,
    asset: REFUND_ASSET,
    status: input.charged ? 'paid' : 'not_charged',
  };
}

/** First failure is re-queued. The second failure is terminal and refundable. */
export function executionAfterFailure(
  input: { priorFailures: number },
  overrides?: Partial<RevmarketRefundConfig>,
): FailureOutcome {
  const config = { ...DEFAULT_REFUND_CONFIG, ...overrides };
  const failureCount = input.priorFailures + 1;
  if (failureCount < config.maxAttempts) {
    return { action: 'retry', failureCount, accrueEarning: false };
  }
  return { action: 'terminal_fail', failureCount, accrueEarning: false };
}

function autoSpent(prior: readonly PriorAutoRefund[], now: Date, windowMs: number): number {
  const cutoff = now.getTime() - windowMs;
  let spent = 0;
  for (const row of prior) {
    if (row.createdAt.getTime() >= cutoff && row.amountUsdCents > 0) {
      spent += row.amountUsdCents;
    }
  }
  return spent;
}

/**
 * One refund row per paid attempt. Uncharged attempts are skipped.
 * A row that would push the 7-day automatic total over the cap is cap_held
 * for Joshua. Dispute rows are not planned here.
 */
export function planAttemptRefunds(
  input: {
    attempts: readonly RefundPaymentAttempt[];
    priorAutoRefunds: readonly PriorAutoRefund[];
    now: Date;
    baseKind: 'auto_fail' | 'cancel';
  },
  overrides?: Partial<RevmarketRefundConfig>,
): PlannedRefund[] {
  const config = { ...DEFAULT_REFUND_CONFIG, ...overrides };
  const spentStart = autoSpent(input.priorAutoRefunds, input.now, config.autoRefundWindowMs);
  let spent = spentStart;
  const paid = [...input.attempts]
    .filter((attempt) => attempt.status === 'paid')
    .sort((a, b) => a.attemptNo - b.attemptNo);

  const reason =
    input.baseKind === 'auto_fail'
      ? 'Run failed after one retry'
      : 'Cancelled while pending or queued';

  const rows: PlannedRefund[] = [];
  for (const attempt of paid) {
    const amountUsdCents = usdcToCents(attempt.amountUsdc);
    if (amountUsdCents <= 0) continue;
    const overCap =
      spent >= config.autoRefundCapCents || spent + amountUsdCents > config.autoRefundCapCents;
    if (overCap) {
      rows.push({
        paymentAttemptId: attempt.id,
        kind: 'cap_held',
        reason: `${reason}. Automatic refund cap reached; Joshua sends this amount`,
        amountUsdc: attempt.amountUsdc,
        amountUsdCents,
        sender: 'joshua',
        accrueEarning: false,
      });
      continue;
    }
    spent += amountUsdCents;
    rows.push({
      paymentAttemptId: attempt.id,
      kind: input.baseKind,
      reason,
      amountUsdc: attempt.amountUsdc,
      amountUsdCents,
      sender: 'system',
      accrueEarning: false,
    });
  }
  return rows;
}

export function planCancelRefunds(
  input: {
    phase: string;
    attempts: readonly RefundPaymentAttempt[];
    priorAutoRefunds: readonly PriorAutoRefund[];
    now: Date;
  },
  overrides?: Partial<RevmarketRefundConfig>,
): { refundable: boolean; refunds: PlannedRefund[] } {
  if (input.phase !== 'pending' && input.phase !== 'queued') {
    return { refundable: false, refunds: [] };
  }
  return {
    refundable: true,
    refunds: planAttemptRefunds(
      {
        attempts: input.attempts,
        priorAutoRefunds: input.priorAutoRefunds,
        now: input.now,
        baseKind: 'cancel',
      },
      overrides,
    ),
  };
}

export type DisputeOpenResult =
  | {
      ok: true;
      abuseFlag: boolean;
      earningStatus: 'held_for_dispute';
      windowEndsAt: Date;
      reason: string;
    }
  | {
      ok: false;
      error: 'written reason required' | 'dispute only after completion' | 'dispute window closed';
    };

export function planDisputeOpen(
  input: {
    phase: string;
    reason: string;
    completedAt: Date;
    now: Date;
    /** Disputes this customer already opened inside the abuse window. */
    priorDisputeCount: number;
  },
  overrides?: Partial<RevmarketRefundConfig>,
): DisputeOpenResult {
  const config = { ...DEFAULT_REFUND_CONFIG, ...overrides };
  const reason = input.reason.trim();
  if (reason.length === 0) return { ok: false, error: 'written reason required' };
  if (input.phase !== 'completed') return { ok: false, error: 'dispute only after completion' };

  const windowEndsAt = new Date(input.completedAt.getTime() + config.disputeWindowMs);
  if (input.now.getTime() > windowEndsAt.getTime()) {
    return { ok: false, error: 'dispute window closed' };
  }

  const abuseFlag = input.priorDisputeCount + 1 >= config.abuseDisputeCount;
  return { ok: true, abuseFlag, earningStatus: 'held_for_dispute', windowEndsAt, reason };
}

export function planPublisherReply(input: {
  existingReply: string | null;
  reply: string;
}):
  | { ok: true; reply: string }
  | { ok: false; error: 'publisher already replied' | 'reply required' } {
  if (input.existingReply != null && input.existingReply.trim().length > 0) {
    return { ok: false, error: 'publisher already replied' };
  }
  const reply = input.reply.trim();
  if (reply.length === 0) return { ok: false, error: 'reply required' };
  return { ok: true, reply };
}

export function planJoshuaDecision(input: {
  decision: 'refund' | 'deny';
  earningStatus: string | null;
  attempts: readonly RefundPaymentAttempt[];
  reason: string;
}):
  | { decision: 'deny'; nextEarningStatus: 'accrued' | null }
  | { decision: 'refund'; nextEarningStatus: 'dropped'; refunds: PlannedRefund[] } {
  if (input.decision === 'deny') {
    return {
      decision: 'deny',
      nextEarningStatus: input.earningStatus === 'held_for_dispute' ? 'accrued' : null,
    };
  }

  const reason =
    input.reason.trim().length > 0 ? input.reason.trim() : 'Joshua approved the refund';
  const refunds: PlannedRefund[] = [...input.attempts]
    .filter((attempt) => attempt.status === 'paid')
    .sort((a, b) => a.attemptNo - b.attemptNo)
    .flatMap((attempt) => {
      const amountUsdCents = usdcToCents(attempt.amountUsdc);
      if (amountUsdCents <= 0) return [];
      const row: PlannedRefund = {
        paymentAttemptId: attempt.id,
        kind: 'dispute',
        reason,
        amountUsdc: attempt.amountUsdc,
        amountUsdCents,
        sender: 'joshua',
        accrueEarning: false,
      };
      return [row];
    });

  return { decision: 'refund', nextEarningStatus: 'dropped', refunds };
}
