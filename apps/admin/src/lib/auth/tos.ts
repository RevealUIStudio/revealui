/**
 * Terms-of-Service acceptance capture for account creation.
 *
 * Single source for the default TOS version and the typed write that stamps
 * acceptance onto a user row. Used by every programmatic first-admin path that
 * goes through the engine's create() (web setup route, CLI `admin:bootstrap`)
 * plus the regular sign-up route, so the `TOS_VERSION` default lives in one
 * place instead of being re-inlined per call site.
 *
 * Why a typed Drizzle write rather than the engine's create(): `tos_accepted_at`
 * and `tos_version` are typed Postgres columns, but the engine's dynamic-SQL
 * create path writes the literal (camelCase) data keys as column identifiers and
 * rejects them via its snake_case identifier guard — and would JSON-stringify a
 * Date into an invalid timestamp literal besides. Drizzle maps camelCase fields
 * to their snake_case columns, so the typed path is the only one that persists
 * these columns correctly. See packages/setup/src/bootstrap/index.ts for the
 * matching engine-side note.
 */

import type { Database } from '@revealui/db/client';
import { eq } from '@revealui/db/orm';
import { users } from '@revealui/db/schema';

/** Default Terms-of-Service version stamped when `TOS_VERSION` is unset. */
export const DEFAULT_TOS_VERSION = '2026-03-01';

export interface TosAcceptance {
  /** When acceptance was recorded (account-creation time). */
  tosAcceptedAt: Date;
  /** The TOS version the account accepted. */
  tosVersion: string;
}

/**
 * Resolve the Terms-of-Service acceptance record for an account created now.
 * `tosAcceptedAt` is the current time; `tosVersion` is the `TOS_VERSION` env
 * value or the {@link DEFAULT_TOS_VERSION} fallback.
 */
export function getTosAcceptance(): TosAcceptance {
  return {
    tosAcceptedAt: new Date(),
    tosVersion: process.env.TOS_VERSION ?? DEFAULT_TOS_VERSION,
  };
}

/**
 * Stamp TOS acceptance onto the user with the given email via a typed Drizzle
 * update. For creation-time use: sets both columns unconditionally. A no-op if
 * no row matches the email (e.g. the create was rolled back upstream).
 */
export async function stampTosAcceptanceByEmail(db: Database, email: string): Promise<void> {
  const { tosAcceptedAt, tosVersion } = getTosAcceptance();
  await db.update(users).set({ tosAcceptedAt, tosVersion }).where(eq(users.email, email));
}
