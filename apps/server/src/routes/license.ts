import { timingSafeEqual } from 'node:crypto';
import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import { getFeaturesForTier } from '@revealui/core/features';
import {
  DEFAULT_MANUAL_MINT_DAYS,
  getPublicKeys,
  readPemEnv,
  validateLicenseKey,
  validateLicenseKeyForRefresh,
} from '@revealui/core/license';
import {
  canMintLicense,
  mintConfigMissingMessage,
  mintLicenseKey,
} from '@revealui/core/license/mint-client';
import { logger } from '@revealui/core/observability/logger';
import { getClient, isJtiRevoked } from '@revealui/db';
import { licenses } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

const app = new OpenAPIHono();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const LicenseVerifyRequestSchema = z.object({
  licenseKey: z.string().min(1).openapi({
    description: 'JWT license key to verify',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  }),
});

const LicenseVerifyResponseSchema = z.object({
  valid: z.boolean().openapi({ description: 'Whether the license is valid' }),
  reason: z
    .enum([
      'valid',
      'expired',
      'revoked',
      'support_expired',
      'invalid',
      'misconfigured',
      'unverifiable',
    ])
    .optional()
    .openapi({
      description:
        'Why the license is invalid or degraded. "expired": JWT past expiry or DB status expired. "revoked": explicitly revoked in the DB (chargeback, refund, cancellation). "support_expired": perpetual license whose support contract has lapsed (the purchased tier and its features are retained; only updates and support stop). "invalid": bad signature or malformed JWT. "misconfigured": server public key not configured.',
      example: 'revoked',
    }),
  tier: z.enum(['free', 'pro', 'max', 'enterprise']).openapi({
    description: 'License tier',
    example: 'pro',
  }),
  customerId: z.string().nullable().openapi({
    description: 'Customer ID from the license',
    example: 'cus_abc123',
  }),
  features: z.record(z.string(), z.boolean()).openapi({
    description: 'Feature flags enabled by this license',
  }),
  maxSites: z.number().nullable().openapi({
    description: 'Maximum sites allowed',
    example: 5,
  }),
  maxUsers: z.number().nullable().openapi({
    description: 'Maximum users allowed',
    example: 25,
  }),
  expiresAt: z.string().nullable().openapi({
    description: 'License expiration (ISO 8601)',
    example: '2027-02-16T00:00:00.000Z',
  }),
  supportExpiresAt: z.string().nullable().optional().openapi({
    description: 'Support contract expiration for perpetual licenses (ISO 8601)',
    example: '2027-04-03T00:00:00.000Z',
  }),
  supportExpired: z.boolean().optional().openapi({
    description: 'Whether the support contract has expired (perpetual licenses only)',
    example: false,
  }),
});

const LicenseGenerateRequestSchema = z.object({
  tier: z.enum(['pro', 'max', 'enterprise']).openapi({
    description: 'License tier to generate',
    example: 'pro',
  }),
  customerId: z.string().min(1).openapi({
    description: 'Stripe customer ID or internal customer identifier',
    example: 'cus_abc123',
  }),
  domains: z
    .array(z.string().max(253))
    .max(100)
    .optional()
    .openapi({
      description: 'Licensed domains (optional)',
      example: ['example.com', 'app.example.com'],
    }),
  maxSites: z.number().int().positive().max(10_000).optional().openapi({
    description: 'Maximum sites (defaults: Pro=5, Enterprise=unlimited)',
    example: 5,
  }),
  maxUsers: z.number().int().positive().max(1_000_000).optional().openapi({
    description: 'Maximum users (defaults: Pro=25, Enterprise=unlimited)',
    example: 25,
  }),
  expiresInDays: z.number().int().positive().max(3650).optional().openapi({
    description: 'License duration in days (default: 90, max: 10 years)',
    example: 90,
  }),
});

const LicenseGenerateResponseSchema = z.object({
  licenseKey: z.string().openapi({
    description: 'Signed JWT license key',
  }),
  tier: z.enum(['pro', 'max', 'enterprise']).openapi({
    description: 'License tier',
  }),
  customerId: z.string().openapi({
    description: 'Customer ID',
  }),
});

const ErrorSchema = z.object({
  error: z.string().openapi({ example: 'Invalid license key' }),
});

const LicenseRefreshRequestSchema = z.object({
  licenseKey: z.string().min(1).openapi({
    description: 'The current (possibly recently-expired) license key held by the instance',
    example: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...',
  }),
  customerId: z.string().min(1).openapi({
    description:
      'Customer id this instance is bound to. Must match the presented key. Unbound refresh is denied.',
    example: 'cus_abc123',
  }),
});

const LicenseRefreshResponseSchema = z.object({
  licenseKey: z.string().openapi({
    description: 'The current stored license key for this customer',
  }),
});

const RefreshDeniedSchema = z.object({
  error: z.literal('refresh_denied').openapi({
    description: 'Uniform denial. Never distinguishes revoked, missing, or lapsed.',
    example: 'refresh_denied',
  }),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/license/verify  -  Verify a license key and return tier + features
const verifyRoute = createRoute({
  method: 'post',
  path: '/verify',
  tags: ['license'],
  summary: 'Verify a license key',
  description: 'Validates a JWT license key and returns the tier, features, and limits.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LicenseVerifyRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: LicenseVerifyResponseSchema,
        },
      },
      description: 'License verification result',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Missing license key',
    },
  },
});

app.openapi(verifyRoute, async (c) => {
  const { licenseKey } = c.req.valid('json');
  // Ordered current + optional NEXT (GAP-259 / GAP-261 soak). Same candidate
  // list as refresh so a NEXT-signed token verifies GREEN during rotation.
  const publicKeys = getPublicKeys();

  if (publicKeys.length === 0) {
    logger.error('REVEALUI_LICENSE_PUBLIC_KEY not configured');
    return c.json(
      {
        valid: false,
        reason: 'misconfigured' as const,
        tier: 'free' as const,
        customerId: null,
        features: getFeaturesForTier('free'),
        maxSites: 1,
        maxUsers: 3,
        expiresAt: null,
      },
      200,
    );
  }

  const payload = await validateLicenseKey(licenseKey, publicKeys);

  if (!payload) {
    // JWT is invalid or expired. Check DB to distinguish between revoked (explicit
    // admin action) vs expired (JWT exp past) vs never-valid.
    let reason: 'expired' | 'revoked' | 'invalid' = 'invalid';
    try {
      const db = getClient();
      const [row] = await db
        .select({ status: licenses.status })
        .from(licenses)
        .where(eq(licenses.licenseKey, licenseKey))
        .limit(1);
      if (row?.status === 'revoked') reason = 'revoked';
      else if (row?.status === 'expired') reason = 'expired';
    } catch (err) {
      logger.warn('Failed to check DB license status during verify', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }

    return c.json(
      {
        valid: false,
        reason,
        tier: 'free' as const,
        customerId: null,
        features: getFeaturesForTier('free'),
        maxSites: 1,
        maxUsers: 3,
        expiresAt: null,
      },
      200,
    );
  }

  // GAP-260 P4-5: per-jti denylist (fail-open for unknown; sticky once revoked).
  // A leaked token lineage can be refused without rotating the vendor key or
  // revoking every token for the customer.
  if (payload.jti) {
    try {
      if (await isJtiRevoked(getClient(), payload.jti)) {
        return c.json(
          {
            valid: false,
            reason: 'revoked' as const,
            tier: 'free' as const,
            customerId: null,
            features: getFeaturesForTier('free'),
            maxSites: 1,
            maxUsers: 3,
            expiresAt: null,
          },
          200,
        );
      }
    } catch (err) {
      // isJtiRevoked already fail-opens on DB errors; this catch is defensive.
      logger.warn('jti denylist check threw during verify — treating as not denylisted', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // JWT is structurally valid  -  also check DB status to catch explicit revocations
  // (e.g., chargeback, refund, manual revoke) that may have occurred after the JWT
  // was issued but before its exp timestamp.
  let dbStatus: string | null = null;
  let supportExpiresAt: Date | null = null;
  let dbCheckFailed = false;
  let licenseOwnerUserId: string | null = null;
  try {
    const db = getClient();
    const [row] = await db
      .select({
        status: licenses.status,
        supportExpiresAt: licenses.supportExpiresAt,
        perpetual: licenses.perpetual,
        userId: licenses.userId,
      })
      .from(licenses)
      .where(eq(licenses.licenseKey, licenseKey))
      .limit(1);
    dbStatus = row?.status ?? null;
    licenseOwnerUserId = row?.userId ?? null;
    if (row?.perpetual) {
      supportExpiresAt = row.supportExpiresAt;
    }
  } catch (err) {
    dbCheckFailed = true;
    logger.warn('Failed to check DB revocation status during verify  -  failing closed', {
      error: err instanceof Error ? err.message : 'unknown',
    });
  }

  // Fail closed on an unverifiable revocation status. A structurally-valid JWT
  // whose current revocation state could NOT be read (DB outage) must not be
  // trusted: a revoked-but-unexpired token would otherwise report valid for the
  // duration of any DB blip. Report not-authorized (free tier) so the caller
  // treats it as unlicensed rather than granting the JWT's paid tier.
  if (dbCheckFailed) {
    return c.json(
      {
        valid: false,
        reason: 'unverifiable' as const,
        tier: 'free' as const,
        customerId: null,
        features: getFeaturesForTier('free'),
        maxSites: 1,
        maxUsers: 3,
        expiresAt: null,
      },
      200,
    );
  }

  if (dbStatus === 'revoked' || dbStatus === 'expired') {
    return c.json(
      {
        valid: false,
        reason: 'revoked' as const,
        tier: 'free' as const,
        customerId: null,
        features: getFeaturesForTier('free'),
        maxSites: 1,
        maxUsers: 3,
        expiresAt: null,
      },
      200,
    );
  }

  const now = new Date();
  const isSupportExpired =
    payload.perpetual === true && supportExpiresAt !== null && supportExpiresAt < now;

  const features = getFeaturesForTier(payload.tier);
  const defaultMaxSites = payload.tier === 'enterprise' ? null : (payload.maxSites ?? 5);
  const defaultMaxUsers = payload.tier === 'enterprise' ? null : (payload.maxUsers ?? 25);

  // GAP-300 durable activation: daemon/runtime successfully verified the JWT.
  // Server-owned write on routes/license (security surface by design).
  if (licenseOwnerUserId) {
    try {
      const { recordMilestoneMeterFirstSafe, LICENSE_ACTIVATED_METER_NAME } = await import(
        '../lib/nudges/milestone-meters.js'
      );
      const { accountMemberships } = await import('@revealui/db/schema');
      const [membership] = await getClient()
        .select({ accountId: accountMemberships.accountId })
        .from(accountMemberships)
        .where(
          and(
            eq(accountMemberships.userId, licenseOwnerUserId),
            eq(accountMemberships.status, 'active'),
          ),
        )
        .limit(1);
      recordMilestoneMeterFirstSafe(membership?.accountId, LICENSE_ACTIVATED_METER_NAME, {
        userId: licenseOwnerUserId,
        path: 'license/verify',
      });
    } catch (err) {
      logger.warn('license verify: failed to record activation meter', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  // A lapsed support contract freezes the purchased tier, it does not revoke it.
  // Perpetual licenses are sold as permanent ownership, so entitlements stay at
  // the tier that was bought. What lapses is update delivery and support, and
  // neither is gated on this path. Only `supportExpired` changes here.
  if (dbStatus === 'support_expired' || isSupportExpired) {
    return c.json(
      {
        valid: true,
        reason: 'support_expired' as const,
        tier: payload.tier,
        customerId: payload.customerId,
        features,
        maxSites: defaultMaxSites,
        maxUsers: defaultMaxUsers,
        // Perpetual payloads omit `exp`, so there is no expiry to report.
        expiresAt: null,
        supportExpiresAt: supportExpiresAt?.toISOString() ?? null,
        supportExpired: true,
      },
      200,
    );
  }

  return c.json(
    {
      valid: true,
      reason: 'valid' as const,
      tier: payload.tier,
      customerId: payload.customerId,
      features,
      maxSites: defaultMaxSites,
      maxUsers: defaultMaxUsers,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      supportExpiresAt: supportExpiresAt?.toISOString() ?? null,
      supportExpired: false,
    },
    200,
  );
});

// POST /api/license/generate  -  Admin-only: generate a new license key
const generateRoute = createRoute({
  method: 'post',
  path: '/generate',
  tags: ['license'],
  summary: 'Generate a license key (admin only)',
  description:
    'Creates a signed JWT license key for a customer. Requires license mint config (REVEALUI_LICENSE_PRIVATE_KEY, or REVEALUI_LICENSE_SIGN_VIA_SIGNER + signer URL/secret) and admin API key.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LicenseGenerateRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: LicenseGenerateResponseSchema,
        },
      },
      description: 'License key generated',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Unauthorized  -  missing or invalid admin API key',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Server error  -  missing private key configuration',
    },
  },
});

app.openapi(generateRoute, async (c) => {
  // Admin authentication via API key header
  const apiKey = c.req.header('X-Admin-API-Key');
  const expectedKey = process.env.REVEALUI_ADMIN_API_KEY;

  if (!(expectedKey && apiKey)) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  const a = Buffer.from(apiKey, 'utf-8');
  const b = Buffer.from(expectedKey, 'utf-8');
  // Reject on length mismatch  -  admin API key length is not a secret
  if (a.length !== b.length) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  if (!timingSafeEqual(a, b)) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }

  if (!canMintLicense()) {
    logger.error(mintConfigMissingMessage());
    throw new HTTPException(500, { message: 'License signing not configured' });
  }

  const { tier, customerId, domains, maxSites, maxUsers, expiresInDays } = c.req.valid('json');

  // jti auto-generated by generateLicenseKey / signer when omitted (Phase 1 audit B-2).
  // GAP-287 PR-3: default drops to DEFAULT_MANUAL_MINT_DAYS (90d, down from
  // 365d) for manually-minted keys; an explicit expiresInDays is always
  // honored unchanged.
  // GAP-260 P4-3: mintLicenseKey routes local vs license-signer.
  const expiresInSeconds = (expiresInDays ?? DEFAULT_MANUAL_MINT_DAYS) * 24 * 60 * 60;
  const licenseKey = await mintLicenseKey({
    tier,
    customerId,
    ...(domains && { domains }),
    ...(maxSites && { maxSites }),
    ...(maxUsers && { maxUsers }),
    expiresInSeconds,
  });

  logger.info('License key generated', { tier, customerId });

  return c.json(
    {
      licenseKey,
      tier,
      customerId,
    },
    201,
  );
});

// POST /api/license/refresh  -  Machine path to fetch the current stored key
//
// GAP-287 PR-1. A running self-hosted instance presents its current (possibly
// recently-expired) key and receives the CURRENT stored key for its license.
// It NEVER mints: it only returns what the webhook lifecycle already wrote, so
// it cannot extend entitlement beyond what billing granted. Auth is possession
// of a recently-valid signed key (within REFRESH_ACCEPT_DAYS of exp) bound to
// the caller's customerId, plus an ACTIVE license row for that customer.
// Unbound refresh and a JWT for customer A requesting customer B both fail
// closed. Every failure returns the same 403 with no reason.
const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  tags: ['license'],
  summary: 'Refresh a license key',
  description:
    'Returns the current stored license key for the bound customerId. The presented JWT must match that customer. Accepts a key expired within the refresh window. Never mints. Unbound or mismatched refresh is denied.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LicenseRefreshRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: LicenseRefreshResponseSchema,
        },
      },
      description: 'The current stored license key',
    },
    403: {
      content: {
        'application/json': {
          schema: RefreshDeniedSchema,
        },
      },
      description: 'Refresh denied',
    },
  },
});

app.openapi(refreshRoute, async (c) => {
  const { licenseKey, customerId } = c.req.valid('json');
  const boundCustomerId = customerId.trim();

  // Every denial returns the identical body + status. The presented key's
  // signature validity, expiry position, revocation, and row state must not be
  // distinguishable to the caller (no refresh oracle).
  const deny = () => c.json({ error: 'refresh_denied' as const }, 403);

  if (boundCustomerId.length === 0) {
    return deny();
  }

  // Verify against the ordered public-key set (current + rotation NEXT), so a
  // key minted under the outgoing private key still refreshes during a rotation
  // window (GAP-259). An unconfigured key is an operator fault, not a customer
  // fault: fail closed but log loudly server-side.
  const publicKeys = getPublicKeys();
  if (publicKeys.length === 0) {
    logger.error('REVEALUI_LICENSE_PUBLIC_KEY not configured; license refresh cannot verify');
    return deny();
  }

  // Signature valid, customerId bound, AND exp past by at most REFRESH_ACCEPT_DAYS.
  const payload = await validateLicenseKeyForRefresh(licenseKey, publicKeys, boundCustomerId);
  if (!payload || payload.customerId !== boundCustomerId) {
    return deny();
  }

  // GAP-260 P4-5: refuse a specifically revoked jti even when the customer
  // still has an active license row (leaked-token lineage).
  if (payload.jti && (await isJtiRevoked(getClient(), payload.jti))) {
    return deny();
  }

  // Return the current stored key for an ACTIVE, non-deleted license row of the
  // token's customerId, scoped to this deployment's Stripe mode (mirrors
  // getUserLicenseKey in billing.ts). Any DB failure fails closed to the same
  // 403 rather than leaking a distinguishable error.
  try {
    const [row] = await getClient()
      .select({ licenseKey: licenses.licenseKey })
      .from(licenses)
      .where(
        and(
          eq(licenses.customerId, boundCustomerId),
          eq(licenses.status, 'active'),
          isNull(licenses.deletedAt),
          eq(licenses.mode, getConfiguredStripeMode()),
        ),
      )
      .orderBy(desc(licenses.createdAt))
      .limit(1);

    if (!row?.licenseKey) {
      return deny();
    }

    logger.info('License key refreshed', { customerId: payload.customerId, tier: payload.tier });
    return c.json({ licenseKey: row.licenseKey }, 200);
  } catch (err) {
    logger.warn('License refresh failed during DB lookup  -  failing closed', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return deny();
  }
});

// GET /api/license/features  -  Public: list features per tier
const featuresRoute = createRoute({
  method: 'get',
  path: '/features',
  tags: ['license'],
  summary: 'List features by tier',
  description: 'Returns which features are available at each license tier.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            free: z.record(z.string(), z.boolean()),
            pro: z.record(z.string(), z.boolean()),
            enterprise: z.record(z.string(), z.boolean()),
          }),
        },
      },
      description: 'Feature comparison by tier',
    },
  },
});

app.openapi(featuresRoute, async (c) => {
  return c.json(
    {
      free: getFeaturesForTier('free'),
      pro: getFeaturesForTier('pro'),
      max: getFeaturesForTier('max'),
      enterprise: getFeaturesForTier('enterprise'),
    },
    200,
  );
});

// GET /api/license/public-key  -  Public: the vendor Ed25519 public key (PEM)
const publicKeyRoute = createRoute({
  method: 'get',
  path: '/public-key',
  tags: ['license'],
  summary: 'Get the vendor license public key (PEM)',
  description:
    'Returns the Ed25519 public key used to verify license JWTs. This is PUBLIC material (no auth): a buyer sets it as REVDEV_LICENSE_PUBLIC_KEY so the RevDev daemon can verify their license. Null when the server has no key configured.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            publicKey: z.string().nullable().openapi({
              description: 'Ed25519 vendor public key in PEM, or null when unconfigured',
              example: '-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----',
            }),
          }),
        },
      },
      description: 'Vendor public key (PEM), or null when the server has none configured',
    },
  },
});

app.openapi(publicKeyRoute, async (c) => {
  // Non-secret verification material. Unescape literal \n (Vercel stores
  // multi-line PEMs escaped) with replaceAll, NOT the :156 regex (no-regex rule
  // for new code); mirrors the generate route's normalize at :372.
  const publicKey = readPemEnv('REVEALUI_LICENSE_PUBLIC_KEY') ?? null;
  return c.json({ publicKey }, 200);
});

export default app;
