import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { initializeLicense } from '@revealui/core/license'
import { logger } from '@revealui/core/observability/logger'
import { SecurityHeaders, SecurityPresets } from '@revealui/core/security'
import { getClient } from '@revealui/db'
import { licenses } from '@revealui/db/schema'
import { desc, eq } from 'drizzle-orm'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { authMiddleware } from './middleware/auth.js'
import { dbMiddleware } from './middleware/db.js'
import { errorHandler } from './middleware/error.js'
import { checkLicenseStatus, requireFeature } from './middleware/license.js'
import { rateLimitMiddleware, tieredRateLimitMiddleware } from './middleware/rate-limit.js'
import { requestIdMiddleware } from './middleware/request-id.js'
import { tenantMiddleware } from './middleware/tenant.js'
import { createAgentCollabRoute } from './routes/agent-collab.js'
import agentTasksRoute from './routes/agent-tasks.js'
import billingRoute from './routes/billing.js'
import provenanceRoute from './routes/code-provenance.js'
import { createCollabRoute } from './routes/collab.js'
import healthRoute from './routes/health.js'
import licenseRoute from './routes/license.js'
import ticketsRoute from './routes/tickets.js'
import webhooksRoute from './routes/webhooks.js'

// Catch fatal errors that escape all middleware
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception — process will exit', error)
  setTimeout(() => process.exit(1), 1000)
})

process.on('unhandledRejection', (reason: unknown) => {
  const error = reason instanceof Error ? reason : new Error(String(reason))
  logger.error('Unhandled promise rejection', error)
})

/**
 * Parse and validate CORS origins from environment variable.
 * Throws an error in production if CORS_ORIGIN is not properly configured.
 *
 * @returns Array of allowed CORS origins
 * @throws {Error} If CORS_ORIGIN is not set or empty in production
 */
export function getCorsOrigins(): string[] {
  const isProduction = process.env.NODE_ENV === 'production'

  const corsOrigins = isProduction
    ? process.env.CORS_ORIGIN?.split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0) || []
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']

  // Warn if CORS_ORIGIN is not configured — all cross-origin requests will be blocked,
  // but we must not throw here: a module-init throw kills the server before any request
  // is handled, making the health check unreachable and Railway/Vercel unable to diagnose.
  if (isProduction && corsOrigins.length === 0) {
    logger.error(
      'CORS_ORIGIN not set in production — all cross-origin requests will be blocked. ' +
        'Set CORS_ORIGIN to a comma-separated list of allowed origins.',
      undefined,
      { nodeEnv: process.env.NODE_ENV },
    )
  }

  return corsOrigins
}

const app = new OpenAPIHono()
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })
const corsOrigins = getCorsOrigins()

// Security headers (environment-appropriate preset)
const securityPreset =
  process.env.NODE_ENV === 'production' ? SecurityPresets.strict() : SecurityPresets.development()
const securityHeaders = new SecurityHeaders(securityPreset)

// Global middleware
app.use('*', requestIdMiddleware())
app.use(
  '*',
  bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) =>
      c.json({ success: false, error: 'Request body too large. Maximum size is 1MB.' }, 413),
  }),
)
app.use('*', honoLogger())
app.use(
  '*',
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
)
// Apply security headers (CSP, HSTS, X-Frame-Options, etc.) to all responses
app.use('*', async (c, next) => {
  await next()
  const headers = securityHeaders.getHeaders()
  for (const [key, value] of Object.entries(headers)) {
    c.header(key, value)
  }
})
app.use('*', dbMiddleware())

// Rate limiting — tiered global + per-route overrides
app.use(
  '/api/*',
  tieredRateLimitMiddleware({
    tiers: {
      free: { maxRequests: 60, windowMs: 60_000 },
      pro: { maxRequests: 300, windowMs: 60_000 },
      enterprise: { maxRequests: 1000, windowMs: 60_000 },
    },
    keyPrefix: 'api',
  }),
)
app.use(
  '/api/license/generate',
  rateLimitMiddleware({ maxRequests: 5, windowMs: 15 * 60_000, keyPrefix: 'license-gen' }),
)
app.use(
  '/api/agent-tasks/*',
  rateLimitMiddleware({ maxRequests: 10, windowMs: 60_000, keyPrefix: 'agent' }),
)

// Populate session if present (non-blocking — sets user context for all API routes)
app.use('/api/*', authMiddleware({ required: false }))
// Multi-tenant context (optional by default — routes that require it use requireTenant())
app.use('/api/*', tenantMiddleware({ required: false }))

// License status enforcement — catches revoked/expired licenses (5-minute DB cache)
app.use(
  '/api/*',
  checkLicenseStatus(async (customerId) => {
    const db = getClient()
    const [license] = await db
      .select({ status: licenses.status })
      .from(licenses)
      .where(eq(licenses.customerId, customerId))
      .orderBy(desc(licenses.createdAt))
      .limit(1)
    return license?.status ?? null
  }),
)

// License enforcement — gate premium routes by feature
app.use('/api/agent-tasks/*', requireFeature('ai'))
app.use('/api/collab/agent/*', requireFeature('ai'))
app.use('/api/provenance/*', requireFeature('dashboard'))

// Write-protect mutation endpoints — these require authentication
const writeProtected = authMiddleware({ required: true })
app.post('/api/tickets/*', writeProtected)
app.patch('/api/tickets/*', writeProtected)
app.delete('/api/tickets/*', writeProtected)
app.post('/api/agent-tasks/*', writeProtected)
app.post('/api/provenance/*', writeProtected)
app.patch('/api/provenance/*', writeProtected)
app.delete('/api/provenance/*', writeProtected)
app.post('/api/billing/*', writeProtected)

// OpenAPI documentation
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'RevealUI API',
    description: 'REST API for RevealUI application with OpenAPI 3.0 specification',
  },
  servers: [
    {
      url: 'http://localhost:3004',
      description: 'Development server',
    },
  ],
})

// Swagger UI
app.get('/docs', swaggerUI({ url: '/openapi.json' }))

// Routes
app.route('/health', healthRoute)
app.route('/api/license', licenseRoute)
app.route('/api/billing', billingRoute)
app.route('/api/webhooks', webhooksRoute)
app.route('/api/provenance', provenanceRoute)
app.route('/api/tickets', ticketsRoute)
app.route('/api/agent-tasks', agentTasksRoute)
app.route('', createCollabRoute(upgradeWebSocket))
app.route('', createAgentCollabRoute())

// Error handling
app.onError(errorHandler)

// For Vercel serverless
export default app

/**
 * Validate required environment variables and trigger the lazy config proxy
 * so that any missing/invalid config causes a loud failure at startup rather
 * than silently failing on the first real request.
 */
function validateStartup(): void {
  const required = ['POSTGRES_URL', 'NODE_ENV']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `STARTUP VALIDATION FAILED: Missing required environment variables: ${missing.join(', ')}. ` +
        'Check your .env file or deployment configuration.',
    )
  }

  // In production, additional vars are required
  if (process.env.NODE_ENV === 'production') {
    const prodRequired = ['REVEALUI_SECRET']
    const missingProd = prodRequired.filter((key) => !process.env[key])
    if (missingProd.length > 0) {
      throw new Error(
        `STARTUP VALIDATION FAILED: Missing production-required env vars: ${missingProd.join(', ')}.`,
      )
    }
  }
}

// For local development (but not in test environment)
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  validateStartup()
  initializeLicense()
    .then((tier) => {
      logger.info(`License tier: ${tier}`)
    })
    .catch((err: unknown) => {
      logger.error(
        'License initialization failed',
        err instanceof Error ? err : new Error(String(err)),
      )
    })
  const port = Number(process.env.API_PORT || process.env.PORT) || 3004
  const server = serve({ fetch: app.fetch, port })
  injectWebSocket(server)
  logger.info(`🚀 API server running on http://localhost:${port}`)
  logger.info(`📚 API documentation available at http://localhost:${port}/docs`)
  logger.info(`📄 OpenAPI spec available at http://localhost:${port}/openapi.json`)
}

// Also validate in production before accepting traffic
if (process.env.NODE_ENV === 'production') {
  validateStartup()
  initializeLicense()
    .then((tier) => {
      logger.info(`License tier: ${tier}`)
    })
    .catch((err: unknown) => {
      logger.error(
        'License initialization failed',
        err instanceof Error ? err : new Error(String(err)),
      )
    })
}
