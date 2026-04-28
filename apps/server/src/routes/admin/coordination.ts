/**
 * Admin Coordination Routes
 *
 * Read-only endpoints exposing the multi-agent fleet view backed by the
 * coordination_* tables in Neon. The daemon at
 * ~/suite/revdev/packages/daemon writes to these tables via best-effort
 * dual-write (see GAP-154 Phase 2/3); this surface is the admin
 * dashboard's read side.
 *
 * GET /admin/coordination/sessions   -  active fleet sessions joined with
 *                                       agent info, sorted by started_at desc
 *
 * Auth: admin / super-admin only. Empty result is returned when no
 * coordination data exists (e.g. daemon not configured with POSTGRES_URL).
 */

import { getClient } from '@revealui/db';
import type { DatabaseClient } from '@revealui/db/client';
import { coordinationAgents, coordinationSessions } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, count, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { nullableDateToString } from '../_helpers/serialize.js';

type AdminVariables = {
  db: DatabaseClient;
  user?: { id: string; role: string };
};

const ADMIN_ROLES = new Set(['admin', 'super-admin']);

const STALE_THRESHOLD_SECONDS = 7 * 24 * 60 * 60;

function requireAdmin(user: { id: string; role: string } | undefined): void {
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  if (!ADMIN_ROLES.has(user.role)) {
    throw new HTTPException(403, { message: 'Admin access required' });
  }
}

const ErrorSchema = z.object({ success: z.literal(false), error: z.string() });

const SessionSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  agentName: z.string().nullable(),
  env: z.string().nullable(),
  task: z.string(),
  status: z.enum(['active', 'ended', 'crashed']),
  pid: z.number().int().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  lastSeen: z.string().nullable(),
  ageSeconds: z.number().int(),
  isStale: z.boolean(),
  tools: z.record(z.string(), z.number()).nullable(),
});

const SessionsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(SessionSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  timestamp: z.string(),
});

const SessionsQuery = z.object({
  scope: z.enum(['active', 'all']).default('active'),
  agentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const app = new OpenAPIHono<{ Variables: AdminVariables }>();

app.openapi(
  createRoute({
    method: 'get',
    path: '/sessions',
    tags: ['admin', 'coordination'],
    summary: 'List coordination sessions across the agent fleet (admin-only)',
    description:
      'Returns sessions from the Neon coordination_sessions table joined with agent info. ' +
      'Default scope is "active" (sessions with ended_at IS NULL). Empty result when ' +
      'no daemon writes have landed yet — the surface is intentionally tolerant of ' +
      'the no-data case so admins can deploy this before any daemon is configured.',
    request: { query: SessionsQuery },
    responses: {
      200: {
        content: { 'application/json': { schema: SessionsResponseSchema } },
        description: 'Paginated coordination sessions',
      },
      401: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Unauthorized',
      },
      403: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Forbidden',
      },
    },
  }),
  async (c) => {
    requireAdmin(c.get('user'));

    const { scope, agentId, limit, offset } = c.req.valid('query');
    const db = c.get('db') ?? getClient();

    const clauses: SQL[] = [];
    if (scope === 'active') clauses.push(isNull(coordinationSessions.endedAt));
    if (agentId) clauses.push(eq(coordinationSessions.agentId, agentId));
    const where =
      clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : and(...clauses);

    const [rows, [countResult]] = await Promise.all([
      db
        .select({
          id: coordinationSessions.id,
          agentId: coordinationSessions.agentId,
          task: coordinationSessions.task,
          status: coordinationSessions.status,
          pid: coordinationSessions.pid,
          startedAt: coordinationSessions.startedAt,
          endedAt: coordinationSessions.endedAt,
          tools: coordinationSessions.tools,
          env: coordinationAgents.env,
          lastSeen: coordinationAgents.lastSeen,
          agentMetadata: coordinationAgents.metadata,
        })
        .from(coordinationSessions)
        .leftJoin(coordinationAgents, eq(coordinationSessions.agentId, coordinationAgents.id))
        .where(where)
        .orderBy(desc(coordinationSessions.startedAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(coordinationSessions).where(where),
    ]);

    const total = countResult?.total ?? 0;
    const now = Date.now();

    return c.json(
      {
        success: true as const,
        data: rows.map((row) => {
          const startedAtMs =
            row.startedAt instanceof Date
              ? row.startedAt.getTime()
              : new Date(row.startedAt).getTime();
          const ageSeconds = Math.max(0, Math.floor((now - startedAtMs) / 1000));
          const meta = row.agentMetadata as { name?: unknown } | null;
          const agentName = typeof meta?.name === 'string' ? meta.name : null;
          // Drizzle types `status` as `string` (the column is text with a CHECK
          // constraint, not an enum), so narrow at the boundary.
          const statusValue: 'active' | 'ended' | 'crashed' =
            row.status === 'ended' || row.status === 'crashed' ? row.status : 'active';
          return {
            id: row.id,
            agentId: row.agentId,
            agentName,
            env: row.env ?? null,
            task: row.task,
            status: statusValue,
            pid: row.pid ?? null,
            startedAt: nullableDateToString(row.startedAt) ?? '',
            endedAt: nullableDateToString(row.endedAt),
            lastSeen: nullableDateToString(row.lastSeen),
            ageSeconds,
            isStale: ageSeconds > STALE_THRESHOLD_SECONDS,
            tools: (row.tools as Record<string, number> | null) ?? null,
          };
        }),
        total,
        limit,
        offset,
        timestamp: new Date().toISOString(),
      },
      200,
    );
  },
);

export default app;
