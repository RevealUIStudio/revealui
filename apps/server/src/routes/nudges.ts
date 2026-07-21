/**
 * Onboarding Nudge Routes — GAP-300 §7.
 *
 * GET  /api/nudges/current           — the one nudge to show, or null
 * POST /api/nudges/:nudgeId/dismiss  — snooze (1st) or permanently retire (2nd)
 *
 * Server-tracked per user per nudge, not localStorage — see
 * `packages/db/src/schema/nudges.ts` for why. Selection logic lives in
 * `../lib/nudges/selection.ts` + `../lib/nudges/triggers.ts`; this route is
 * the thin authenticated wiring between those and the DB.
 */

import { getClient } from '@revealui/db';
import type { DatabaseClient } from '@revealui/db/client';
import { accountMemberships, nudgeDismissals } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, eq, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  IMPLEMENTED_NUDGE_IDS,
  NUDGE_DEFINITIONS,
  type NudgeId,
} from '../lib/nudges/definitions.js';
import {
  LICENSE_KEY_FETCHED_METER_NAME,
  recordMilestoneMeterFirstSafe,
} from '../lib/nudges/milestone-meters.js';
import {
  type DismissalRecord,
  MAX_DISMISS_COUNT,
  type NudgeCandidate,
  selectNudge,
} from '../lib/nudges/selection.js';
import { fetchNudgeContext } from '../lib/nudges/signals.js';
import { buildCandidates } from '../lib/nudges/triggers.js';

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

type NudgeVariables = {
  db: DatabaseClient;
  user: UserContext | undefined;
};

const app = new OpenAPIHono<{ Variables: NudgeVariables }>();

function requireUser(c: Context): UserContext {
  const user = c.get('user') as UserContext | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  return user;
}

const NudgeIdParam = z.object({
  nudgeId: z.enum(IMPLEMENTED_NUDGE_IDS as [NudgeId, ...NudgeId[]]),
});

const NudgeShape = z.object({
  id: z.string(),
  headline: z.string(),
  body: z.string(),
  ctaLabel: z.string(),
  ctaHref: z.string(),
});

async function loadDismissals(
  db: DatabaseClient,
  userId: string,
): Promise<Map<NudgeId, DismissalRecord>> {
  const rows = await db
    .select({
      nudgeId: nudgeDismissals.nudgeId,
      dismissCount: nudgeDismissals.dismissCount,
      lastDismissedAt: nudgeDismissals.lastDismissedAt,
    })
    .from(nudgeDismissals)
    .where(eq(nudgeDismissals.userId, userId));

  const map = new Map<NudgeId, DismissalRecord>();
  for (const row of rows) {
    map.set(row.nudgeId as NudgeId, {
      dismissCount: row.dismissCount,
      lastDismissedAt: row.lastDismissedAt,
    });
  }
  return map;
}

// ─── GET /api/nudges/current ────────────────────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/current',
    tags: ['Nudges'],
    summary: 'The single onboarding nudge to show, or null',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), nudge: NudgeShape.nullable() }),
          },
        },
        description: 'Current nudge for the authenticated user',
      },
    },
  }),
  async (c) => {
    const user = requireUser(c);
    const db = c.get('db') ?? getClient();

    const { tier, signals } = await fetchNudgeContext(db, user.id);
    const candidates: NudgeCandidate[] = buildCandidates(tier, signals);
    const dismissals = await loadDismissals(db, user.id);
    const selectedId = selectNudge(candidates, dismissals, new Date());

    if (!selectedId) {
      return c.json({ success: true as const, nudge: null });
    }

    const definition = NUDGE_DEFINITIONS[selectedId];
    return c.json({
      success: true as const,
      nudge: {
        id: definition.id,
        headline: definition.headline,
        body: definition.body,
        ctaLabel: definition.ctaLabel,
        ctaHref: definition.ctaHref,
      },
    });
  },
);

// ─── POST /api/nudges/:nudgeId/dismiss ──────────────────────────────────

app.openapi(
  createRoute({
    method: 'post',
    path: '/{nudgeId}/dismiss',
    tags: ['Nudges'],
    summary: 'Snooze (1st call) or permanently retire (2nd call) a nudge',
    request: { params: NudgeIdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), dismissCount: z.number() }),
          },
        },
        description: 'Dismissal recorded',
      },
    },
  }),
  async (c) => {
    const user = requireUser(c);
    const db = c.get('db') ?? getClient();
    const { nudgeId } = c.req.valid('param');

    const [row] = await db
      .insert(nudgeDismissals)
      .values({ userId: user.id, nudgeId, dismissCount: 1 })
      .onConflictDoUpdate({
        target: [nudgeDismissals.userId, nudgeDismissals.nudgeId],
        set: {
          dismissCount: sql`least(${nudgeDismissals.dismissCount} + 1, ${MAX_DISMISS_COUNT})`,
          lastDismissedAt: new Date(),
        },
      })
      .returning({ dismissCount: nudgeDismissals.dismissCount });

    return c.json({ success: true as const, dismissCount: row?.dismissCount ?? 1 });
  },
);

// ─── POST /api/nudges/events ────────────────────────────────────────────
// Client-reported milestone events that must not live on SECURITY_PATHS
// surfaces (billing/license). Only allowlisted event names are accepted.

const NudgeEventBody = z.object({
  event: z.enum(['license_key_fetched']),
});

app.openapi(
  createRoute({
    method: 'post',
    path: '/events',
    tags: ['Nudges'],
    summary: 'Record an allowlisted onboarding milestone event',
    request: {
      body: {
        content: { 'application/json': { schema: NudgeEventBody } },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true) }),
          },
        },
        description: 'Event accepted (idempotent)',
      },
    },
  }),
  async (c) => {
    const user = requireUser(c);
    const { event } = c.req.valid('json');
    const db = c.get('db') ?? getClient();

    const [membership] = await db
      .select({ accountId: accountMemberships.accountId })
      .from(accountMemberships)
      .where(and(eq(accountMemberships.userId, user.id), eq(accountMemberships.status, 'active')))
      .limit(1);

    if (event === 'license_key_fetched') {
      recordMilestoneMeterFirstSafe(membership?.accountId, LICENSE_KEY_FETCHED_METER_NAME, {
        userId: user.id,
        path: 'nudges/events',
      });
    }

    return c.json({ success: true as const });
  },
);

export default app;
