/**
 * Admin Observability Routes
 *
 * Read-only endpoints for the admin dashboard dashboard observability pages.
 * All endpoints require admin role (admin, super-admin, user-admin, user-super-admin).
 *
 * GET /admin/logs      — paginated app logs, filterable by app and level
 * GET /admin/errors    — paginated error events
 * GET /admin/audit     — paginated audit log, filterable by severity and agentId
 * GET /admin/webhooks  — paginated processed webhook events, filterable by eventType
 */

import { getClient } from '@revealui/db';
import type { DatabaseClient } from '@revealui/db/client';
import { appLogs, auditLog, errorEvents, processedWebhookEvents } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, count, desc, eq, type SQL } from 'drizzle-orm';
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

const ADMIN_ROLES = new Set(['admin', 'super-admin', 'user-admin', 'user-super-admin']);

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
// App — all admin observability routes share this Hono instance
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

export default app;
