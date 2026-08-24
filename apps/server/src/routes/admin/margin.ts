/**
 * Admin margin admission surface (GAP-256 analytics residual).
 *
 * Read-only endpoints over the margin snapshot tables written by the
 * margin-snapshot cron. Powers the admin Margin page so operators can see
 * aggregate cost vs revenue + governor mode without querying the DB by hand.
 *
 * GET /admin/margin/summary  — latest snapshot + recent history + top accounts
 */

import type { DatabaseClient } from '@revealui/db/client';
import { accountMarginDaily, marginSnapshots } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { desc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { isFleetOperator } from '../../lib/access.js';
import type { ApiAuthUser } from '../../lib/api-roles.js';

type AdminVariables = {
  db: DatabaseClient;
  user?: ApiAuthUser;
};

function requireFleetOperator(user: ApiAuthUser | undefined): void {
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  if (!isFleetOperator(user)) {
    throw new HTTPException(403, { message: 'Operator access required' });
  }
}

const SnapshotSchema = z.object({
  id: z.string(),
  periodDate: z.string(),
  freeCostCents: z.number(),
  paidCostCents: z.number(),
  totalCostCents: z.number(),
  revenueCents: z.number(),
  netCents: z.number(),
  projected7dCents: z.number().nullable(),
  freeCostRatio: z.string().nullable(),
  mode: z.enum(['open', 'lean', 'waitlist']),
  accountCountFree: z.number().nullable(),
  accountCountPaid: z.number().nullable(),
  computedAt: z.string(),
  trend: z.record(z.string(), z.unknown()),
});

const AccountRowSchema = z.object({
  accountId: z.string(),
  periodDate: z.string(),
  costCents: z.number(),
  agentTasks: z.number(),
  revenueCents: z.number(),
  netCents: z.number(),
  tier: z.string().nullable(),
});

const SummarySchema = z.object({
  success: z.literal(true),
  data: z.object({
    latest: SnapshotSchema.nullable(),
    history: z.array(SnapshotSchema),
    topAccountsByCost: z.array(AccountRowSchema),
  }),
});

const app = new OpenAPIHono<{ Variables: AdminVariables }>();

function serializeSnapshot(row: typeof marginSnapshots.$inferSelect) {
  return {
    id: row.id,
    periodDate: String(row.periodDate),
    freeCostCents: row.freeCostCents,
    paidCostCents: row.paidCostCents,
    totalCostCents: row.totalCostCents,
    revenueCents: row.revenueCents,
    netCents: row.netCents,
    projected7dCents: row.projected7dCents,
    freeCostRatio: row.freeCostRatio,
    mode: row.mode,
    accountCountFree: row.accountCountFree,
    accountCountPaid: row.accountCountPaid,
    computedAt: row.computedAt.toISOString(),
    trend: (row.trend ?? {}) as Record<string, unknown>,
  };
}

app.openapi(
  createRoute({
    method: 'get',
    path: '/summary',
    tags: ['admin', 'margin'],
    summary: 'Latest margin snapshot, short history, and top accounts by cost',
    responses: {
      200: {
        content: { 'application/json': { schema: SummarySchema } },
        description: 'Margin admission analytics summary',
      },
      401: { description: 'Authentication required' },
      403: { description: 'Operator access required' },
    },
  }),
  async (c) => {
    requireFleetOperator(c.get('user'));
    const db = c.get('db');
    if (!db) throw new HTTPException(500, { message: 'Database client missing' });

    const history = await db
      .select()
      .from(marginSnapshots)
      .orderBy(desc(marginSnapshots.periodDate))
      .limit(14);

    const latest = history[0] ?? null;
    let topAccountsByCost: Array<{
      accountId: string;
      periodDate: string;
      costCents: number;
      agentTasks: number;
      revenueCents: number;
      netCents: number;
      tier: string | null;
    }> = [];

    if (latest) {
      const rows = await db
        .select()
        .from(accountMarginDaily)
        .where(eq(accountMarginDaily.periodDate, latest.periodDate))
        .orderBy(desc(accountMarginDaily.costCents))
        .limit(25);

      topAccountsByCost = rows.map((row) => ({
        accountId: row.accountId,
        periodDate: String(row.periodDate),
        costCents: row.costCents,
        agentTasks: row.agentTasks,
        revenueCents: row.revenueCents,
        netCents: row.revenueCents - row.costCents,
        tier: row.tier,
      }));
    }

    return c.json({
      success: true as const,
      data: {
        latest: latest ? serializeSnapshot(latest) : null,
        history: history.map(serializeSnapshot),
        topAccountsByCost,
      },
    });
  },
);

export default app;
