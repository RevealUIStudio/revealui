/**
 * MCP usage aggregations.
 *
 * `GET /api/mcp/usage?range=24h|7d|30d` — returns per-`meterName`
 * counts + duration percentiles for the caller's account, filtered by
 * the requested time window.
 *
 * Powers the Usage tab on `/admin/mcp` (A.3 of the post-v1 MCP arc).
 * Visualizes the rows A.1 / A.2a / A.2b-backend write into
 * `usage_meters` from the Stage 6.1 / 6.2 sinks.
 *
 * Scoping. The endpoint resolves the caller's `accountId` from the
 * global `entitlementMiddleware` context and filters to that single
 * account — same precedent as A.1's metering writer. Multi-account /
 * super-admin views are deferred until a clear product need surfaces;
 * v1 is "show me my account's usage."
 */

import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { sql } from 'drizzle-orm';
import { getEntitlementsFromContext } from '../middleware/entitlements.js';

type Variables = {
  user?: { id: string; role: string };
};

const app = new OpenAPIHono<{ Variables: Variables }>();

const RangeSchema = z.enum(['24h', '7d', '30d']).default('24h');

const MeterAggregateSchema = z.object({
  meterName: z.string(),
  total: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  unknownCount: z.number().int().nonnegative(),
  durationCount: z.number().int().nonnegative(),
  p50Ms: z.number().nullable(),
  p95Ms: z.number().nullable(),
});

const UsageResponseSchema = z.object({
  range: RangeSchema,
  since: z.string(),
  accountId: z.string().nullable(),
  meters: z.array(MeterAggregateSchema),
});

const usageRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['mcp'],
  summary: 'Aggregate MCP usage for the caller\u2019s account',
  description:
    'Returns per-`meterName` totals, success / error / unknown counts (unknown = pre-A.3 row with NULL `errored`), duration counts, and p50 / p95 duration buckets in milliseconds. Filtered by the caller\u2019s `accountId` (resolved from `entitlementMiddleware`) and the requested time range.',
  request: {
    query: z.object({
      range: RangeSchema.optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UsageResponseSchema } },
      description: 'Usage aggregations for the caller\u2019s account',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(false), error: z.string() }),
        },
      },
      description: 'Authentication required',
    },
    409: {
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(false), error: z.string() }),
        },
      },
      description: 'Caller has no resolvable account membership',
    },
  },
});

const RANGE_TO_SINCE_MS: Readonly<Record<z.infer<typeof RangeSchema>, number>> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

// Drizzle's `db.execute<T>` constrains `T extends Record<string, unknown>`
// — so the interface needs an index signature alongside the named fields.
interface UsageRow {
  meter_name: string;
  total: string | number;
  success_count: string | number | null;
  error_count: string | number | null;
  duration_count: string | number;
  p50_ms: string | number | null;
  p95_ms: string | number | null;
  [key: string]: unknown;
}

function toNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number.parseInt(value, 10) || 0;
}

function toNullableNum(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

app.openapi(usageRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false as const, error: 'Authentication required' }, 401);
  }

  const accountId = getEntitlementsFromContext(c).accountId;
  if (!accountId) {
    return c.json(
      {
        success: false as const,
        error: 'Caller has no active account membership; usage is account-scoped',
      },
      409,
    );
  }

  const range = c.req.valid('query').range ?? '24h';
  const since = new Date(Date.now() - RANGE_TO_SINCE_MS[range]);

  // Raw SQL gives us PostgreSQL's `percentile_disc` directly. Drizzle
  // doesn't ship a percentile aggregate helper, and writing this
  // through the query builder would be more code for the same plan.
  // PGlite (used for tests) supports `percentile_disc` natively.
  const db = getClient();
  let rows: UsageRow[] = [];
  try {
    const result = await db.execute<UsageRow>(sql`
      SELECT
        meter_name,
        count(*) AS total,
        sum(CASE WHEN errored = false THEN 1 ELSE 0 END) AS success_count,
        sum(CASE WHEN errored = true THEN 1 ELSE 0 END) AS error_count,
        count(duration_ms) AS duration_count,
        percentile_disc(0.5)
          WITHIN GROUP (ORDER BY duration_ms)
          FILTER (WHERE duration_ms IS NOT NULL) AS p50_ms,
        percentile_disc(0.95)
          WITHIN GROUP (ORDER BY duration_ms)
          FILTER (WHERE duration_ms IS NOT NULL) AS p95_ms
      FROM usage_meters
      WHERE account_id = ${accountId} AND period_start >= ${since.toISOString()}
      GROUP BY meter_name
      ORDER BY meter_name ASC
    `);
    // Drizzle's `db.execute` returns either the raw rows array (PGlite,
    // node-postgres pool) or `{ rows: [...] }` (neon-http). Normalize.
    rows = Array.isArray(result)
      ? (result as UsageRow[])
      : ((result as { rows?: UsageRow[] }).rows ?? []);
  } catch (error) {
    logger.error('[/api/mcp/usage] aggregation query failed', {
      accountId,
      range,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const meters = rows.map((row) => {
    const successCount = toNum(row.success_count);
    const errorCount = toNum(row.error_count);
    const total = toNum(row.total);
    return {
      meterName: row.meter_name,
      total,
      successCount,
      errorCount,
      // pre-A.3 rows had NULL `errored`; they fall out of both
      // success/error sums but still count toward the total.
      unknownCount: Math.max(0, total - successCount - errorCount),
      durationCount: toNum(row.duration_count),
      p50Ms: toNullableNum(row.p50_ms),
      p95Ms: toNullableNum(row.p95_ms),
    };
  });

  return c.json(
    {
      range,
      since: since.toISOString(),
      accountId,
      meters,
    },
    200,
  );
});

export default app;
