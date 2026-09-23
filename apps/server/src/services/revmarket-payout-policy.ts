/**
 * Revmarket publisher pay (USDC treated as USD after the owner's bridge).
 *
 * The sweep does not trade USDC. The owner deposits bridged USD into the
 * platform Stripe balance. This module reads that balance at most once per
 * sweep and transfers it to each publisher's existing Connect account.
 */

import { createHash } from 'node:crypto';

export interface RevmarketPayoutConfig {
  /** Unpaid 80% that must be reached before a publisher is paid. Default $25. */
  minUnpaidCents: number;
  /** Publisher share in basis points. 8000 = 80%. */
  shareBps: number;
  /** Hold after completion before an earning can be swept. Default 7 days. */
  disputeHoldMs: number;
}

const DEFAULT_CONFIG: RevmarketPayoutConfig = {
  minUnpaidCents: 2500,
  shareBps: 8000,
  disputeHoldMs: 7 * 24 * 60 * 60 * 1000,
};

/** Postgres integer max. Larger shares are refused instead of truncated. */
const MAX_LEDGER_CENTS = 2_147_483_647;

let config: RevmarketPayoutConfig = { ...DEFAULT_CONFIG };

export function configureRevmarketPayout(overrides: Partial<RevmarketPayoutConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
}

export function revmarketPayoutConfig(): RevmarketPayoutConfig {
  return config;
}

export type EarningStatus =
  | 'accrued'
  | 'held_for_dispute'
  | 'released_to_payout'
  | 'paid'
  | 'dropped';

export interface SweepEarning {
  id: string;
  publisherId: string;
  amountUsdCents: number;
  status: EarningStatus;
  payableAt: Date;
  stripeAccountId: string | null;
}

export interface PlannedPayout {
  publisherId: string;
  stripeAccountId: string;
  earningIds: string[];
  amountUsdCents: number;
}

export interface SweepPlan {
  payouts: PlannedPayout[];
  skippedBelowMinimum: string[];
  skippedConflict: string[];
  /** 1 when any publisher meets the minimum (one balance read). Otherwise 0. */
  conversionCalls: 0 | 1;
}

export interface CompletedTaskAccrual {
  amountUsdCents: number;
  payableAt: Date;
}

const USDC_MICRO_DIGITS = 6;
const USDC_PATTERN = /^\d+(\.\d+)?$/;

function digitsToBigInt(digits: string): bigint {
  const stripped = digits.replace(/^0+/, '');
  return BigInt(stripped.length > 0 ? stripped : '0');
}

/**
 * 80% of a USDC text amount, in USD cents, rounded down.
 * 1 USDC is treated as 1 USD. Returns 0 when the value is missing, not a
 * decimal, or would not fit in the ledger integer column.
 */
export function publisherShareCents(costUsdc: string | null | undefined): number {
  if (costUsdc == null) return 0;
  const trimmed = costUsdc.trim();
  if (!USDC_PATTERN.test(trimmed)) return 0;

  const [whole = '0', fraction = ''] = trimmed.split('.');
  const micros = `${fraction}${'0'.repeat(USDC_MICRO_DIGITS)}`.slice(0, USDC_MICRO_DIGITS);
  const micro = digitsToBigInt(whole) * 1_000_000n + digitsToBigInt(micros);
  const cents = (micro * BigInt(config.shareBps)) / 100_000_000n;
  if (cents <= 0n || cents > BigInt(MAX_LEDGER_CENTS)) return 0;
  return Number(cents);
}

export function payableAtFrom(completedAt: Date): Date {
  return new Date(completedAt.getTime() + config.disputeHoldMs);
}

/** Accrual for a successful completion. Failed / zero-share tasks accrue nothing. */
export function accrualForCompletedTask(input: {
  success: boolean;
  costUsdc: string | null | undefined;
  completedAt: Date;
}): CompletedTaskAccrual | null {
  if (!input.success) return null;
  const amountUsdCents = publisherShareCents(input.costUsdc);
  if (amountUsdCents <= 0) return null;
  return { amountUsdCents, payableAt: payableAtFrom(input.completedAt) };
}

/** Monday UTC calendar date (YYYY-MM-DD) for the week containing `now`. */
export function weekStartUtc(now: Date): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = day.getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  day.setUTCDate(day.getUTCDate() - daysSinceMonday);
  return day.toISOString().slice(0, 10);
}

export function isWeeklySweepDay(now: Date): boolean {
  return now.getUTCDay() === 1;
}

export function payoutIdempotencyKey(
  publisherId: string,
  weekStart: string,
  earningIds: readonly string[],
): string {
  const digest = createHash('sha256')
    .update([...earningIds].sort().join(':'))
    .digest('hex')
    .slice(0, 32);
  return `revmarket-payout-${publisherId}-${weekStart}-${digest}`;
}

/**
 * Group accrued, payable earnings that share one Connect account.
 * Spend `bridgedUsdCents` in publisher-id order. Stop when the next payout
 * does not fit. Publishers under the minimum are not a conversion.
 */
export function planWeeklySweep(input: {
  now: Date;
  earnings: readonly SweepEarning[];
  bridgedUsdCents: number;
}): SweepPlan {
  const groups = new Map<string, { accounts: Set<string>; ids: string[]; sum: number }>();

  for (const earning of input.earnings) {
    if (earning.status !== 'accrued') continue;
    if (earning.payableAt.getTime() > input.now.getTime()) continue;
    if (!earning.stripeAccountId) continue;
    if (!Number.isInteger(earning.amountUsdCents) || earning.amountUsdCents <= 0) continue;

    const group = groups.get(earning.publisherId) ?? {
      accounts: new Set<string>(),
      ids: [],
      sum: 0,
    };
    group.accounts.add(earning.stripeAccountId);
    group.ids.push(earning.id);
    group.sum += earning.amountUsdCents;
    groups.set(earning.publisherId, group);
  }

  const skippedBelowMinimum: string[] = [];
  const skippedConflict: string[] = [];
  const candidates: PlannedPayout[] = [];

  for (const publisherId of [...groups.keys()].sort()) {
    const group = groups.get(publisherId);
    if (!group) continue;
    if (group.accounts.size !== 1) {
      skippedConflict.push(publisherId);
      continue;
    }
    if (group.sum < config.minUnpaidCents) {
      skippedBelowMinimum.push(publisherId);
      continue;
    }
    const [stripeAccountId] = group.accounts;
    if (!stripeAccountId) continue;
    candidates.push({
      publisherId,
      stripeAccountId,
      earningIds: [...group.ids].sort(),
      amountUsdCents: group.sum,
    });
  }

  let remaining = input.bridgedUsdCents;
  const payouts: PlannedPayout[] = [];
  for (const candidate of candidates) {
    if (remaining < candidate.amountUsdCents) break;
    payouts.push(candidate);
    remaining -= candidate.amountUsdCents;
  }

  return {
    payouts,
    skippedBelowMinimum,
    skippedConflict,
    conversionCalls: candidates.length > 0 ? 1 : 0,
  };
}

export interface SweepDeps {
  now: Date;
  /** Run even when `now` is not Monday UTC. */
  force?: boolean;
  loadEligible: () => Promise<readonly SweepEarning[]>;
  readBridgedUsdCents: () => Promise<number>;
  transfer: (payout: PlannedPayout, idempotencyKey: string) => Promise<{ transferId: string }>;
  markPaid: (payout: PlannedPayout & { transferId: string; weekStart: string }) => Promise<void>;
  markFailed: (payout: PlannedPayout & { weekStart: string; error: string }) => Promise<void>;
}

export interface WeeklySweepResult {
  ran: boolean;
  reason: 'not-monday' | 'none-eligible' | 'swept';
  conversionCalls: number;
  paid: Array<PlannedPayout & { transferId: string }>;
  failed: Array<{ publisherId: string; error: string }>;
  skippedBelowMinimum: string[];
  skippedConflict: string[];
  bridgedUsdCents: number | null;
}

export async function executeWeeklySweep(deps: SweepDeps): Promise<WeeklySweepResult> {
  if (!(deps.force || isWeeklySweepDay(deps.now))) {
    return {
      ran: false,
      reason: 'not-monday',
      conversionCalls: 0,
      paid: [],
      failed: [],
      skippedBelowMinimum: [],
      skippedConflict: [],
      bridgedUsdCents: null,
    };
  }

  const earnings = await deps.loadEligible();
  const preview = planWeeklySweep({
    now: deps.now,
    earnings,
    bridgedUsdCents: Number.MAX_SAFE_INTEGER,
  });

  if (preview.conversionCalls === 0) {
    return {
      ran: true,
      reason: 'none-eligible',
      conversionCalls: 0,
      paid: [],
      failed: [],
      skippedBelowMinimum: preview.skippedBelowMinimum,
      skippedConflict: preview.skippedConflict,
      bridgedUsdCents: null,
    };
  }

  const bridgedUsdCents = await deps.readBridgedUsdCents();
  const plan = planWeeklySweep({ now: deps.now, earnings, bridgedUsdCents });
  const weekStart = weekStartUtc(deps.now);
  const paid: WeeklySweepResult['paid'] = [];
  const failed: WeeklySweepResult['failed'] = [];

  for (const payout of plan.payouts) {
    const idempotencyKey = payoutIdempotencyKey(payout.publisherId, weekStart, payout.earningIds);
    try {
      const { transferId } = await deps.transfer(payout, idempotencyKey);
      try {
        await deps.markPaid({ ...payout, transferId, weekStart });
        paid.push({ ...payout, transferId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failed.push({
          publisherId: payout.publisherId,
          error: `unmarked-after-transfer: ${message}`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await deps.markFailed({ ...payout, weekStart, error: message });
      failed.push({ publisherId: payout.publisherId, error: message });
    }
  }

  return {
    ran: true,
    reason: 'swept',
    conversionCalls: 1,
    paid,
    failed,
    skippedBelowMinimum: plan.skippedBelowMinimum,
    skippedConflict: plan.skippedConflict,
    bridgedUsdCents,
  };
}
