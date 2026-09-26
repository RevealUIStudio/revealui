/**
 * Pure budget window and threshold math.
 *
 * SQL in `budget_apply_spend` uses the same UTC boundaries. Session TimeZone
 * must not move a window; these helpers only read UTC fields.
 */

import type { BudgetWindowKind } from '../schema/budgets.js';

/** Paperclip's default. Used when a policy turns warnings on and omits a percent. */
export const PAPERCLIP_DEFAULT_WARN_PERCENT = 80;

export interface BudgetLimitConfig {
  /** Warn percent applied when warnings are enabled and the caller omits one. */
  defaultWarnPercent: number;
}

const DEFAULT_LIMIT_CONFIG: BudgetLimitConfig = {
  defaultWarnPercent: PAPERCLIP_DEFAULT_WARN_PERCENT,
};

let limitConfig: BudgetLimitConfig = { ...DEFAULT_LIMIT_CONFIG };

export function configureBudgetLimits(overrides: Partial<BudgetLimitConfig> | null): void {
  if (overrides === null) {
    limitConfig = { ...DEFAULT_LIMIT_CONFIG };
    return;
  }
  limitConfig = { ...DEFAULT_LIMIT_CONFIG, ...overrides };
}

export function defaultWarnPercent(): number {
  return limitConfig.defaultWarnPercent;
}

/** Epoch. One ledger row for the life of a lifetime policy. */
export const LIFETIME_WINDOW_START = new Date(0);

export function windowStart(kind: BudgetWindowKind, at: Date): Date {
  if (Number.isNaN(at.getTime())) {
    throw new Error('budget windowStart: invalid date');
  }
  if (kind === 'lifetime') return new Date(LIFETIME_WINDOW_START.getTime());
  if (kind === 'calendar_day_utc') {
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  }
  if (kind === 'calendar_month_utc') {
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  }
  throw new Error(`budget windowStart: unknown window kind ${kind}`);
}

/**
 * Null when warnings are off. When they are on and `warnPercent` is omitted,
 * the configured default (80) is used. An explicit percent must be an integer
 * from 1 to 99, matching `budget_policies_warn_check`.
 */
export function normalizeWarnPercent(
  warningsEnabled: boolean,
  warnPercent?: number | null,
): number | null {
  if (!warningsEnabled) return null;
  if (warnPercent === undefined || warnPercent === null) return defaultWarnPercent();
  if (!Number.isInteger(warnPercent) || warnPercent <= 0 || warnPercent >= 100) {
    throw new Error('budget warnPercent must be an integer from 1 to 99');
  }
  return warnPercent;
}

/** Floor of limit * percent / 100. Null when the policy does not warn. */
export function warnAmount(limitAmount: number, warnPercent: number | null): number | null {
  if (warnPercent === null) return null;
  return Math.floor((limitAmount * warnPercent) / 100);
}

export function crossesWarn(before: number, after: number, threshold: number | null): boolean {
  if (threshold === null) return false;
  return before < threshold && after >= threshold;
}

/** Hard stop trips when spend moves from within the limit to strictly over it. */
export function crossesHardStop(
  before: number,
  after: number,
  limitAmount: number,
  hardStop: boolean,
): boolean {
  if (!hardStop) return false;
  return before <= limitAmount && after > limitAmount;
}

/** Count metrics refuse a reserve that would pass a hard-stop limit. */
export function wouldExceedHardStop(
  spent: number,
  units: number,
  limitAmount: number,
  hardStop: boolean,
): boolean {
  if (!hardStop) return false;
  return spent + units > limitAmount;
}
