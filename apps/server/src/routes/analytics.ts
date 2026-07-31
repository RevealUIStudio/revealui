/**
 * Analytics Routes — Pro-tier `analytics` paywall.
 *
 * Read-only aggregations over `usage_meters` for the authenticated
 * user's account. Three windowed views:
 *
 *   GET /api/analytics/summary    — period totals (executions, errors,
 *                                    success rate, total/avg duration)
 *   GET /api/analytics/by-meter   — per-meter breakdown for the period
 *                                    (agent_task, llm_request, etc.)
 *   GET /api/analytics/by-source  — per-source breakdown
 *                                    ('system' | 'user' | 'agent' | 'api')
 *
 * All endpoints accept ?days=N (default 30, max 365). All are gated by
 * `requireFeature('analytics', { mode: 'entitlements' })` — Pro tier
 * passes; Free returns 403 before the DB is touched.
 *
 * Account scoping: the user's account is resolved via the FIRST active
 * `account_memberships` row. Multi-account users see their primary
 * membership's data only; cross-account queries are out of scope here.
 */

import { getClient } from '@revealui/db';
import type { DatabaseClient } from '@revealui/db/client';
import { accountMemberships, accounts, usageMeters, users } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { hasApiRole } from '../lib/api-roles.js';

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

type AnalyticsVariables = {
  db: DatabaseClient;
  user: UserContext | undefined;
};

const app = new OpenAPIHono<{ Variables: AnalyticsVariables }>();

const MAX_DAYS = 365;
const DEFAULT_DAYS = 30;

function requireUser(c: Context): UserContext {
  const user = c.get('user') as UserContext | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  return user;
}

/**
 * The activation endpoint aggregates across every account, unlike the
 * single-account-scoped endpoints above  -  it is a platform-wide funnel
 * view, not a tenant's own usage. Require admin on top of the router's
 * 'analytics' entitlement gate so a Pro-tier customer in hosted
 * multi-tenant mode cannot read other tenants' activation data.
 */
function requireAdmin(c: Context): UserContext {
  const user = requireUser(c);
  if (!hasApiRole(user, 'admin')) {
    throw new HTTPException(403, { message: 'Admin role required' });
  }
  return user;
}

/**
 * Resolve the authenticated user's primary active account. Throws 404
 * when the user has no membership, matching the precedent set by other
 * account-scoped routes (no implicit account creation here).
 */
async function getUserAccountId(db: DatabaseClient, userId: string): Promise<string> {
  const [row] = await db
    .select({ accountId: accountMemberships.accountId })
    .from(accountMemberships)
    .where(and(eq(accountMemberships.userId, userId), eq(accountMemberships.status, 'active')))
    .limit(1);

  if (!row) {
    throw new HTTPException(404, {
      message: 'No active account found for this user',
    });
  }

  return row.accountId;
}

function periodStart(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ─── Schemas ──────────────────────────────────────────────────────────────

const DaysQuery = z.object({
  days: z.coerce.number().int().min(1).max(MAX_DAYS).default(DEFAULT_DAYS),
});

const SummaryShape = z.object({
  accountId: z.string(),
  periodStartIso: z.string(),
  periodEndIso: z.string(),
  days: z.number(),
  totalEvents: z.number(),
  erroredEvents: z.number(),
  successRate: z.number(),
  totalDurationMs: z.number(),
  averageDurationMs: z.number(),
  uniqueMeters: z.number(),
});

const MeterStatShape = z.object({
  meter: z.string(),
  count: z.number(),
  errored: z.number(),
  successRate: z.number(),
  totalDurationMs: z.number(),
  averageDurationMs: z.number(),
});

const SourceStatShape = z.object({
  source: z.string(),
  count: z.number(),
  errored: z.number(),
  successRate: z.number(),
  totalDurationMs: z.number(),
  averageDurationMs: z.number(),
});

// ─── GET /api/analytics/summary ───────────────────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/summary',
    tags: ['Analytics'],
    summary: 'Period totals for the authenticated user account',
    request: { query: DaysQuery },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: SummaryShape }),
          },
        },
        description: 'Aggregated metrics for the period',
      },
    },
  }),
  async (c) => {
    const user = requireUser(c);
    const { days } = c.req.valid('query');
    const db = c.get('db') ?? getClient();

    const accountId = await getUserAccountId(db, user.id);
    const start = periodStart(days);

    const [row] = await db
      .select({
        totalEvents: sql<number>`coalesce(sum(${usageMeters.quantity}), 0)::int`,
        // `errored` is nullable; pre-A.3 rows are excluded. Cast bool→int
        // via CASE so the sum is meter-faithful for post-A.3 rows.
        erroredEvents: sql<number>`coalesce(sum(case when ${usageMeters.errored} is true then ${usageMeters.quantity} else 0 end), 0)::int`,
        totalDurationMs: sql<number>`coalesce(sum(${usageMeters.durationMs}), 0)::bigint`,
        durationCount: sql<number>`coalesce(sum(case when ${usageMeters.durationMs} is not null then 1 else 0 end), 0)::int`,
        uniqueMeters: sql<number>`count(distinct ${usageMeters.meterName})::int`,
      })
      .from(usageMeters)
      .where(and(eq(usageMeters.accountId, accountId), gte(usageMeters.periodStart, start)));

    const totalEvents = Number(row?.totalEvents ?? 0);
    const erroredEvents = Number(row?.erroredEvents ?? 0);
    const totalDurationMs = Number(row?.totalDurationMs ?? 0);
    const durationCount = Number(row?.durationCount ?? 0);
    const uniqueMeters = Number(row?.uniqueMeters ?? 0);

    const successRate = totalEvents > 0 ? ((totalEvents - erroredEvents) / totalEvents) * 100 : 100;
    const averageDurationMs = durationCount > 0 ? totalDurationMs / durationCount : 0;

    return c.json({
      success: true as const,
      data: {
        accountId,
        periodStartIso: start.toISOString(),
        periodEndIso: new Date().toISOString(),
        days,
        totalEvents,
        erroredEvents,
        successRate: Number(successRate.toFixed(2)),
        totalDurationMs,
        averageDurationMs: Number(averageDurationMs.toFixed(2)),
        uniqueMeters,
      },
    });
  },
);

// ─── GET /api/analytics/by-meter ──────────────────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/by-meter',
    tags: ['Analytics'],
    summary: 'Per-meter breakdown for the authenticated user account',
    request: { query: DaysQuery },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              accountId: z.string(),
              days: z.number(),
              meters: z.array(MeterStatShape),
            }),
          },
        },
        description: 'Breakdown by meter name, sorted by count desc',
      },
    },
  }),
  async (c) => {
    const user = requireUser(c);
    const { days } = c.req.valid('query');
    const db = c.get('db') ?? getClient();

    const accountId = await getUserAccountId(db, user.id);
    const start = periodStart(days);

    const rows = await db
      .select({
        meter: usageMeters.meterName,
        count: sql<number>`coalesce(sum(${usageMeters.quantity}), 0)::int`,
        errored: sql<number>`coalesce(sum(case when ${usageMeters.errored} is true then ${usageMeters.quantity} else 0 end), 0)::int`,
        totalDurationMs: sql<number>`coalesce(sum(${usageMeters.durationMs}), 0)::bigint`,
        durationCount: sql<number>`coalesce(sum(case when ${usageMeters.durationMs} is not null then 1 else 0 end), 0)::int`,
      })
      .from(usageMeters)
      .where(and(eq(usageMeters.accountId, accountId), gte(usageMeters.periodStart, start)))
      .groupBy(usageMeters.meterName)
      .orderBy(sql`2 desc`);

    const meters = rows.map((r) => {
      const count = Number(r.count);
      const errored = Number(r.errored);
      const totalDurationMs = Number(r.totalDurationMs);
      const durationCount = Number(r.durationCount);
      return {
        meter: r.meter,
        count,
        errored,
        successRate: count > 0 ? Number((((count - errored) / count) * 100).toFixed(2)) : 100,
        totalDurationMs,
        averageDurationMs:
          durationCount > 0 ? Number((totalDurationMs / durationCount).toFixed(2)) : 0,
      };
    });

    return c.json({
      success: true as const,
      accountId,
      days,
      meters,
    });
  },
);

// ─── GET /api/analytics/by-source ─────────────────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/by-source',
    tags: ['Analytics'],
    summary: 'Per-source breakdown for the authenticated user account',
    request: { query: DaysQuery },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              accountId: z.string(),
              days: z.number(),
              sources: z.array(SourceStatShape),
            }),
          },
        },
        description: 'Breakdown by source (system|user|agent|api), sorted by count desc',
      },
    },
  }),
  async (c) => {
    const user = requireUser(c);
    const { days } = c.req.valid('query');
    const db = c.get('db') ?? getClient();

    const accountId = await getUserAccountId(db, user.id);
    const start = periodStart(days);

    const rows = await db
      .select({
        source: usageMeters.source,
        count: sql<number>`coalesce(sum(${usageMeters.quantity}), 0)::int`,
        errored: sql<number>`coalesce(sum(case when ${usageMeters.errored} is true then ${usageMeters.quantity} else 0 end), 0)::int`,
        totalDurationMs: sql<number>`coalesce(sum(${usageMeters.durationMs}), 0)::bigint`,
        durationCount: sql<number>`coalesce(sum(case when ${usageMeters.durationMs} is not null then 1 else 0 end), 0)::int`,
      })
      .from(usageMeters)
      .where(and(eq(usageMeters.accountId, accountId), gte(usageMeters.periodStart, start)))
      .groupBy(usageMeters.source)
      .orderBy(sql`2 desc`);

    const sources = rows.map((r) => {
      const count = Number(r.count);
      const errored = Number(r.errored);
      const totalDurationMs = Number(r.totalDurationMs);
      const durationCount = Number(r.durationCount);
      return {
        source: r.source,
        count,
        errored,
        successRate: count > 0 ? Number((((count - errored) / count) * 100).toFixed(2)) : 100,
        totalDurationMs,
        averageDurationMs:
          durationCount > 0 ? Number((totalDurationMs / durationCount).toFixed(2)) : 0,
      };
    });

    return c.json({
      success: true as const,
      accountId,
      days,
      sources,
    });
  },
);

// ─── GET /api/analytics/activation ────────────────────────────────────────

const ActivationShape = z.object({
  accountsWithFirstAgentAction: z.number(),
  accountsWithoutFirstAgentAction: z.number(),
  averageTimeToFirstAgentActionMs: z.number().nullable(),
  medianTimeToFirstAgentActionMs: z.number().nullable(),
  day7EligibleUsers: z.number(),
  day7ReturnedUsers: z.number(),
  day7ReturnRate: z.number().nullable(),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/activation',
    tags: ['Analytics'],
    summary: 'Platform-wide onboarding activation funnel (admin only)',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ActivationShape }),
          },
        },
        description: 'Time-to-first-agent-action and day-7 return rate across all accounts',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Admin role required',
      },
    },
  }),
  async (c) => {
    requireAdmin(c);
    const db = c.get('db') ?? getClient();

    // Per-account: the owner's signup time vs. that account's first
    // agent-sourced usage_meters event. Correlated subqueries are fine here
    // -  accounts is a small, admin-only aggregation, not a hot path.
    const perAccountRows = await db
      .select({
        accountId: accounts.id,
        ownerCreatedAt: sql<string | null>`(
          select ${users.createdAt} from ${accountMemberships}
          join ${users} on ${users.id} = ${accountMemberships.userId}
          where ${accountMemberships.accountId} = ${accounts.id}
            and ${accountMemberships.role} = 'owner'
            and ${accountMemberships.status} = 'active'
          order by ${accountMemberships.createdAt} asc
          limit 1
        )`,
        firstAgentActionAt: sql<string | null>`(
          select min(${usageMeters.createdAt}) from ${usageMeters}
          where ${usageMeters.accountId} = ${accounts.id}
            and ${usageMeters.source} = 'agent'
        )`,
      })
      .from(accounts)
      .where(eq(accounts.status, 'active'));

    const ttfaaMsList: number[] = [];
    let withFirstAgentAction = 0;
    let withoutFirstAgentAction = 0;

    for (const row of perAccountRows) {
      if (row.firstAgentActionAt) {
        withFirstAgentAction += 1;
        if (row.ownerCreatedAt) {
          const ms =
            new Date(row.firstAgentActionAt).getTime() - new Date(row.ownerCreatedAt).getTime();
          if (ms >= 0) ttfaaMsList.push(ms);
        }
      } else {
        withoutFirstAgentAction += 1;
      }
    }

    ttfaaMsList.sort((a, b) => a - b);
    const averageTimeToFirstAgentActionMs =
      ttfaaMsList.length > 0
        ? Math.round(ttfaaMsList.reduce((sum, ms) => sum + ms, 0) / ttfaaMsList.length)
        : null;
    const medianTimeToFirstAgentActionMs =
      ttfaaMsList.length > 0 ? ttfaaMsList[Math.floor(ttfaaMsList.length / 2)] : null;

    // Day-7 return: among users old enough for the 7-day window to have
    // elapsed, how many were still (or again) active 7+ days after signup.
    // Sparse until users.lastActiveAt (throttled writer) has accumulated
    // history  -  this returns whatever exists today rather than backfilling.
    const [day7Row] = await db
      .select({
        eligibleUsers: sql<number>`coalesce(count(*) filter (
          where ${users.createdAt} <= now() - interval '7 days'
        ), 0)::int`,
        returnedUsers: sql<number>`coalesce(count(*) filter (
          where ${users.createdAt} <= now() - interval '7 days'
            and ${users.lastActiveAt} is not null
            and ${users.lastActiveAt} >= ${users.createdAt} + interval '7 days'
        ), 0)::int`,
      })
      .from(users)
      .where(isNull(users.deletedAt));

    const day7EligibleUsers = Number(day7Row?.eligibleUsers ?? 0);
    const day7ReturnedUsers = Number(day7Row?.returnedUsers ?? 0);
    const day7ReturnRate =
      day7EligibleUsers > 0
        ? Number(((day7ReturnedUsers / day7EligibleUsers) * 100).toFixed(2))
        : null;

    return c.json({
      success: true as const,
      data: {
        accountsWithFirstAgentAction: withFirstAgentAction,
        accountsWithoutFirstAgentAction: withoutFirstAgentAction,
        averageTimeToFirstAgentActionMs,
        medianTimeToFirstAgentActionMs,
        day7EligibleUsers,
        day7ReturnedUsers,
        day7ReturnRate,
      },
    });
  },
);

export default app;
