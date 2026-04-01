/**
 * GHCR License-Gated Access (Phase 5.4)
 *
 * Webhook endpoint + verification API for gating Docker image pulls
 * from GitHub Container Registry (GHCR) by a valid RevealUI license key.
 *
 * Two endpoints:
 * 1. POST /verify — GitHub Packages webhook calls this on image pull.
 *    Returns 200 (allowed) or 403 (denied) based on license entitlement.
 * 2. GET  /status — License status check for CLI/Studio tools.
 *
 * License validation uses the account_entitlements table:
 * - Tier must be 'pro', 'max', or 'enterprise'
 * - Status must be 'active'
 * - Feature flag 'containerRegistry' must be enabled (or tier >= pro)
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { accountEntitlements, accountMemberships } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';

interface GhcrVariables {
  user?: { id: string; role: string };
}

const app = new OpenAPIHono<{ Variables: GhcrVariables }>();

/** Minimum tier required for GHCR access */
const GHCR_TIERS = new Set(['pro', 'max', 'enterprise']);

// ---------------------------------------------------------------------------
// POST /verify — Webhook from GHCR on image pull
// ---------------------------------------------------------------------------

const verifyRoute = createRoute({
  method: 'post',
  path: '/verify',
  tags: ['ghcr'],
  summary: 'Verify license for GHCR image pull',
  description:
    'Called by GitHub Packages webhook on Docker image pull. ' +
    'Validates the license key against account entitlements.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            licenseKey: z.string().min(1),
            image: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            allowed: z.literal(true),
            tier: z.string(),
            accountId: z.string(),
          }),
        },
      },
      description: 'Pull allowed',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Missing or invalid webhook secret',
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({
            allowed: z.literal(false),
            reason: z.string(),
          }),
        },
      },
      description: 'Pull denied — no valid entitlement',
    },
  },
});

app.openapi(verifyRoute, async (c) => {
  // Verify webhook secret (GHCR_WEBHOOK_SECRET)
  const webhookSecret = process.env.GHCR_WEBHOOK_SECRET;
  const provided = c.req.header('X-Webhook-Secret') || c.req.header('x-webhook-secret');

  if (!(webhookSecret && provided)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(webhookSecret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { licenseKey, image } = c.req.valid('json');

  try {
    const result = await verifyLicenseKey(licenseKey);

    if (!result.valid) {
      logger.info('GHCR pull denied', { reason: result.reason, image });
      return c.json({ allowed: false as const, reason: result.reason }, 403);
    }

    logger.info('GHCR pull allowed', {
      accountId: result.accountId,
      tier: result.tier,
      image,
    });

    return c.json({ allowed: true as const, tier: result.tier, accountId: result.accountId }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('GHCR verification failed', undefined, { error: message });
    return c.json({ allowed: false as const, reason: 'Internal verification error' }, 403);
  }
});

// ---------------------------------------------------------------------------
// GET /status — Authenticated license status for CLI/Studio
// ---------------------------------------------------------------------------

const statusRoute = createRoute({
  method: 'get',
  path: '/status',
  tags: ['ghcr'],
  summary: 'Check GHCR access status for authenticated user',
  description: 'Returns whether the authenticated user has GHCR pull access.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            hasAccess: z.boolean(),
            tier: z.string().optional(),
            accountId: z.string().optional(),
          }),
        },
      },
      description: 'Access status',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Not authenticated',
    },
  },
});

app.use('/status', authMiddleware({ required: true }));

app.openapi(statusRoute, async (c) => {
  const userId = c.get('user')?.id;
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const db = getClient();

    // Find accounts the user belongs to with active entitlements
    const memberships = await db
      .select({
        accountId: accountMemberships.accountId,
        tier: accountEntitlements.tier,
        status: accountEntitlements.status,
      })
      .from(accountMemberships)
      .innerJoin(
        accountEntitlements,
        eq(accountMemberships.accountId, accountEntitlements.accountId),
      )
      .where(
        and(
          eq(accountMemberships.userId, userId),
          eq(accountMemberships.status, 'active'),
          eq(accountEntitlements.status, 'active'),
        ),
      );

    const eligible = memberships.find((m) => GHCR_TIERS.has(m.tier));

    if (eligible) {
      return c.json(
        {
          hasAccess: true,
          tier: eligible.tier,
          accountId: eligible.accountId,
        },
        200,
      );
    }

    return c.json({ hasAccess: false }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('GHCR status check failed', undefined, { error: message });
    return c.json({ hasAccess: false }, 200);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface VerifyResult {
  valid: boolean;
  reason: string;
  tier: string;
  accountId: string;
}

/**
 * Verify a license key against account_entitlements.
 *
 * License keys are the account ID itself (or a hashed derivative).
 * The key must map to an active entitlement with tier >= pro.
 */
async function verifyLicenseKey(licenseKey: string): Promise<VerifyResult> {
  const db = getClient();

  // License key is the account ID
  const [entitlement] = await db
    .select({
      accountId: accountEntitlements.accountId,
      tier: accountEntitlements.tier,
      status: accountEntitlements.status,
    })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.accountId, licenseKey))
    .limit(1);

  if (!entitlement) {
    return {
      valid: false,
      reason: 'No entitlement found for this license key',
      tier: '',
      accountId: '',
    };
  }

  if (entitlement.status !== 'active') {
    return {
      valid: false,
      reason: `Entitlement status is '${entitlement.status}', not 'active'`,
      tier: entitlement.tier,
      accountId: entitlement.accountId,
    };
  }

  if (!GHCR_TIERS.has(entitlement.tier)) {
    return {
      valid: false,
      reason: `Tier '${entitlement.tier}' does not include container registry access (requires pro+)`,
      tier: entitlement.tier,
      accountId: entitlement.accountId,
    };
  }

  return {
    valid: true,
    reason: 'ok',
    tier: entitlement.tier,
    accountId: entitlement.accountId,
  };
}

export default app;
