/**
 * Credential Rotation Routes — Pro-tier `vaultRotation` paywall.
 *
 * Read-only audit-history surface over `audit_log` for credential
 * lifecycle events emitted by `apps/api/src/routes/api-keys.ts`:
 *
 *   - credential:created   (POST   /api/api-keys)
 *   - credential:rotated   (POST   /api/api-keys/:id/rotate)
 *   - credential:revoked   (DELETE /api/api-keys/:id)
 *
 * The ROTATE / CREATE / REVOKE operations themselves are NOT gated —
 * any authenticated user can manage their stored API keys (Free tier
 * unaffected). The Pro-tier value here is the AUDIT INSIGHT layer:
 * Pro+ users get a queryable history of their credential lifecycle
 * events for compliance and rotation cadence reporting.
 *
 * Routes:
 *   GET /api/rotation/history?days=N&kind=user_api_key
 *     — list rotation/create/revoke events for the authenticated user
 *
 * Account scoping: events are filtered by `audit_log.agent_id =
 * user.id`. Multi-user accounts: each user sees their own credential
 * events; cross-user account-wide views are out of scope here (admin
 * tier `auditLog` export covers that).
 */

import { getClient } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import { auditLog } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

type RotationVariables = {
  db: Database;
  user: UserContext | undefined;
};

const app = new OpenAPIHono<{ Variables: RotationVariables }>();

const MAX_DAYS = 365;
const DEFAULT_DAYS = 30;

const CREDENTIAL_EVENT_TYPES = [
  'credential:created',
  'credential:rotated',
  'credential:revoked',
] as const;

function requireUser(c: Context): UserContext {
  const user = c.get('user') as UserContext | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  return user;
}

function periodStart(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ─── Schemas ──────────────────────────────────────────────────────────────

const HistoryQuery = z.object({
  days: z.coerce.number().int().min(1).max(MAX_DAYS).default(DEFAULT_DAYS),
  kind: z.enum(['user_api_key']).optional(),
});

const HistoryEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  eventType: z.enum(CREDENTIAL_EVENT_TYPES),
  credentialKind: z.string(),
  credentialId: z.string(),
  provider: z.string(),
  label: z.string().nullable(),
});

// ─── GET /api/rotation/history ────────────────────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/history',
    tags: ['Rotation'],
    summary: "Read the user's credential lifecycle history",
    request: { query: HistoryQuery },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              days: z.number(),
              entries: z.array(HistoryEntrySchema),
            }),
          },
        },
        description: 'Credential events for the authenticated user, newest first',
      },
    },
  }),
  async (c) => {
    const user = requireUser(c);
    const { days } = c.req.valid('query');
    const db = c.get('db') ?? getClient();

    const start = periodStart(days);

    const rows = await db
      .select({
        id: auditLog.id,
        timestamp: auditLog.timestamp,
        eventType: auditLog.eventType,
        payload: auditLog.payload,
      })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.agentId, user.id),
          inArray(auditLog.eventType, CREDENTIAL_EVENT_TYPES as unknown as string[]),
          gte(auditLog.timestamp, start),
        ),
      )
      .orderBy(desc(auditLog.timestamp))
      .limit(500);

    const entries = rows.map((r) => {
      const payload = (r.payload ?? {}) as {
        credentialKind?: string;
        credentialId?: string;
        provider?: string;
        label?: string | null;
      };
      return {
        id: r.id,
        timestamp: r.timestamp.toISOString(),
        eventType: r.eventType as (typeof CREDENTIAL_EVENT_TYPES)[number],
        credentialKind: payload.credentialKind ?? 'unknown',
        credentialId: payload.credentialId ?? 'unknown',
        provider: payload.provider ?? 'unknown',
        label: payload.label ?? null,
      };
    });

    return c.json({
      success: true as const,
      days,
      entries,
    });
  },
);

export default app;
