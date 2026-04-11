/**
 * Stale Token Cleanup
 *
 * Deletes expired/revoked rows from auth tables that accumulate over time.
 * Mirrors the Vercel cron route logic so cleanup can be triggered manually
 * via `revealui db cleanup` when crons are unavailable (e.g. Hobby plan).
 *
 * Tables:
 * - sessions              -  expiresAt < now OR deletedAt IS NOT NULL
 * - rate_limits           -  resetAt < now
 * - password_reset_tokens  -  expiresAt < now
 * - magic_links           -  expiresAt < now
 * - pages (scheduled)     -  status = 'scheduled' AND scheduledAt <= now
 *
 * Idempotent  -  safe to run multiple times.
 */

import { and, eq, isNotNull, lt, lte, or } from 'drizzle-orm';
import { getClient } from '../client/index.js';
import { magicLinks } from '../schema/magic-links.js';
import { pages } from '../schema/pages.js';
import { passwordResetTokens } from '../schema/password-reset-tokens.js';
import { rateLimits } from '../schema/rate-limits.js';
import { sessions } from '../schema/users.js';

export type CleanupTable =
  | 'sessions'
  | 'rateLimits'
  | 'passwordResetTokens'
  | 'magicLinks'
  | 'scheduledPages';

export interface StaleTokenCleanupOptions {
  /** When true, counts rows without deleting (default: false) */
  dryRun?: boolean;
  /** Limit cleanup to specific tables; defaults to all */
  tables?: CleanupTable[];
}

export interface StaleTokenCleanupResult {
  sessions: number;
  rateLimits: number;
  passwordResetTokens: number;
  magicLinks: number;
  scheduledPages: number;
  dryRun: boolean;
}

const ALL_TABLES: CleanupTable[] = [
  'sessions',
  'rateLimits',
  'passwordResetTokens',
  'magicLinks',
  'scheduledPages',
];

/**
 * Cleans up (or counts, in dry-run mode) stale rows from auth tables.
 * Reads POSTGRES_URL / DATABASE_URL from the environment via getClient().
 */
export async function cleanupStaleTokens(
  options: StaleTokenCleanupOptions = {},
): Promise<StaleTokenCleanupResult> {
  const { dryRun = false, tables = ALL_TABLES } = options;
  const db = getClient();
  const now = new Date();

  const result: StaleTokenCleanupResult = {
    sessions: 0,
    rateLimits: 0,
    passwordResetTokens: 0,
    magicLinks: 0,
    scheduledPages: 0,
    dryRun,
  };

  if (tables.includes('sessions')) {
    const where = or(lt(sessions.expiresAt, now), isNotNull(sessions.deletedAt));
    if (dryRun) {
      const rows = await db.select({ id: sessions.id }).from(sessions).where(where);
      result.sessions = rows.length;
    } else {
      const deleted = await db.delete(sessions).where(where).returning();
      result.sessions = deleted.length;
    }
  }

  if (tables.includes('rateLimits')) {
    const where = lt(rateLimits.resetAt, now);
    if (dryRun) {
      const rows = await db.select({ key: rateLimits.key }).from(rateLimits).where(where);
      result.rateLimits = rows.length;
    } else {
      const deleted = await db.delete(rateLimits).where(where).returning();
      result.rateLimits = deleted.length;
    }
  }

  if (tables.includes('passwordResetTokens')) {
    const where = lt(passwordResetTokens.expiresAt, now);
    if (dryRun) {
      const rows = await db
        .select({ id: passwordResetTokens.id })
        .from(passwordResetTokens)
        .where(where);
      result.passwordResetTokens = rows.length;
    } else {
      const deleted = await db.delete(passwordResetTokens).where(where).returning();
      result.passwordResetTokens = deleted.length;
    }
  }

  if (tables.includes('magicLinks')) {
    const where = lt(magicLinks.expiresAt, now);
    if (dryRun) {
      const rows = await db.select({ id: magicLinks.id }).from(magicLinks).where(where);
      result.magicLinks = rows.length;
    } else {
      const deleted = await db.delete(magicLinks).where(where).returning();
      result.magicLinks = deleted.length;
    }
  }

  if (tables.includes('scheduledPages')) {
    const where = and(
      eq(pages.status, 'scheduled'),
      isNotNull(pages.scheduledAt),
      lte(pages.scheduledAt, now),
    );
    if (dryRun) {
      const rows = await db.select({ id: pages.id }).from(pages).where(where);
      result.scheduledPages = rows.length;
    } else {
      const due = await db.select({ id: pages.id }).from(pages).where(where);
      for (const page of due) {
        await db
          .update(pages)
          .set({ status: 'published', publishedAt: now, updatedAt: now })
          .where(eq(pages.id, page.id));
      }
      result.scheduledPages = due.length;
    }
  }

  return result;
}
