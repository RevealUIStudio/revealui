/**
 * Cron: Onboarding Lifecycle Emails
 *
 * Evaluates which onboarding lifecycle emails are due (day-0 welcome, day-1
 * check-in when no agent action has happened yet, day-7 outcome) and records
 * each decision in the `lifecycle_emails_sent` ledger so a given (user,
 * email-type) is processed exactly once.
 *
 * Hosted test/staging arms when the Gmail mailbox path is present (GAP-343
 * syncs the same SA + EMAIL_FROM to vercel:api-staging). Production (main)
 * stays disarmed unless LIFECYCLE_EMAILS_ENABLED is exactly 'true' after an
 * owner delivery check. Missing mailbox credentials fail closed. CI
 * (NODE_ENV=test) never arms. Only Pro and Max are eligible — no Enterprise
 * trial sequence. While disarmed, the job records would-send decisions
 * (dry-run ledger rows plus log lines) and never touches the mailer. The
 * dry-run and real-send claims use different idempotency keys, so disarmed
 * runs never consume a real-send slot.
 *
 * Piggybacks on the daily cron dispatcher (POST /api/cron/dispatch).
 * Protected by X-Cron-Secret header (defense-in-depth  -  also validated in
 * dispatch.ts).
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import {
  accountEntitlements,
  accountMemberships,
  lifecycleEmailsSent,
  usageMeters,
  users,
} from '@revealui/db/schema';
import { and, eq, gte, isNotNull, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import {
  isLifecycleEligibleTier,
  readLifecycleArmingEnv,
  resolveLifecycleEmailArming,
} from '../../lib/lifecycle-email-arming.js';
import {
  type LifecycleTier,
  sendDay0Welcome,
  sendDay1Checkin,
  sendDay7Outcome,
} from '../../lib/lifecycle-emails.js';

const DAY_MS = 86_400_000;

export type LifecycleEmailType = 'day0_welcome' | 'day1_checkin' | 'day7_outcome';

export interface LifecycleCandidate {
  userId: string;
  email: string;
  tier: LifecycleTier;
  createdAt: Date;
  hasAgentAction: boolean;
  weeklyAgentActions: number;
}

export interface LifecycleRunResult {
  armed: boolean;
  evaluated: number;
  sent: number;
  dryRun: number;
  skipped: number;
  failed: number;
}

export interface LifecycleClaimInput {
  idempotencyKey: string;
  userId: string;
  emailType: LifecycleEmailType;
  tier: LifecycleTier;
  status: 'sent' | 'dry_run';
}

export interface LifecycleDeps {
  enabled: boolean;
  now: Date;
  loadCandidates(now: Date): Promise<LifecycleCandidate[]>;
  /** Insert the claim row. Returns true only when this call won the unique key. */
  claim(input: LifecycleClaimInput): Promise<boolean>;
  /** Remove a claim row so a failed send is retried on the next daily tick. */
  release(idempotencyKey: string): Promise<void>;
  send(type: LifecycleEmailType, candidate: LifecycleCandidate): Promise<void>;
}

const VALID_TIERS: ReadonlySet<string> = new Set(['free', 'pro', 'max', 'enterprise']);

function normalizeTier(raw: string | null): LifecycleTier {
  return raw && VALID_TIERS.has(raw) ? (raw as LifecycleTier) : 'free';
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Which lifecycle email (if any) a candidate is due for at `now`.
 *
 * Windows are non-overlapping so a candidate is due for at most one type per
 * run, and each has an upper bound so the very first armed run does not blast
 * every historical user. The names track the milestone (0 / 1 / 7 days); the
 * window widths tolerate the once-a-day dispatcher tick.
 */
export function dueEmailType(candidate: LifecycleCandidate, now: Date): LifecycleEmailType | null {
  const ageMs = now.getTime() - candidate.createdAt.getTime();
  if (ageMs < 0) return null;
  if (ageMs < 2 * DAY_MS) return 'day0_welcome';
  if (ageMs < 4 * DAY_MS) return candidate.hasAgentAction ? null : 'day1_checkin';
  if (ageMs >= 7 * DAY_MS && ageMs < 10 * DAY_MS) return 'day7_outcome';
  return null;
}

/**
 * Core evaluation loop. Pure of I/O beyond its injected deps so the decision,
 * idempotency, and disarm behavior are unit-testable without a database or a
 * live mailer.
 */
export async function runLifecycleEmails(deps: LifecycleDeps): Promise<LifecycleRunResult> {
  const { enabled, now } = deps;
  const candidates = await deps.loadCandidates(now);
  const result: LifecycleRunResult = {
    armed: enabled,
    evaluated: candidates.length,
    sent: 0,
    dryRun: 0,
    skipped: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    if (!isLifecycleEligibleTier(candidate.tier)) {
      result.skipped += 1;
      continue;
    }

    const type = dueEmailType(candidate, now);
    if (!type) continue;

    const status = enabled ? 'sent' : 'dry_run';
    const idempotencyKey = `lifecycle:${status}:${type}:${candidate.userId}`;

    let claimed: boolean;
    try {
      claimed = await deps.claim({
        idempotencyKey,
        userId: candidate.userId,
        emailType: type,
        tier: candidate.tier,
        status,
      });
    } catch (err) {
      result.failed += 1;
      logger.error('[lifecycle-emails] claim failed', undefined, {
        userId: candidate.userId,
        emailType: type,
        error: errMessage(err),
      });
      continue;
    }

    if (!claimed) {
      result.skipped += 1;
      continue;
    }

    if (!enabled) {
      // DISARMED: record the decision, never touch the transport.
      result.dryRun += 1;
      logger.info('[lifecycle-emails] would send (disarmed)', {
        userId: candidate.userId,
        emailType: type,
        tier: candidate.tier,
      });
      continue;
    }

    try {
      await deps.send(type, candidate);
      result.sent += 1;
    } catch (err) {
      // A transport failure must never break the loop. Release the claim so
      // the next daily run retries this user, log, and move on.
      result.failed += 1;
      logger.error('[lifecycle-emails] send failed', undefined, {
        userId: candidate.userId,
        emailType: type,
        error: errMessage(err),
      });
      try {
        await deps.release(idempotencyKey);
      } catch (releaseErr) {
        logger.error('[lifecycle-emails] claim release failed', undefined, {
          idempotencyKey,
          error: errMessage(releaseErr),
        });
      }
    }
  }

  return result;
}

// =============================================================================
// Real dependency implementations (the DB + transport boundary)
// =============================================================================

type DbClient = ReturnType<typeof getClient>;

/**
 * Loads every recently-created human user (email-verified, not deleted) inside
 * the widest lifecycle window, resolving their account tier and agent-action
 * signals via correlated subqueries. Modeled on the proven activation query in
 * routes/analytics.ts. Not a hot path (a small daily aggregation).
 */
async function loadCandidatesReal(db: DbClient, now: Date): Promise<LifecycleCandidate[]> {
  const oldestCreatedAt = new Date(now.getTime() - 10 * DAY_MS);

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      createdAt: users.createdAt,
      tier: sql<string | null>`(
        select ${accountEntitlements.tier} from ${accountMemberships}
        join ${accountEntitlements} on ${accountEntitlements.accountId} = ${accountMemberships.accountId}
        where ${accountMemberships.userId} = ${users.id}
          and ${accountMemberships.status} = 'active'
          and ${accountEntitlements.mode} = 'live'
        order by ${accountMemberships.createdAt} asc
        limit 1
      )`,
      hasAgentAction: sql<boolean>`exists(
        select 1 from ${usageMeters}
        where ${usageMeters.source} = 'agent'
          and ${usageMeters.accountId} in (
            select ${accountMemberships.accountId} from ${accountMemberships}
            where ${accountMemberships.userId} = ${users.id}
              and ${accountMemberships.status} = 'active'
          )
      )`,
      weeklyAgentActions: sql<number>`coalesce((
        select count(*) from ${usageMeters}
        where ${usageMeters.source} = 'agent'
          and ${usageMeters.createdAt} >= now() - interval '7 days'
          and ${usageMeters.accountId} in (
            select ${accountMemberships.accountId} from ${accountMemberships}
            where ${accountMemberships.userId} = ${users.id}
              and ${accountMemberships.status} = 'active'
          )
      ), 0)::int`,
    })
    .from(users)
    .where(
      and(
        eq(users.type, 'human'),
        isNull(users.deletedAt),
        isNotNull(users.email),
        eq(users.emailVerified, true),
        gte(users.createdAt, oldestCreatedAt),
      ),
    );

  const candidates: LifecycleCandidate[] = [];
  for (const row of rows) {
    if (!row.email) continue;
    candidates.push({
      userId: row.userId,
      email: row.email,
      tier: normalizeTier(row.tier),
      createdAt: new Date(row.createdAt),
      hasAgentAction: Boolean(row.hasAgentAction),
      weeklyAgentActions: Number(row.weeklyAgentActions ?? 0),
    });
  }
  return candidates;
}

async function claimReal(db: DbClient, input: LifecycleClaimInput): Promise<boolean> {
  const inserted = await db
    .insert(lifecycleEmailsSent)
    .values({
      idempotencyKey: input.idempotencyKey,
      userId: input.userId,
      emailType: input.emailType,
      tier: input.tier,
      status: input.status,
    })
    .onConflictDoNothing({ target: lifecycleEmailsSent.idempotencyKey })
    .returning();
  return inserted.length > 0;
}

async function releaseReal(db: DbClient, idempotencyKey: string): Promise<void> {
  await db
    .delete(lifecycleEmailsSent)
    .where(eq(lifecycleEmailsSent.idempotencyKey, idempotencyKey));
}

function sendForType(type: LifecycleEmailType, candidate: LifecycleCandidate): Promise<void> {
  if (type === 'day0_welcome') return sendDay0Welcome(candidate.email, candidate.tier);
  if (type === 'day1_checkin') return sendDay1Checkin(candidate.email, candidate.tier);
  return sendDay7Outcome(candidate.email, candidate.tier, candidate.weeklyAgentActions);
}

// =============================================================================
// Route
// =============================================================================

const app = new Hono();

app.post('/lifecycle-emails', async (c) => {
  // Defense-in-depth: validate cron secret even though dispatch.ts also checks.
  const cronSecret = process.env.REVEALUI_CRON_SECRET;
  const provided = c.req.header('X-Cron-Secret') || c.req.header('x-cron-secret');

  if (!(cronSecret && provided)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(cronSecret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const db = getClient();
    const arming = resolveLifecycleEmailArming(readLifecycleArmingEnv());
    logger.info('[lifecycle-emails] arming decision', {
      armed: arming.armed,
      reason: arming.reason,
    });

    const result = await runLifecycleEmails({
      enabled: arming.armed,
      now: new Date(),
      loadCandidates: (now) => loadCandidatesReal(db, now),
      claim: (input) => claimReal(db, input),
      release: (key) => releaseReal(db, key),
      send: (type, candidate) => sendForType(type, candidate),
    });

    logger.info('[lifecycle-emails] run complete', { ...result });
    return c.json(result, 200);
  } catch (err) {
    logger.error('[lifecycle-emails] run failed', undefined, { error: errMessage(err) });
    return c.json({ error: 'Internal error during lifecycle email run' }, 500);
  }
});

export default app;
