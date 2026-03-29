/**
 * RevealCoin Anti-Manipulation Safeguards
 *
 * Prevents pump-and-dump schemes, arbitrage exploitation, and payment
 * fraud through configurable rate limits, price circuit breakers, and
 * transaction validation rules.
 *
 * All thresholds are parameterized per monorepo convention.
 */

import { createLogger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { revealcoinPayments, revealcoinPriceSnapshots } from '@revealui/db/schema';
import { and, desc, eq, gte, sql } from 'drizzle-orm';

const logger = createLogger({ service: 'RevealCoin:Safeguards' });

// =============================================================================
// Configuration
// =============================================================================

export interface RevealCoinSafeguardsConfig {
  /** TWAP window in milliseconds. Default: 3_600_000 (1 hour) */
  twapWindowMs: number;
  /** Price drop threshold (0–1) to trigger circuit breaker. Default: 0.30 (30%) */
  priceCircuitBreakerThreshold: number;
  /** Recovery check interval after circuit breaker trips. Default: 3_600_000 (1 hour) */
  priceRecoveryCheckMs: number;
  /** Max RVUI payments per wallet per hour. Default: 3 */
  maxPaymentsPerWalletPerHour: number;
  /** Max single payment in USD equivalent. Default: 500 */
  maxSinglePaymentUsd: number;
  /** Minimum token hold period in milliseconds. Default: 86_400_000 (24 hours) */
  minHoldPeriodMs: number;
  /** Max monthly discount savings per user in USD. Default: 100 */
  maxMonthlyDiscountUsd: number;
}

const DEFAULT_CONFIG: RevealCoinSafeguardsConfig = {
  twapWindowMs: 3_600_000,
  priceCircuitBreakerThreshold: 0.3,
  priceRecoveryCheckMs: 3_600_000,
  maxPaymentsPerWalletPerHour: 3,
  maxSinglePaymentUsd: 500,
  minHoldPeriodMs: 86_400_000,
  maxMonthlyDiscountUsd: 100,
};

let config: RevealCoinSafeguardsConfig = { ...DEFAULT_CONFIG };

export function configureSafeguards(overrides: Partial<RevealCoinSafeguardsConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
}

export function getSafeguardsConfig(): RevealCoinSafeguardsConfig {
  return { ...config };
}

export function resetSafeguardsConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

// =============================================================================
// TWAP Price Oracle
// =============================================================================

/**
 * Calculate the time-weighted average price of RVUI in USD over the configured window.
 *
 * Uses price snapshots stored in the database. Returns null if insufficient
 * data is available (fewer than 2 snapshots in the window).
 */
export async function getTwapPrice(): Promise<number | null> {
  const db = getClient();
  const windowStart = new Date(Date.now() - config.twapWindowMs);

  const snapshots = await db
    .select()
    .from(revealcoinPriceSnapshots)
    .where(gte(revealcoinPriceSnapshots.recordedAt, windowStart))
    .orderBy(revealcoinPriceSnapshots.recordedAt);

  if (snapshots.length < 2) {
    logger.warn('Insufficient price snapshots for TWAP calculation', {
      snapshotCount: snapshots.length,
      windowMs: config.twapWindowMs,
    });
    return null;
  }

  // Time-weighted average: sum(price_i * duration_i) / total_duration
  let weightedSum = 0;
  let totalDuration = 0;

  for (let i = 0; i < snapshots.length - 1; i++) {
    const current = snapshots[i];
    const next = snapshots[i + 1];
    if (!(current && next)) continue;
    const duration = next.recordedAt.getTime() - current.recordedAt.getTime();
    const price = Number(current.priceUsd);
    weightedSum += price * duration;
    totalDuration += duration;
  }

  if (totalDuration === 0) return null;
  return weightedSum / totalDuration;
}

// =============================================================================
// Price Circuit Breaker
// =============================================================================

/**
 * Check if the price circuit breaker should block RVUI payments.
 *
 * Compares the latest snapshot price to the TWAP. If the latest price
 * has dropped more than the threshold below the TWAP, payments are blocked.
 */
export async function isPriceCircuitBreakerOpen(): Promise<boolean> {
  const db = getClient();

  const [latest] = await db
    .select()
    .from(revealcoinPriceSnapshots)
    .orderBy(desc(revealcoinPriceSnapshots.recordedAt))
    .limit(1);

  if (!latest) return true; // No price data — block payments

  const twap = await getTwapPrice();
  if (twap === null) return true; // Insufficient data — block payments

  const currentPrice = Number(latest.priceUsd);
  const dropPercent = (twap - currentPrice) / twap;

  if (dropPercent >= config.priceCircuitBreakerThreshold) {
    logger.warn('RVUI price circuit breaker OPEN — price drop exceeds threshold', {
      twap,
      currentPrice,
      dropPercent: `${(dropPercent * 100).toFixed(1)}%`,
      threshold: `${(config.priceCircuitBreakerThreshold * 100).toFixed(0)}%`,
    });
    return true;
  }

  return false;
}

// =============================================================================
// Rate Limiting
// =============================================================================

/**
 * Check if a wallet has exceeded the per-hour payment rate limit.
 */
export async function isWalletRateLimited(walletAddress: string): Promise<boolean> {
  const db = getClient();
  const oneHourAgo = new Date(Date.now() - 3_600_000);

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(revealcoinPayments)
    .where(
      and(
        eq(revealcoinPayments.walletAddress, walletAddress),
        gte(revealcoinPayments.createdAt, oneHourAgo),
      ),
    );

  const count = result?.count ?? 0;
  return count >= config.maxPaymentsPerWalletPerHour;
}

// =============================================================================
// Discount Abuse Prevention
// =============================================================================

/**
 * Check if a user has exceeded their monthly discount savings cap.
 */
export async function isDiscountCapExceeded(userId: string): Promise<boolean> {
  const db = getClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [result] = await db
    .select({ total: sql<number>`coalesce(sum(${revealcoinPayments.discountUsd}), 0)::numeric` })
    .from(revealcoinPayments)
    .where(
      and(eq(revealcoinPayments.userId, userId), gte(revealcoinPayments.createdAt, monthStart)),
    );

  const totalDiscount = Number(result?.total ?? 0);
  return totalDiscount >= config.maxMonthlyDiscountUsd;
}

// =============================================================================
// Duplicate Transaction Rejection
// =============================================================================

/**
 * Check if a transaction signature has already been recorded.
 */
export async function isDuplicateTransaction(txSignature: string): Promise<boolean> {
  const db = getClient();

  const [existing] = await db
    .select({ id: revealcoinPayments.id })
    .from(revealcoinPayments)
    .where(eq(revealcoinPayments.txSignature, txSignature))
    .limit(1);

  return existing !== undefined;
}

// =============================================================================
// Payment Amount Validation
// =============================================================================

/**
 * Check if a payment amount exceeds the single-transaction USD cap.
 */
export function isPaymentOverMaximum(amountUsd: number): boolean {
  return amountUsd > config.maxSinglePaymentUsd;
}

// =============================================================================
// Composite Validation
// =============================================================================

export interface SafeguardCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Run all safeguard checks for an incoming RVUI payment.
 *
 * Returns `{ allowed: true }` if all checks pass, or `{ allowed: false, reason }`
 * with the first failing check's reason.
 */
export async function validatePayment(params: {
  walletAddress: string;
  userId: string;
  txSignature: string;
  amountUsd: number;
}): Promise<SafeguardCheckResult> {
  // 1. Duplicate transaction
  if (await isDuplicateTransaction(params.txSignature)) {
    return { allowed: false, reason: 'Transaction signature already used' };
  }

  // 2. Price circuit breaker
  if (await isPriceCircuitBreakerOpen()) {
    return { allowed: false, reason: 'RVUI payments temporarily disabled due to price volatility' };
  }

  // 3. Single payment cap
  if (isPaymentOverMaximum(params.amountUsd)) {
    return {
      allowed: false,
      reason: `Payment exceeds maximum of $${config.maxSinglePaymentUsd} USD. Use fiat for larger amounts.`,
    };
  }

  // 4. Wallet rate limit
  if (await isWalletRateLimited(params.walletAddress)) {
    return {
      allowed: false,
      reason: `Wallet rate limit exceeded (max ${config.maxPaymentsPerWalletPerHour} payments/hour)`,
    };
  }

  // 5. Monthly discount cap
  if (await isDiscountCapExceeded(params.userId)) {
    return {
      allowed: false,
      reason: `Monthly RVUI discount cap of $${config.maxMonthlyDiscountUsd} reached`,
    };
  }

  return { allowed: true };
}

// =============================================================================
// Price Snapshot Recording
// =============================================================================

/**
 * Record a price snapshot for TWAP calculation.
 * Called periodically by a cron job or price feed listener.
 */
export async function recordPriceSnapshot(priceUsd: number, source: string): Promise<void> {
  const db = getClient();
  await db.insert(revealcoinPriceSnapshots).values({
    id: crypto.randomUUID(),
    priceUsd: String(priceUsd),
    source,
    recordedAt: new Date(),
  });
}

// =============================================================================
// Payment Recording
// =============================================================================

/**
 * Record a verified RVUI payment in the database.
 */
export async function recordPayment(params: {
  txSignature: string;
  walletAddress: string;
  userId: string;
  amountRvui: string;
  amountUsd: number;
  discountUsd: number;
  purpose: string;
}): Promise<void> {
  const db = getClient();
  await db.insert(revealcoinPayments).values({
    id: crypto.randomUUID(),
    txSignature: params.txSignature,
    walletAddress: params.walletAddress,
    userId: params.userId,
    amountRvui: params.amountRvui,
    amountUsd: String(params.amountUsd),
    discountUsd: String(params.discountUsd),
    purpose: params.purpose,
    status: 'verified',
    createdAt: new Date(),
  });
}
