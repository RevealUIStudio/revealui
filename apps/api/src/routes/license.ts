import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { getFeaturesForTier } from '@revealui/core/features'
import { generateLicenseKey, type LicensePayload, validateLicenseKey } from '@revealui/core/license'
import { logger } from '@revealui/core/observability/logger'
import { HTTPException } from 'hono/http-exception'

const app = new OpenAPIHono()

// ─── Schemas ─────────────────────────────────────────────────────────────────

const LicenseVerifyRequestSchema = z.object({
  licenseKey: z.string().min(1).openapi({
    description: 'JWT license key to verify',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  }),
})

const LicenseVerifyResponseSchema = z.object({
  valid: z.boolean().openapi({ description: 'Whether the license is valid' }),
  tier: z.enum(['free', 'pro', 'enterprise']).openapi({
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
})

const LicenseGenerateRequestSchema = z.object({
  tier: z.enum(['pro', 'enterprise']).openapi({
    description: 'License tier to generate',
    example: 'pro',
  }),
  customerId: z.string().min(1).openapi({
    description: 'Stripe customer ID or internal customer identifier',
    example: 'cus_abc123',
  }),
  domains: z
    .array(z.string())
    .optional()
    .openapi({
      description: 'Licensed domains (optional)',
      example: ['example.com', 'app.example.com'],
    }),
  maxSites: z.number().int().positive().optional().openapi({
    description: 'Maximum sites (defaults: Pro=5, Enterprise=unlimited)',
    example: 5,
  }),
  maxUsers: z.number().int().positive().optional().openapi({
    description: 'Maximum users (defaults: Pro=25, Enterprise=unlimited)',
    example: 25,
  }),
  expiresInDays: z.number().int().positive().optional().openapi({
    description: 'License duration in days (default: 365)',
    example: 365,
  }),
})

const LicenseGenerateResponseSchema = z.object({
  licenseKey: z.string().openapi({
    description: 'Signed JWT license key',
  }),
  tier: z.enum(['pro', 'enterprise']).openapi({
    description: 'License tier',
  }),
  customerId: z.string().openapi({
    description: 'Customer ID',
  }),
})

const ErrorSchema = z.object({
  error: z.string().openapi({ example: 'Invalid license key' }),
})

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/license/verify — Verify a license key and return tier + features
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
})

app.openapi(verifyRoute, async (c) => {
  const { licenseKey } = c.req.valid('json')
  const publicKey = process.env.REVEALUI_LICENSE_PUBLIC_KEY

  if (!publicKey) {
    logger.error('REVEALUI_LICENSE_PUBLIC_KEY not configured')
    return c.json(
      {
        valid: false,
        tier: 'free' as const,
        customerId: null,
        features: getFeaturesForTier('free'),
        maxSites: 1,
        maxUsers: 3,
        expiresAt: null,
      },
      200,
    )
  }

  const payload = validateLicenseKey(licenseKey, publicKey)

  if (!payload) {
    return c.json(
      {
        valid: false,
        tier: 'free' as const,
        customerId: null,
        features: getFeaturesForTier('free'),
        maxSites: 1,
        maxUsers: 3,
        expiresAt: null,
      },
      200,
    )
  }

  const features = getFeaturesForTier(payload.tier)
  const defaultMaxSites = payload.tier === 'enterprise' ? null : (payload.maxSites ?? 5)
  const defaultMaxUsers = payload.tier === 'enterprise' ? null : (payload.maxUsers ?? 25)

  return c.json(
    {
      valid: true,
      tier: payload.tier,
      customerId: payload.customerId,
      features,
      maxSites: defaultMaxSites,
      maxUsers: defaultMaxUsers,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
    },
    200,
  )
})

// POST /api/license/generate — Admin-only: generate a new license key
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
      description: 'Unauthorized — missing or invalid admin API key',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Server error — missing private key configuration',
    },
  },
})

app.openapi(generateRoute, async (c) => {
  // Admin authentication via API key header
  const apiKey = c.req.header('X-Admin-API-Key')
  const expectedKey = process.env.REVEALUI_ADMIN_API_KEY

  if (!expectedKey || apiKey !== expectedKey) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }

  const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY

  if (!privateKey) {
    logger.error('REVEALUI_LICENSE_PRIVATE_KEY not configured')
    throw new HTTPException(500, { message: 'License signing not configured' })
  }

  const { tier, customerId, domains, maxSites, maxUsers, expiresInDays } = c.req.valid('json')

  const payload: Omit<LicensePayload, 'iat' | 'exp'> = {
    tier,
    customerId,
    ...(domains && { domains }),
    ...(maxSites && { maxSites }),
    ...(maxUsers && { maxUsers }),
  }

  const expiresInSeconds = (expiresInDays ?? 365) * 24 * 60 * 60
  const licenseKey = generateLicenseKey(payload, privateKey, expiresInSeconds)

  logger.info('License key generated', { tier, customerId })

  return c.json(
    {
      licenseKey,
      tier,
      customerId,
    },
    201,
  )
})

// GET /api/license/features — Public: list features per tier
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
})

app.openapi(featuresRoute, async (c) => {
  return c.json(
    {
      free: getFeaturesForTier('free'),
      pro: getFeaturesForTier('pro'),
      enterprise: getFeaturesForTier('enterprise'),
    },
    200,
  )
})

export default app
