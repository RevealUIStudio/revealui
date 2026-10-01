import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import { getFeaturesForTier } from '@revealui/core/features';
import {
  DEFAULT_MANUAL_MINT_DAYS,
  getLicensePublicKeyTrustManifest,
  getPublicKeys,
  validateLicenseKey,
  validateLicenseKeyAgainstTrustManifest,
  validateLicenseKeyForOperator,
  validateLicenseKeyForRefresh,
} from '@revealui/core/license';
import {
  canMintLicense,
  mintLicenseKey,
  withPerpetualSiteCaps,
} from '@revealui/core/license/mint-client';
import { logger } from '@revealui/core/observability/logger';
import {
  applyLicenseOperation,
  findLicenseOperation,
  getClient,
  isJtiRevoked,
  type LicenseOperationDescriptor,
  LicenseOperationDescriptorSchema,
  type LicenseOperationResult,
  LicensePromotionIdentitySchema,
  LicensePromotionSchema,
} from '@revealui/db';
import { accountMemberships, licenses } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { getOwnerLicenseCurrent, isLicenseAutoProvisionEnabled } from '../lib/license-current.js';
import {
  LICENSE_KEY_FETCHED_METER_NAME,
  recordMilestoneMeterFirstSafe,
} from '../lib/nudges/milestone-meters.js';

type LicenseRouteVariables = {
  user?: { id: string };
  entitlements?: { accountId?: string };
};

const app = new OpenAPIHono<{ Variables: LicenseRouteVariables }>();

// ─── Schemas ─────────────────────────────────────────────────────────────────

const LicenseVerifyRequestSchema = z.object({
  requireRegistration: z.boolean().optional(),
  licenseKey: z.string().min(1).openapi({
    description: 'JWT license key to verify',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  }),
});

const LicenseVerifyResponseSchema = z.object({
  licenseKeyDigest: z.string().optional(),
  trustSetDigest: z.string().optional(),
  verifiedKeyId: z.string().optional(),
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
      'migration_required',
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

const LicenseGenerateInputSchema = z.object({
  operationId: z.string().uuid().openapi({
    description:
      'Stable operation UUID reused with the same request to recover the committed token after a retry.',
  }),
  expectedCurrentLicenseKey: z.string().min(1).optional().openapi({
    description:
      'Exact registered current token to replace; successful rotation atomically revokes its JTI and registers the replacement.',
  }),
  perpetual: z.boolean().optional().openapi({
    description: 'Explicit perpetual entitlement. When true, expiresInDays must be omitted.',
  }),
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
const LicenseGenerateRequestSchema = z
  .union([
    LicenseGenerateInputSchema.extend({
      recoverOnly: z.literal(false).optional(),
      expectedMode: z.enum(['live', 'test']).optional(),
      promotion: LicensePromotionSchema.optional(),
    })
      .strict()
      .refine((input) => !input.promotion || input.expectedMode !== undefined, {
        message: 'Promotion requires an explicit deployment mode assertion',
      }),
    LicenseGenerateInputSchema.omit({ expectedCurrentLicenseKey: true })
      .extend({
        recoverOnly: z.literal(true),
        expectedMode: z.enum(['live', 'test']),
        action: z.enum(['initial', 'rotation']),
        promotion: LicensePromotionIdentitySchema,
      })
      .strict(),
  ])
  .refine((input) => !(input.perpetual === true && input.expiresInDays !== undefined), {
    message: 'perpetual and expiresInDays are mutually exclusive',
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
  operation: LicenseOperationDescriptorSchema.optional(),
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
    503: {
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
      description: 'The configured issuer trust set is unavailable',
    },
  },
});

app.openapi(verifyRoute, async (c) => {
  c.header('Cache-Control', 'no-store');
  const { licenseKey, requireRegistration } = c.req.valid('json');
  const requiresRegistration = requireRegistration === true;
  // Ordered current + optional NEXT (GAP-259 / GAP-261 soak). Same candidate
  // list as refresh so a NEXT-signed token verifies GREEN during rotation.
  let publicKeys: string[] = [];
  let trustManifest: Awaited<ReturnType<typeof getLicensePublicKeyTrustManifest>> | null = null;
  let verifiedKeyId: string | null = null;
  let trustSetDigest: string | null = null;
  let payload: Awaited<ReturnType<typeof validateLicenseKey>> = null;

  if (requiresRegistration) {
    try {
      trustManifest = await getLicensePublicKeyTrustManifest();
    } catch {
      logger.error('License trust set unavailable during strict verification');
      return c.json({ message: 'License trust set unavailable' }, 503);
    }
    const verification = await validateLicenseKeyAgainstTrustManifest(licenseKey, trustManifest);
    payload = verification?.payload ?? null;
    verifiedKeyId = verification?.verifiedKeyId ?? null;
    trustSetDigest = verification?.trustSetDigest ?? null;
  } else {
    publicKeys = getPublicKeys();
    if (publicKeys.length > 0) payload = await validateLicenseKey(licenseKey, publicKeys);
  }

  if (!requiresRegistration && publicKeys.length === 0) {
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

  if (!payload) {
    // JWT is invalid or expired. Check DB to distinguish between revoked (explicit
    // admin action) vs expired (JWT exp past) vs never-valid.
    let reason: 'expired' | 'revoked' | 'invalid' = 'invalid';
    try {
      const db = getClient();
      const [row] = await db
        .select({ status: licenses.status })
        .from(licenses)
        .where(
          c.req.valid('json').requireRegistration
            ? and(eq(licenses.licenseKey, licenseKey), eq(licenses.mode, getConfiguredStripeMode()))
            : eq(licenses.licenseKey, licenseKey),
        )
        .limit(1);
      if (row?.status === 'revoked') reason = 'revoked';
      else if (row?.status === 'expired') reason = 'expired';
    } catch {
      logger.warn('Failed to check DB license status during verify');
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

  // GAP-260 P4-5: per-jti denylist (confirmed absent allowed; sticky once revoked).
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
    } catch {
      logger.warn('jti denylist unavailable during verify — failing closed');
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
        customerId: licenses.customerId,
        tier: licenses.tier,
        deletedAt: licenses.deletedAt,
      })
      .from(licenses)
      .where(
        c.req.valid('json').requireRegistration
          ? and(eq(licenses.licenseKey, licenseKey), eq(licenses.mode, getConfiguredStripeMode()))
          : eq(licenses.licenseKey, licenseKey),
      )
      .limit(1);
    dbStatus =
      row?.deletedAt ||
      (c.req.valid('json').requireRegistration &&
        row &&
        (row.customerId !== payload.customerId || row.tier !== payload.tier))
        ? 'revoked'
        : (row?.status ?? null);
    licenseOwnerUserId = row?.userId ?? null;
    if (row?.perpetual) {
      supportExpiresAt = row.supportExpiresAt;
    }
  } catch {
    dbCheckFailed = true;
    logger.warn('Failed to check DB revocation status during verify  -  failing closed');
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

  if (
    (requiresRegistration && !(payload.jti?.trim() && dbStatus)) ||
    dbStatus === 'revoked' ||
    dbStatus === 'expired'
  ) {
    return c.json(
      {
        valid: false,
        reason:
          requiresRegistration && !dbStatus
            ? ('migration_required' as const)
            : ('revoked' as const),
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
  const trustReceipt =
    requiresRegistration && trustSetDigest !== null && verifiedKeyId !== null
      ? { trustSetDigest, verifiedKeyId }
      : {};

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
    } catch {
      logger.warn('license verify: failed to record activation meter');
    }
  }

  // Strict registration is a fresh authorization receipt, not a cacheable
  // signature result. Refuse success if the configured set changed while the
  // registration and revocation reads were in flight.
  if (requiresRegistration) {
    try {
      const latestManifest = await getLicensePublicKeyTrustManifest();
      const configuredKeys = getPublicKeys();
      const manifestMatchesConfiguration =
        latestManifest.keys.length === configuredKeys.length &&
        latestManifest.keys.every((key, index) => key.publicKey === configuredKeys[index]);
      if (
        latestManifest.digest !== trustSetDigest ||
        !latestManifest.keys.some((key) => key.keyId === verifiedKeyId) ||
        !manifestMatchesConfiguration
      ) {
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
    } catch {
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
  }

  // A lapsed support contract freezes the purchased tier, it does not revoke it.
  // Perpetual licenses are sold as permanent ownership, so entitlements stay at
  // the tier that was bought. What lapses is update delivery and support, and
  // neither is gated on this path. Only `supportExpired` changes here.
  if (dbStatus === 'support_expired' || isSupportExpired) {
    return c.json(
      {
        valid: true,
        licenseKeyDigest: createHash('sha256').update(licenseKey).digest('hex'),
        ...trustReceipt,
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
      licenseKeyDigest: createHash('sha256').update(licenseKey).digest('hex'),
      ...trustReceipt,
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
    200: {
      content: { 'application/json': { schema: LicenseGenerateResponseSchema } },
      description: 'Matching committed operation recovered without minting',
    },
    404: {
      content: {
        'application/json': { schema: z.object({ error: z.literal('operation_not_found') }) },
      },
      description: 'Authenticated recover-only lookup proved that no operation is committed',
    },
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
    409: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Operation conflict or current identity changed',
    },
    503: {
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
  c.header('Cache-Control', 'no-store');
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

  const input = c.req.valid('json');
  const { tier, customerId, domains, maxSites, maxUsers, expiresInDays, perpetual, operationId } =
    input;
  const mode = getConfiguredStripeMode();
  if (input.expectedMode !== undefined && input.expectedMode !== mode) {
    throw new HTTPException(409, { message: 'License deployment mode mismatch' });
  }
  const expiresInSeconds =
    perpetual === true ? null : (expiresInDays ?? DEFAULT_MANUAL_MINT_DAYS) * 86_400;
  const grant = {
    tier,
    domains: domains ?? null,
    maxSites: maxSites ?? null,
    maxUsers: maxUsers ?? null,
    perpetual: perpetual === true,
    expiresInSeconds,
  };
  if (input.recoverOnly === true) {
    try {
      const recovered = await findLicenseOperation(
        getClient(),
        {
          operationId,
          requestFingerprint: '',
          customerId,
          mode,
        },
        { grant, action: input.action, promotion: input.promotion },
      );
      if (!recovered) return c.json({ error: 'operation_not_found' as const }, 404);
      if (!recovered.operation) throw new Error('License operation migration required');
      return c.json(
        { licenseKey: recovered.licenseKey, tier, customerId, operation: recovered.operation },
        200,
      );
    } catch {
      throw new HTTPException(409, {
        message: 'License operation unavailable, conflicting or migration required',
      });
    }
  }
  const expectedCurrentLicenseKey = input.expectedCurrentLicenseKey;
  const mintInput = withPerpetualSiteCaps({
    tier,
    customerId,
    domains,
    maxSites,
    maxUsers,
    perpetual: perpetual === true,
    expiresInSeconds,
  });
  const effectiveGrant = { ...grant, maxSites: mintInput.maxSites ?? null };
  let descriptor: LicenseOperationDescriptor | null = null;
  if (input.promotion) {
    const action = expectedCurrentLicenseKey ? 'rotation' : 'initial';
    const customerPath = `forge/customers/${customerId}/license-key`;
    if (
      input.promotion.path !==
      (customerId === 'founder' ? 'revealui/dev/founder-license-key' : customerPath)
    ) {
      throw new HTTPException(409, { message: 'License promotion customer binding mismatch' });
    }
    descriptor = LicenseOperationDescriptorSchema.parse({
      version: 1,
      operationId,
      customerId,
      mode,
      grant,
      effectiveGrant,
      action,
      expectedCurrentLicenseKeySha256: expectedCurrentLicenseKey
        ? createHash('sha256').update(expectedCurrentLicenseKey).digest('hex')
        : null,
      promotion: input.promotion,
    });
  }
  const fingerprintInput = {
    customerId,
    tier,
    domains: domains ?? null,
    maxSites: maxSites ?? null,
    maxUsers: maxUsers ?? null,
    perpetual: perpetual === true,
    expiresInSeconds,
    mode,
    expectedKeyHash: expectedCurrentLicenseKey
      ? createHash('sha256').update(expectedCurrentLicenseKey).digest('hex')
      : null,
  };
  const requestFingerprint = createHash('sha256')
    .update(JSON.stringify(descriptor ? { ...fingerprintInput, descriptor } : fingerprintInput))
    .digest('hex');
  try {
    const recovered = await findLicenseOperation(
      getClient(),
      { operationId, requestFingerprint, customerId, mode },
      undefined,
      descriptor,
    );
    if (recovered)
      return c.json(
        {
          licenseKey: recovered.licenseKey,
          tier,
          customerId,
          ...(recovered.operation ? { operation: recovered.operation } : {}),
        },
        201,
      );
  } catch {
    throw new HTTPException(409, {
      message: 'License operation unavailable or current identity changed',
    });
  }
  const publicKeys = getPublicKeys();
  if (!publicKeys.length)
    throw new HTTPException(503, { message: 'License authority unavailable' });
  const prior = expectedCurrentLicenseKey
    ? await validateLicenseKeyForOperator(expectedCurrentLicenseKey, publicKeys, customerId)
    : null;
  if (expectedCurrentLicenseKey && (!prior?.jti?.trim() || prior.jti !== prior.jti.trim())) {
    throw new HTTPException(409, { message: 'License migration or current identity required' });
  }
  if (!canMintLicense()) {
    throw new HTTPException(503, { message: 'License signing not configured' });
  }
  const minted = await mintLicenseKey(mintInput);
  const payload = await validateLicenseKey(minted, publicKeys, customerId);
  if (
    !payload?.jti?.trim() ||
    payload.jti !== payload.jti.trim() ||
    payload.tier !== tier ||
    payload.perpetual !== effectiveGrant.perpetual ||
    JSON.stringify(payload.domains ?? null) !== JSON.stringify(effectiveGrant.domains) ||
    (payload.maxSites ?? null) !== effectiveGrant.maxSites ||
    (payload.maxUsers ?? null) !== effectiveGrant.maxUsers ||
    (descriptor &&
      !perpetual &&
      (!(Number.isInteger(payload.iat) && Number.isInteger(payload.exp)) ||
        (payload.exp ?? 0) - (payload.iat ?? 0) !== effectiveGrant.expiresInSeconds)) ||
    (perpetual === true ? payload.exp !== undefined : !payload.exp)
  ) {
    throw new HTTPException(503, { message: 'License signer identity unavailable' });
  }
  let result: LicenseOperationResult;
  try {
    result = await applyLicenseOperation(getClient(), {
      operationId,
      requestFingerprint,
      customerId,
      expectedCurrentLicenseKey: expectedCurrentLicenseKey ?? null,
      priorJti: prior?.jti ?? null,
      priorExpiresAt: prior?.exp ? new Date(prior.exp * 1000) : null,
      licenseId: randomUUID(),
      licenseKey: minted,
      jti: payload.jti,
      tier,
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      perpetual: perpetual === true,
      mode,
      descriptor,
    });
  } catch {
    // SQL driver errors may contain bound token parameters. Never expose/log them.
    throw new HTTPException(409, {
      message: 'License operation unavailable or current identity changed',
    });
  }

  logger.info('License key generated', { tier, customerId });

  return c.json(
    {
      licenseKey: result.licenseKey,
      tier,
      customerId,
      ...(result.operation ? { operation: result.operation } : {}),
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
    'Returns the current stored license key for the bound customerId. The presented JWT must match that customer and an undeleted, non-revoked registered prior token in the configured deployment mode. Unknown separately signed tokens require operator migration. Accepts a registered key expired within the refresh window. Never mints. Unbound or mismatched refresh is denied.',
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
  c.header('Cache-Control', 'no-store');
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

  // Return the current stored key for an ACTIVE, non-deleted license row of the
  // token's customerId, scoped to this deployment's Stripe mode (mirrors
  // getUserLicenseKey in billing.ts). Any DB failure fails closed to the same
  // 403 rather than leaking a distinguishable error.
  try {
    // Refuse revoked or uncertain lineage even if the customer row is active.
    if (payload.jti && (await isJtiRevoked(getClient(), payload.jti))) {
      return deny();
    }
    // Customer names alone cannot bind a credential to a billing mode. Unknown
    // signed credentials require operator migration rather than key disclosure.
    const [priorRow] = await getClient()
      .select({ status: licenses.status })
      .from(licenses)
      .where(
        and(
          eq(licenses.licenseKey, licenseKey),
          eq(licenses.customerId, boundCustomerId),
          eq(licenses.mode, getConfiguredStripeMode()),
          isNull(licenses.deletedAt),
        ),
      )
      .limit(1);
    if (!priorRow || priorRow.status === 'revoked') return deny();
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
  } catch {
    logger.warn('License refresh failed during DB lookup  -  failing closed');
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

// GET /api/license/public-key — versioned public issuer trust set.
const publicKeyRoute = createRoute({
  method: 'get',
  path: '/public-key',
  tags: ['license'],
  summary: 'Get the hosted license issuer trust set',
  description:
    'Returns one current and optionally one NEXT Ed25519 key in that order. keyId is lowercase SHA-256 hex of canonical SPKI DER; jwtKid preserves the existing first-eight-hex SHA-256 of normalized PEM. digest is lowercase SHA-256 hex of UTF-8 compact JSON with property order {version,issuer,audience,keys}, where each ordered key is {role,algorithm,keyId}. Clients must fetch this fixed-origin HTTPS endpoint without redirects and reject an unavailable or malformed trust set. The legacy publicKey property mirrors the current key for compatibility.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            version: z.literal(1),
            issuer: z.literal('https://revealui.com'),
            audience: z.literal('revealui-license'),
            keys: z
              .array(
                z.object({
                  role: z.enum(['current', 'next']),
                  algorithm: z.literal('EdDSA'),
                  publicKey: z.string(),
                  jwtKid: z
                    .string()
                    .length(8)
                    .regex(/^[0-9a-f]{8}$/)
                    .openapi({ description: 'Existing lowercase eight-hex JWT key hint' }),
                  keyId: z
                    .string()
                    .length(64)
                    .regex(/^[0-9a-f]{64}$/)
                    .openapi({ description: 'Lowercase SHA-256 hex of canonical SPKI DER' }),
                }),
              )
              .min(1)
              .max(2)
              .openapi({
                description: 'Exactly current first, followed by optional NEXT; no duplicates',
              }),
            digest: z
              .string()
              .length(64)
              .regex(/^[0-9a-f]{64}$/)
              .openapi({
                description: 'Lowercase SHA-256 hex of the ordered trust-set serialization',
              }),
            publicKey: z.string().openapi({
              description: 'Legacy compatibility field containing the current Ed25519 PEM',
            }),
          }),
        },
      },
      description: 'Versioned hosted issuer trust set',
    },
    503: {
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
      description: 'The hosted issuer trust set is unavailable or invalid',
    },
  },
});

app.openapi(publicKeyRoute, async (c) => {
  // Non-secret verification material. Unescape literal \n (Vercel stores
  // multi-line PEMs escaped) with replaceAll, NOT the :156 regex (no-regex rule
  // for new code); mirrors the generate route's normalize at :372.
  try {
    const manifest = await getLicensePublicKeyTrustManifest();
    c.header('Cache-Control', 'no-store');
    return c.json(manifest, 200);
  } catch {
    logger.error('License public-key trust set is unavailable or invalid');
    c.header('Cache-Control', 'no-store');
    return c.json({ message: 'License trust set unavailable' }, 503);
  }
});

const LicenseCurrentResponseSchema = z.object({
  licenseKey: z.string().nullable().openapi({
    description: 'Signed JWT for the owner, or null when none/revoked',
  }),
  status: z.enum(['active', 'none', 'revoked', 'support_expired']).openapi({
    description: 'Latest license row status for this owner',
  }),
  tier: z.enum(['pro', 'max', 'enterprise']).nullable().openapi({
    description: 'Paid tier, or null when none',
  }),
  expiresAt: z.string().nullable().openapi({
    description: 'License expiration (ISO 8601), or null',
  }),
});

const currentRoute = createRoute({
  method: 'get',
  path: '/current',
  tags: ['license'],
  summary: 'Get the signed-in owner license',
  description:
    'Returns the latest license row for the authenticated user. Never mints. Disabled unless REVEALUI_LICENSE_AUTO_PROVISION=true.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: LicenseCurrentResponseSchema,
        },
      },
      description: 'Owner license snapshot',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Authentication required',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Auto-provision is not enabled',
    },
    503: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'License or revocation authority unavailable; no key returned',
    },
  },
});

app.openapi(currentRoute, async (c) => {
  if (!isLicenseAutoProvisionEnabled()) {
    throw new HTTPException(404, { message: 'Not found' });
  }

  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  let result: Awaited<ReturnType<typeof getOwnerLicenseCurrent>>;
  try {
    result = await getOwnerLicenseCurrent(user.id);
  } catch {
    logger.warn('Owner license authority unavailable — refusing key delivery');
    throw new HTTPException(503, { message: 'License unavailable' });
  }

  if (result.licenseKey) {
    const entitlements = c.get('entitlements') as { accountId?: string } | undefined;
    let resolvedAccountId = entitlements?.accountId ?? null;
    if (!resolvedAccountId) {
      const [membership] = await getClient()
        .select({ accountId: accountMemberships.accountId })
        .from(accountMemberships)
        .where(and(eq(accountMemberships.userId, user.id), eq(accountMemberships.status, 'active')))
        .limit(1);
      resolvedAccountId = membership?.accountId ?? null;
    }
    recordMilestoneMeterFirstSafe(resolvedAccountId, LICENSE_KEY_FETCHED_METER_NAME, {
      userId: user.id,
      path: 'license/current',
    });
  }

  logger.info('Owner license current fetched', {
    userId: user.id,
    status: result.status,
    tier: result.tier,
    hasKey: Boolean(result.licenseKey),
  });

  return c.json(result, 200);
});

export default app;
