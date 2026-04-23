/**
 * Admin Observability Routes
 *
 * Read-only endpoints for the admin dashboard dashboard observability pages.
 * All endpoints require admin role (admin, super-admin, admin, super-admin).
 *
 * GET /admin/logs          -  paginated app logs, filterable by app and level
 * GET /admin/errors        -  paginated error events
 * GET /admin/audit         -  paginated audit log, filterable by severity and agentId
 * GET /admin/webhooks      -  paginated processed webhook events, filterable by eventType
 * GET /admin/jobs          -  paginated queue jobs, filterable by state and name (CR8-P2-01 phase D)
 * GET /admin/jobs/summary  -  aggregate queue stats (state counts + per-handler 24h counts +
 *                             recent failures) (CR8-P2-01 phase D)
 */

import { getClient } from '@revealui/db';
import type { DatabaseClient } from '@revealui/db/client';
import { appLogs, auditLog, errorEvents, jobs, processedWebhookEvents } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, count, desc, eq, gte, type SQL } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { PaginationQuery } from '../_helpers/pagination.js';
import { dateToString } from '../_helpers/serialize.js';

type AdminVariables = {
  db: DatabaseClient;
  user?: { id: string; role: string };
};

// =============================================================================
// Shared
// =============================================================================

const ADMIN_ROLES = new Set(['admin', 'super-admin', 'admin', 'super-admin']);

function requireAdmin(user: { id: string; role: string } | undefined): void {
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  if (!ADMIN_ROLES.has(user.role)) {
    throw new HTTPException(403, { message: 'Admin access required' });
  }
}

const ErrorSchema = z.object({ success: z.literal(false), error: z.string() });

function paginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  });
}

// =============================================================================
// App  -  all admin observability routes share this Hono instance
// =============================================================================

const app = new OpenAPIHono<{ Variables: AdminVariables }>();

// =============================================================================
// GET /admin/logs
// =============================================================================

const AppLogSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  level: z.string(),
  message: z.string(),
  app: z.string(),
  environment: z.string(),
  requestId: z.string().nullable(),
  userId: z.string().nullable(),
  data: z.unknown().nullable(),
});

const LogsQuery = PaginationQuery.extend({
  app: z.string().optional(),
  level: z.string().optional(),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/logs',
    tags: ['admin', 'observability'],
    summary: 'List application logs (admin-only)',
    request: { query: LogsQuery },
    responses: {
      200: {
        content: { 'application/json': { schema: paginatedSchema(AppLogSchema) } },
        description: 'Paginated app logs',
      },
      401: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Unauthorized',
      },
      403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Forbidden' },
    },
  }),
  async (c) => {
    requireAdmin(c.get('user'));

    const { limit, offset, app: filterApp, level: filterLevel } = c.req.valid('query');
    const db = c.get('db') ?? getClient();

    const clauses: SQL[] = [];
    if (filterApp) clauses.push(eq(appLogs.app, filterApp));
    if (filterLevel) clauses.push(eq(appLogs.level, filterLevel));
    const where =
      clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : and(...clauses);

    const [rows, [countResult]] = await Promise.all([
      db
        .select()
        .from(appLogs)
        .where(where)
        .orderBy(desc(appLogs.timestamp))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(appLogs).where(where),
    ]);

    const total = countResult?.total ?? 0;

    return c.json(
      {
        success: true as const,
        data: rows.map((row) => ({
          id: row.id,
          timestamp: dateToString(row.timestamp),
          level: row.level,
          message: row.message,
          app: row.app,
          environment: row.environment,
          requestId: row.requestId ?? null,
          userId: row.userId ?? null,
          data: row.data ?? null,
        })),
        total,
        limit,
        offset,
      },
      200,
    );
  },
);

// =============================================================================
// GET /admin/errors
// =============================================================================

const ErrorEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  level: z.string(),
  message: z.string(),
  stack: z.string().nullable(),
  app: z.string(),
  context: z.string().nullable(),
  environment: z.string(),
  url: z.string().nullable(),
  userId: z.string().nullable(),
  requestId: z.string().nullable(),
  metadata: z.unknown().nullable(),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/errors',
    tags: ['admin', 'observability'],
    summary: 'List error events (admin-only)',
    request: { query: PaginationQuery },
    responses: {
      200: {
        content: { 'application/json': { schema: paginatedSchema(ErrorEventSchema) } },
        description: 'Paginated error events',
      },
      401: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Unauthorized',
      },
      403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Forbidden' },
    },
  }),
  async (c) => {
    requireAdmin(c.get('user'));

    const { limit, offset } = c.req.valid('query');
    const db = c.get('db') ?? getClient();

    const [rows, [countResult]] = await Promise.all([
      db
        .select()
        .from(errorEvents)
        .orderBy(desc(errorEvents.timestamp))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(errorEvents),
    ]);

    const total = countResult?.total ?? 0;

    return c.json(
      {
        success: true as const,
        data: rows.map((row) => ({
          id: row.id,
          timestamp: dateToString(row.timestamp),
          level: row.level,
          message: row.message,
          stack: row.stack ?? null,
          app: row.app,
          context: row.context ?? null,
          environment: row.environment,
          url: row.url ?? null,
          userId: row.userId ?? null,
          requestId: row.requestId ?? null,
          metadata: row.metadata ?? null,
        })),
        total,
        limit,
        offset,
      },
      200,
    );
  },
);

// =============================================================================
// GET /admin/audit
// =============================================================================

const AuditEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  eventType: z.string(),
  severity: z.string(),
  agentId: z.string(),
  taskId: z.string().nullable(),
  sessionId: z.string().nullable(),
  payload: z.unknown(),
  policyViolations: z.array(z.string()),
});

const AuditQuery = PaginationQuery.extend({
  severity: z.string().optional(),
  agentId: z.string().optional(),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/audit',
    tags: ['admin', 'observability'],
    summary: 'List audit log entries (admin-only)',
    request: { query: AuditQuery },
    responses: {
      200: {
        content: { 'application/json': { schema: paginatedSchema(AuditEntrySchema) } },
        description: 'Paginated audit log entries',
      },
      401: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Unauthorized',
      },
      403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Forbidden' },
    },
  }),
  async (c) => {
    requireAdmin(c.get('user'));

    const { limit, offset, severity, agentId } = c.req.valid('query');
    const db = c.get('db') ?? getClient();

    const clauses: SQL[] = [];
    if (severity) clauses.push(eq(auditLog.severity, severity));
    if (agentId) clauses.push(eq(auditLog.agentId, agentId));
    const where =
      clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : and(...clauses);

    const [rows, [countResult]] = await Promise.all([
      db
        .select()
        .from(auditLog)
        .where(where)
        .orderBy(desc(auditLog.timestamp))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(auditLog).where(where),
    ]);

    const total = countResult?.total ?? 0;

    return c.json(
      {
        success: true as const,
        data: rows.map((row) => ({
          id: row.id,
          timestamp: dateToString(row.timestamp),
          eventType: row.eventType,
          severity: row.severity,
          agentId: row.agentId,
          taskId: row.taskId ?? null,
          sessionId: row.sessionId ?? null,
          payload: row.payload,
          policyViolations: row.policyViolations,
        })),
        total,
        limit,
        offset,
      },
      200,
    );
  },
);

// =============================================================================
// GET /admin/webhooks
// =============================================================================

const WebhookEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  processedAt: z.string(),
});

const WebhooksQuery = PaginationQuery.extend({
  eventType: z.string().optional(),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/webhooks',
    tags: ['admin', 'observability'],
    summary: 'List processed webhook events (admin-only)',
    request: { query: WebhooksQuery },
    responses: {
      200: {
        content: { 'application/json': { schema: paginatedSchema(WebhookEventSchema) } },
        description: 'Paginated webhook events',
      },
      401: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Unauthorized',
      },
      403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Forbidden' },
    },
  }),
  async (c) => {
    requireAdmin(c.get('user'));

    const { limit, offset, eventType } = c.req.valid('query');
    const db = c.get('db') ?? getClient();

    const where = eventType ? eq(processedWebhookEvents.eventType, eventType) : undefined;

    const [rows, [countResult]] = await Promise.all([
      db
        .select()
        .from(processedWebhookEvents)
        .where(where)
        .orderBy(desc(processedWebhookEvents.processedAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(processedWebhookEvents).where(where),
    ]);

    const total = countResult?.total ?? 0;

    return c.json(
      {
        success: true as const,
        data: rows.map((row) => ({
          id: row.id,
          eventType: row.eventType,
          processedAt: dateToString(row.processedAt),
        })),
        total,
        limit,
        offset,
      },
      200,
    );
  },
);

// =============================================================================
// GET /admin/jobs  -  paginated queue jobs (CR8-P2-01 phase D)
// =============================================================================

const JobStateSchema = z.enum(['created', 'active', 'completed', 'failed', 'retry']);

const JobSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
  priority: z.number(),
  retryCount: z.number(),
  retryLimit: z.number(),
  lastError: z.string().nullable(),
  lockedBy: z.string().nullable(),
  lockedUntil: z.string().nullable(),
  startAfter: z.string(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  output: z.unknown().nullable(),
  data: z.unknown(),
});

const JobsQuery = PaginationQuery.extend({
  state: JobStateSchema.optional(),
  name: z.string().optional(),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/jobs',
    tags: ['admin', 'observability'],
    summary: 'List durable-queue jobs (admin-only)',
    description:
      'Paginated view of the `jobs` table. Filterable by state (created/active/completed/failed/retry) and by handler name. Ordered newest-created first.',
    request: { query: JobsQuery },
    responses: {
      200: {
        content: { 'application/json': { schema: paginatedSchema(JobSchema) } },
        description: 'Paginated jobs',
      },
      401: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Unauthorized',
      },
      403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Forbidden' },
    },
  }),
  async (c) => {
    requireAdmin(c.get('user'));

    const { limit, offset, state, name } = c.req.valid('query');
    const db = c.get('db') ?? getClient();

    const clauses: SQL[] = [];
    if (state) clauses.push(eq(jobs.state, state));
    if (name) clauses.push(eq(jobs.name, name));
    const where =
      clauses.length === 0 ? undefined : clauses.length === 1 ? clauses[0] : and(...clauses);

    const [rows, [countResult]] = await Promise.all([
      db.select().from(jobs).where(where).orderBy(desc(jobs.createdAt)).limit(limit).offset(offset),
      db.select({ total: count() }).from(jobs).where(where),
    ]);

    const total = countResult?.total ?? 0;

    return c.json(
      {
        success: true as const,
        data: rows.map((row) => ({
          id: row.id,
          name: row.name,
          state: row.state,
          priority: row.priority,
          retryCount: row.retryCount,
          retryLimit: row.retryLimit,
          lastError: row.lastError ?? null,
          lockedBy: row.lockedBy ?? null,
          lockedUntil: row.lockedUntil ? dateToString(row.lockedUntil) : null,
          startAfter: dateToString(row.startAfter),
          createdAt: dateToString(row.createdAt),
          startedAt: row.startedAt ? dateToString(row.startedAt) : null,
          completedAt: row.completedAt ? dateToString(row.completedAt) : null,
          output: row.output ?? null,
          data: row.data,
        })),
        total,
        limit,
        offset,
      },
      200,
    );
  },
);

// =============================================================================
// GET /admin/jobs/summary  -  aggregate stats (CR8-P2-01 phase D)
// =============================================================================

const JobSummarySchema = z.object({
  success: z.literal(true),
  stateCounts: z.object({
    created: z.number(),
    active: z.number(),
    completed: z.number(),
    failed: z.number(),
    retry: z.number(),
  }),
  byHandler24h: z.array(
    z.object({
      name: z.string(),
      completed: z.number(),
      failed: z.number(),
      running: z.number(),
    }),
  ),
  recentFailures: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      lastError: z.string().nullable(),
      retryCount: z.number(),
      completedAt: z.string().nullable(),
    }),
  ),
  /** ISO timestamp the snapshot was taken. */
  timestamp: z.string(),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/jobs/summary',
    tags: ['admin', 'observability'],
    summary: 'Durable-queue aggregate stats (admin-only)',
    description:
      'Returns: current depth by state, per-handler counts over the last 24 hours (completed / failed / running), and the 10 most-recent failures. Intended for the admin jobs dashboard header.',
    responses: {
      200: {
        content: { 'application/json': { schema: JobSummarySchema } },
        description: 'Queue summary',
      },
      401: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Unauthorized',
      },
      403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Forbidden' },
    },
  }),
  async (c) => {
    requireAdmin(c.get('user'));
    const db = c.get('db') ?? getClient();

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // One round-trip each for the three aggregates. Neon HTTP driver:
    // sequential is fine; all three queries are light.
    const stateRows = await db
      .select({ state: jobs.state, total: count() })
      .from(jobs)
      .groupBy(jobs.state);

    const handlerRows = await db
      .select({ name: jobs.name, state: jobs.state, total: count() })
      .from(jobs)
      .where(gte(jobs.createdAt, since24h))
      .groupBy(jobs.name, jobs.state);

    const failureRows = await db
      .select()
      .from(jobs)
      .where(eq(jobs.state, 'failed'))
      .orderBy(desc(jobs.completedAt))
      .limit(10);

    const stateCounts = {
      created: 0,
      active: 0,
      completed: 0,
      failed: 0,
      retry: 0,
    };
    for (const row of stateRows) {
      if (row.state in stateCounts) {
        (stateCounts as Record<string, number>)[row.state] = row.total;
      }
    }

    // Pivot (name, state, count) -> { name, completed, failed, running }.
    const byHandlerMap = new Map<string, { completed: number; failed: number; running: number }>();
    for (const row of handlerRows) {
      if (!byHandlerMap.has(row.name)) {
        byHandlerMap.set(row.name, { completed: 0, failed: 0, running: 0 });
      }
      const entry = byHandlerMap.get(row.name);
      if (!entry) continue;
      if (row.state === 'completed') entry.completed = row.total;
      else if (row.state === 'failed') entry.failed = row.total;
      else if (row.state === 'active') entry.running = row.total;
      // 'created' + 'retry' counted nowhere — per-handler view focuses on
      // processed outcomes + in-flight, not queue depth.
    }
    const byHandler24h = [...byHandlerMap.entries()]
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.completed + b.failed + b.running - (a.completed + a.failed + a.running));

    return c.json(
      {
        success: true as const,
        stateCounts,
        byHandler24h,
        recentFailures: failureRows.map((row) => ({
          id: row.id,
          name: row.name,
          lastError: row.lastError ?? null,
          retryCount: row.retryCount,
          completedAt: row.completedAt ? dateToString(row.completedAt) : null,
        })),
        timestamp: dateToString(new Date()),
      },
      200,
    );
  },
);

export default app;
