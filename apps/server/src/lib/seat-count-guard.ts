/**
 * Seat count guard — per-account membership cap enforcement.
 *
 * Issue #397 (CR8-P2-03): `accountMemberships` inserts had no cap check.
 * A Pro-tier team (maxUsers=25) could silently add 200 members.
 *
 * This module provides an application-level guard that callers MUST invoke
 * before inserting a new active membership. A database trigger is tracked
 * separately as defense-in-depth (to catch direct-SQL paths) and will land
 * via a drizzle-kit-generated migration — see `MASTER_PLAN §CR-8 CR8-P2-03`.
 *
 * Usage:
 *
 * ```ts
 * import { getHostedLimitsForTier } from './tier-limits.js';
 * import { assertSeatAvailable } from './seat-count-guard.js';
 *
 * const limits = getHostedLimitsForTier(tier);
 * await assertSeatAvailable(tx, accountId, limits.maxUsers);
 * await tx.insert(accountMemberships).values({ ... });
 * ```
 *
 * The guard throws `SeatLimitReachedError` (not a generic Error) so API
 * handlers can catch it and return a structured 402 `seat_limit_reached`
 * response instead of a 500.
 */

import { accountMemberships } from '@revealui/db/schema';
import { and, count, eq } from 'drizzle-orm';

export interface SeatLimitReachedDetails {
  accountId: string;
  current: number;
  max: number;
}

/**
 * Thrown when an `accountMemberships` insert would exceed the account's
 * tier-based maxUsers cap. Carries structured fields so API routes can
 * render a 402 with an actionable upgrade link.
 */
export class SeatLimitReachedError extends Error {
  readonly code = 'seat_limit_reached' as const;
  readonly accountId: string;
  readonly current: number;
  readonly max: number;

  constructor(details: SeatLimitReachedDetails) {
    super(
      `Seat limit reached for account ${details.accountId} (${details.current}/${details.max}). Upgrade the tier to add more members.`,
    );
    this.name = 'SeatLimitReachedError';
    this.accountId = details.accountId;
    this.current = details.current;
    this.max = details.max;
  }
}

/**
 * Asserts that adding one more active membership to `accountId` would not
 * exceed the cap. Caller resolves `maxUsers` from the tier — unlimited
 * tiers (enterprise) pass `undefined` or `null` to skip the check.
 *
 * **Behavior:**
 * - `maxUsers` is `undefined` / `null` → no-op (enterprise / unlimited)
 * - current active count `< maxUsers` → resolves
 * - current active count `>= maxUsers` → throws `SeatLimitReachedError`
 *
 * **Concurrency note:** this is a read-then-decide check. Two concurrent
 * inserts can both read `count < max` and both proceed, overshooting the
 * cap by one. That's acceptable at the application level — the DB-trigger
 * follow-up (CR8-P2-03 defense-in-depth) closes the last-writer race.
 */
export async function assertSeatAvailable(
  db: unknown,
  accountId: string,
  maxUsers: number | null | undefined,
): Promise<void> {
  if (maxUsers == null) return; // enterprise / unlimited sentinel

  // `db` is typed `unknown` to accept Drizzle's HTTP client + tx callback
  // shapes without importing either directly (keeps this module testable
  // without a real DB). Cast at the query boundary.
  // biome-ignore lint/suspicious/noExplicitAny: narrow Drizzle client types differ between HTTP client and tx callback
  const result = await (db as any)
    .select({ count: count() })
    .from(accountMemberships)
    .where(
      and(eq(accountMemberships.accountId, accountId), eq(accountMemberships.status, 'active')),
    );

  const current = Number(result[0]?.count ?? 0);

  if (current >= maxUsers) {
    throw new SeatLimitReachedError({ accountId, current, max: maxUsers });
  }
}
