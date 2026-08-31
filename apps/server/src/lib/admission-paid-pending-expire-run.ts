/**
 * GAP-256 PR-8 optional reclaim — suspend unpaid paid_signup after TTL (default 48h).
 *
 * Identity may exist for Checkout, but abandoned paid-pending must not linger
 * as an active account. Detected without a metadata column: source=signup,
 * maxAgentTasks=0, aiLocal=false, breaker not tripped (K20 vs K7).
 */
import { logger } from '@revealui/core/observability/logger';
import { accountEntitlements, accounts } from '@revealui/db/schema';
import { and, eq, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import type { MarginDb } from './margin-mrr.js';

export const DEFAULT_PAID_PENDING_EXPIRE_HOURS = 48;

export function isAdmissionPaidPendingExpireEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.ADMISSION_PAID_PENDING_EXPIRE_ENABLED === 'true';
}

export function paidPendingExpireTtlMs(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): number {
  const raw = env.ADMISSION_PAID_PENDING_EXPIRE_HOURS;
  const hours =
    raw != null && raw !== '' ? Number.parseInt(raw, 10) : DEFAULT_PAID_PENDING_EXPIRE_HOURS;
  const safe = Number.isFinite(hours) && hours >= 1 ? hours : DEFAULT_PAID_PENDING_EXPIRE_HOURS;
  return safe * 60 * 60 * 1000;
}

/** Pure predicate for tests (lockstep with the SQL filter). */
export function shouldExpirePaidPending(
  row: {
    source: string;
    accountStatus: string;
    meteringStatus: string;
    maxAgentTasks: number | null | undefined;
    aiLocal: boolean | undefined;
    cogsBreakerTrippedAt: Date | null;
    lastEventAt: Date | null;
    updatedAt: Date | null;
  },
  now: Date,
  ttlMs: number,
): boolean {
  if (row.source !== 'signup') return false;
  if (row.accountStatus !== 'active') return false;
  if (row.meteringStatus === 'paused') return false;
  if (row.cogsBreakerTrippedAt != null) return false;
  if (row.maxAgentTasks !== 0) return false;
  if (row.aiLocal !== false) return false;
  const clock = row.lastEventAt ?? row.updatedAt;
  if (clock == null) return false;
  return now.getTime() - clock.getTime() >= ttlMs;
}

export interface RunAdmissionPaidPendingExpireResult {
  skipped: boolean;
  reason?: string;
  examined?: number;
  expired?: number;
}

export async function runAdmissionPaidPendingExpire(
  db: MarginDb,
  options?: {
    now?: Date;
    env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  },
): Promise<RunAdmissionPaidPendingExpireResult> {
  const env = options?.env ?? process.env;
  if (!isAdmissionPaidPendingExpireEnabled(env)) {
    return { skipped: true, reason: 'ADMISSION_PAID_PENDING_EXPIRE_ENABLED not true' };
  }

  const now = options?.now ?? new Date();
  const ttlMs = paidPendingExpireTtlMs(env);
  const cutoff = new Date(now.getTime() - ttlMs);

  const candidates = (await db
    .select({
      accountId: accountEntitlements.accountId,
    })
    .from(accountEntitlements)
    .innerJoin(accounts, eq(accounts.id, accountEntitlements.accountId))
    .where(
      and(
        eq(accountEntitlements.source, 'signup'),
        eq(accounts.status, 'active'),
        eq(accountEntitlements.meteringStatus, 'active'),
        isNull(accountEntitlements.cogsBreakerTrippedAt),
        sql`coalesce((${accountEntitlements.limits}->>'maxAgentTasks')::int, -1) = 0`,
        sql`(${accountEntitlements.features}->>'aiLocal') = 'false'`,
        or(
          and(
            isNotNull(accountEntitlements.lastEventAt),
            lte(accountEntitlements.lastEventAt, cutoff),
          ),
          and(isNull(accountEntitlements.lastEventAt), lte(accountEntitlements.updatedAt, cutoff)),
        ),
      ),
    )) as Array<{ accountId: string }>;

  const ids = [...new Set(candidates.map((r) => r.accountId))];
  if (ids.length === 0) {
    return { skipped: false, examined: 0, expired: 0 };
  }

  await db
    .update(accounts)
    .set({ status: 'suspended', updatedAt: now })
    .where(inArray(accounts.id, ids));
  await db
    .update(accountEntitlements)
    .set({ meteringStatus: 'paused', updatedAt: now })
    .where(inArray(accountEntitlements.accountId, ids));

  logger.info('[admission-paid-pending-expire] suspended unpaid paid-pending', {
    expired: ids.length,
  });
  return { skipped: false, examined: ids.length, expired: ids.length };
}
