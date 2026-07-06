import { timingSafeEqual } from 'node:crypto';
import { getFeaturesForTier } from '@revealui/core/features';
import {
  generateLicenseKey,
  type LicensePayload,
  validateLicenseKey,
} from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { licenses } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { eq } from 'drizzle-orm';
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
        'Why the license is invalid or degraded. "expired": JWT past expiry or DB status expired. "revoked": explicitly revoked in the DB (chargeback, refund, cancellation). "support_expired": perpetual license with expired support contract (basic admin still valid, premium features downgraded). "invalid": bad signature or malformed JWT. "misconfigured": server public key not configured.',
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
    description: 'License duration in days (default: 365, max: 10 years)',
    example: 365,
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
  // Restore real newlines in a single-line PEM (split/join, no authored regex
  // — mirrors @revealui/core/license normalizePem). GAP-259 P0-4.
  const publicKey =
    process.env.REVEALUI_LICENSE_PUBLIC_KEY?.split('\\n').join('\n') ?? undefined;

  if (!publicKey) {
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

  const payload = await validateLicenseKey(licenseKey, publicKey);

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

  // JWT is structurally valid  -  also check DB status to catch explicit revocations
  // (e.g., chargeback, refund, manual revoke) that may have occurred after the JWT
  // was issued but before its exp timestamp.
  let dbStatus: string | null = null;
  let supportExpiresAt: Date | null = null;
  let dbCheckFailed = false;
  try {
    const db = getClient();
    const [row] = await db
      .select({
        status: licenses.status,
        supportExpiresAt: licenses.supportExpiresAt,
        perpetual: licenses.perpetual,
      })
      .from(licenses)
      .where(eq(licenses.licenseKey, licenseKey))
      .limit(1);
    dbStatus = row?.status ?? null;
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

  // Perpetual license with expired support: license is still valid but premium
  // features are downgraded to free tier. Basic admin access remains perpetual.
  if (dbStatus === 'support_expired' || isSupportExpired) {
    return c.json(
      {
        valid: true,
        reason: 'support_expired' as const,
        tier: payload.tier,
        customerId: payload.customerId,
        features: getFeaturesForTier('free'),
        maxSites: 1,
        maxUsers: 3,
        expiresAt: null,
        supportExpiresAt: supportExpiresAt?.toISOString() ?? null,
        supportExpired: true,
      },
      200,
    );
  }

  const features = getFeaturesForTier(payload.tier);
  const defaultMaxSites = payload.tier === 'enterprise' ? null : (payload.maxSites ?? 5);
  const defaultMaxUsers = payload.tier === 'enterprise' ? null : (payload.maxUsers ?? 25);

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
    'Creates a signed JWT license key for a customer. Requires REVEALUI_LICENSE_PRIVATE_KEY and admin API key.',
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

  const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY;

  if (!privateKey) {
    logger.error('REVEALUI_LICENSE_PRIVATE_KEY not configured');
    throw new HTTPException(500, { message: 'License signing not configured' });
  }

  // Unescape literal \n sequences  -  Vercel stores multi-line PEM keys
  // with \n escaped in the .env format; the runtime preserves the literal
  // \n chars, so we must convert them to real newlines for jose/importPKCS8.
  // Matches the unescape pattern at routes/webhooks.ts:1009, 1229, 1847, 2391.
  const normalizedKey = privateKey.replaceAll('\\n', '\n');

  const { tier, customerId, domains, maxSites, maxUsers, expiresInDays } = c.req.valid('json');

  // jti auto-generated by generateLicenseKey when omitted (Phase 1 audit B-2).
  const payload: Omit<LicensePayload, 'iat' | 'exp' | 'jti'> = {
    tier,
    customerId,
    ...(domains && { domains }),
    ...(maxSites && { maxSites }),
    ...(maxUsers && { maxUsers }),
  };

  const expiresInSeconds = (expiresInDays ?? 365) * 24 * 60 * 60;
  const licenseKey = await generateLicenseKey(payload, normalizedKey, expiresInSeconds);

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
  const publicKey = process.env.REVEALUI_LICENSE_PUBLIC_KEY?.replaceAll('\\n', '\n') ?? null;
  return c.json({ publicKey }, 200);
});

export default app;
