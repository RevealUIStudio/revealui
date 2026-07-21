/**
 * First-ever usage_meters writers for GAP-300 nudge milestones.
 *
 * Uses stable idempotency keys so retries and repeat page loads collapse to
 * one row (recordUsageMeter → onConflictDoNothing). Failures are best-effort:
 * callers must never let a metering error block the user-facing response.
 */

import { randomUUID } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { recordUsageMeter } from '../metering.js';
import { AUDIT_EXPORT_METER_NAME } from './triggers.js';

/** First successful GET /admin/audit list (viewed the trail once). */
export const AUDIT_VIEW_METER_NAME = 'audit_view';

/**
 * Free-tier Pro gate denial (knowingly hit a paid feature).
 * Writer lives with requireFeature (security-reviewed surface); constant
 * reserved so a follow-up PR can record without redefining the name.
 */
export const UPGRADE_INTENT_METER_NAME = 'upgrade_intent';

export { AUDIT_EXPORT_METER_NAME };

export type MilestoneMeterName =
  | typeof UPGRADE_INTENT_METER_NAME
  | typeof AUDIT_VIEW_METER_NAME
  | typeof AUDIT_EXPORT_METER_NAME;

/**
 * Record a first-ever milestone meter for an account. Safe to call on every
 * request: the unique idempotency key is stable per (account, meter).
 */
export async function recordMilestoneMeterFirst(
  accountId: string,
  meterName: MilestoneMeterName,
): Promise<void> {
  const now = new Date();
  await recordUsageMeter({
    id: randomUUID(),
    accountId,
    meterName,
    quantity: 1,
    periodStart: now,
    source: 'user',
    idempotencyKey: `nudge:${meterName}:first:${accountId}`,
  });
}

/** Best-effort wrapper for middleware/route paths that must not fail closed. */
export function recordMilestoneMeterFirstSafe(
  accountId: string | null | undefined,
  meterName: MilestoneMeterName,
  logContext: Record<string, unknown>,
): void {
  if (!accountId) return;
  void recordMilestoneMeterFirst(accountId, meterName).catch((err: unknown) => {
    logger.warn('nudge milestone meter write failed (request continues)', {
      ...logContext,
      accountId,
      meterName,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
