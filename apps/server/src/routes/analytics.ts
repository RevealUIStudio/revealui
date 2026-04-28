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
import { accountMemberships, usageMeters } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

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

export default app;
