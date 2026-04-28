/**
 * DevKit Profile Routes — Max-tier `devkitProfiles` paywall.
 *
 * Per-user selection of which DevKit profile (RevealUI native, agent
 * skills bundle, or external editor: claude / cursor / zed) the user's
 * tooling should apply. The CLI / admin UI fetches the user's setting
 * and applies the matching bundle from `~/suite/revcon/profiles/
 * revealui/<id>/`.
 *
 * The platform leans **RevealUI native** as the recommended default;
 * external editors are kept as secondary options. See
 * `packages/contracts/src/devkit-profiles.ts` for the canonical list.
 *
 * Routes:
 *   GET /api/devkit/profiles            — list all available profiles
 *                                          (auth required, all tiers)
 *   GET /api/devkit/profile/active      — read user's active selection
 *                                          (auth required, all tiers;
 *                                          Free/Pro see null until
 *                                          they upgrade and PUT)
 *   PUT /api/devkit/profile/active      — set user's active selection
 *                                          (auth + Max-tier feature
 *                                          gate; Pro → 403, Max → 200)
 *
 * Mount with `requireFeature('devkitProfiles')` on PUT. See
 * apps/server/src/index.ts for the wiring.
 */

import { DEVKIT_PROFILE_METADATA, DEVKIT_PROFILES, isDevkitProfileId } from '@revealui/contracts';
import { getClient } from '@revealui/db';
import type { DatabaseClient } from '@revealui/db/client';
import { users } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

type DevkitVariables = {
  db: DatabaseClient;
  user: UserContext | undefined;
};

const app = new OpenAPIHono<{ Variables: DevkitVariables }>();

function requireUser(c: Context): UserContext {
  const user = c.get('user') as UserContext | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  return user;
}

// ─── Schemas ──────────────────────────────────────────────────────────────

const ProfileMetaSchema = z.object({
  id: z.enum(DEVKIT_PROFILES),
  label: z.string(),
  description: z.string(),
  kind: z.enum(['native', 'agent-skills', 'external-editor']),
  recommended: z.boolean().optional(),
});

const ActiveSchema = z.object({
  profileId: z.enum(DEVKIT_PROFILES).nullable(),
});

const PutActiveBody = z.object({
  profileId: z.enum(DEVKIT_PROFILES).nullable(),
});

// ─── GET /api/devkit/profiles ─────────────────────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/profiles',
    tags: ['DevKit'],
    summary: 'List available DevKit profiles',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              profiles: z.array(ProfileMetaSchema),
            }),
          },
        },
        description: 'Profile metadata for all five available profiles',
      },
    },
  }),
  async (c) => {
    requireUser(c);
    // Spread to a mutable copy so the OpenAPI response type can match the
    // schema's array shape (the canonical metadata is `readonly` for
    // immutability at the contracts layer).
    return c.json({
      success: true as const,
      profiles: [...DEVKIT_PROFILE_METADATA],
    });
  },
);

// ─── GET /api/devkit/profile/active ───────────────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/profile/active',
    tags: ['DevKit'],
    summary: "Read the user's active DevKit profile",
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ActiveSchema }),
          },
        },
        description: 'User selection (or null if unset)',
      },
    },
  }),
  async (c) => {
    const user = requireUser(c);
    const db = c.get('db') ?? getClient();

    const [row] = await db
      .select({ devkitProfile: users.devkitProfile })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const stored = row?.devkitProfile ?? null;
    const profileId = isDevkitProfileId(stored) ? stored : null;

    return c.json({
      success: true as const,
      data: { profileId },
    });
  },
);

// ─── PUT /api/devkit/profile/active ───────────────────────────────────────

app.openapi(
  createRoute({
    method: 'put',
    path: '/profile/active',
    tags: ['DevKit'],
    summary: "Set the user's active DevKit profile (Max tier)",
    request: { body: { content: { 'application/json': { schema: PutActiveBody } } } },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ActiveSchema }),
          },
        },
        description: 'Profile selection saved',
      },
    },
  }),
  async (c) => {
    const user = requireUser(c);
    const { profileId } = c.req.valid('json');

    if (profileId !== null && !isDevkitProfileId(profileId)) {
      throw new HTTPException(400, { message: 'Invalid profileId' });
    }

    const db = c.get('db') ?? getClient();

    await db.update(users).set({ devkitProfile: profileId }).where(eq(users.id, user.id));

    return c.json({
      success: true as const,
      data: { profileId },
    });
  },
);

export default app;
