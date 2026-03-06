import { serve } from '@hono/node-server'
import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { initializeLicense } from '@revealui/core/license'
import { logger } from '@revealui/core/observability/logger'
import { SecurityHeaders, SecurityPresets } from '@revealui/core/security'
import { closeAllPools, getClient } from '@revealui/db'
import { createDbLogHandler } from '@revealui/db/log-transport'
import { licenses, sites } from '@revealui/db/schema'
import { desc, eq } from 'drizzle-orm'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { authMiddleware, requireRole } from './middleware/auth.js'
import { dbMiddleware } from './middleware/db.js'
import { domainLockMiddleware, validateForgeConfig } from './middleware/domain-lock.js'
import { errorHandler } from './middleware/error.js'
import { checkLicenseStatus, requireFeature } from './middleware/license.js'
import { rateLimitMiddleware, tieredRateLimitMiddleware } from './middleware/rate-limit.js'
import { requestIdMiddleware } from './middleware/request-id.js'
import { enforceSiteLimit } from './middleware/resource-limits.js'
import { tenantMiddleware } from './middleware/tenant.js'
import { a2aRoutes, wellKnownRoutes } from './routes/a2a.js'
import { createAgentCollabRoute } from './routes/agent-collab.js'
import agentStreamRoute from './routes/agent-stream.js'
import agentTasksRoute from './routes/agent-tasks.js'
import apiKeysRoute from './routes/api-keys.js'
import billingRoute from './routes/billing.js'
import provenanceRoute from './routes/code-provenance.js'
import { createCollabRoute } from './routes/collab.js'
import contentRoute from './routes/content.js'
import errorsRoute from './routes/errors.js'
import healthRoute from './routes/health.js'
import licenseRoute from './routes/license.js'
import logsRoute from './routes/logs.js'
import ragIndexRoute from './routes/rag-index.js'
import ticketsRoute from './routes/tickets.js'
import webhooksRoute from './routes/webhooks.js'

// Ship warn+ logs to NeonDB in production
if (process.env.NODE_ENV === 'production') {
  logger.addLogHandler(createDbLogHandler('api'))
}

// Catch fatal errors that escape all middleware
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception — process will exit', error)
  setTimeout(() => process.exit(1), 1000)
})

process.on('unhandledRejection', (reason: unknown) => {
  const error = reason instanceof Error ? reason : new Error(String(reason))
  logger.error('Unhandled promise rejection', error)
})

// Graceful shutdown — close database connection pools before exit
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — closing database pools`)
  try {
    await closeAllPools()
    logger.info('Database pools closed')
  } catch (err) {
    logger.error(
      'Error closing database pools',
      err instanceof Error ? err : new Error(String(err)),
    )
  }
  process.exit(0)
}

process.once('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.once('SIGINT', () => gracefulShutdown('SIGINT'))

// Validate Forge config at startup — exits if FORGE_* env vars are inconsistent
validateForgeConfig()

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
const corsOrigins = getCorsOrigins()

// Security headers (environment-appropriate preset)
const securityPreset =
  process.env.NODE_ENV === 'production' ? SecurityPresets.strict() : SecurityPresets.development()
const securityHeaders = new SecurityHeaders(securityPreset)

// Global middleware
app.use('*', domainLockMiddleware()) // Forge: reject requests from unlicensed domains
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
// Applied to both /api/* and /api/v1/* for versioned route support
const tieredRateLimit = tieredRateLimitMiddleware({
  tiers: {
    free: { maxRequests: 60, windowMs: 60_000 },
    pro: { maxRequests: 300, windowMs: 60_000 },
    max: { maxRequests: 600, windowMs: 60_000 },
    enterprise: { maxRequests: 1000, windowMs: 60_000 },
  },
  keyPrefix: 'api',
})
app.use('/api/*', tieredRateLimit)
app.use('/api/v1/*', tieredRateLimit)

const licenseGenLimit = rateLimitMiddleware({
  maxRequests: 5,
  windowMs: 15 * 60_000,
  keyPrefix: 'license-gen',
})
app.use('/api/license/generate', licenseGenLimit)
app.use('/api/v1/license/generate', licenseGenLimit)

// A2A discovery endpoints are public per the A2A spec — rate limit to prevent enumeration abuse
const a2aDiscoveryLimit = rateLimitMiddleware({
  maxRequests: 60,
  windowMs: 60_000,
  keyPrefix: 'a2a-discovery',
})
app.use('/.well-known/*', a2aDiscoveryLimit)
app.use('/a2a/agents', a2aDiscoveryLimit)
app.use('/a2a/agents/*', a2aDiscoveryLimit)

const agentLimit = rateLimitMiddleware({
  maxRequests: 10,
  windowMs: 60_000,
  keyPrefix: 'agent',
})
app.use('/api/agent-tasks/*', agentLimit)
app.use('/api/v1/agent-tasks/*', agentLimit)

const agentStreamLimit = rateLimitMiddleware({
  maxRequests: 10,
  windowMs: 60_000,
  keyPrefix: 'agent-stream',
})
app.use('/api/agent-stream', agentStreamLimit)
app.use('/api/v1/agent-stream', agentStreamLimit)

const ragLimit = rateLimitMiddleware({ maxRequests: 20, windowMs: 60_000, keyPrefix: 'rag' })
app.use('/api/rag/*', ragLimit)
app.use('/api/v1/rag/*', ragLimit)

const errorCaptureLimit = rateLimitMiddleware({
  maxRequests: 50,
  windowMs: 60_000,
  keyPrefix: 'error-capture',
})
app.use('/api/errors', errorCaptureLimit)
app.use('/api/v1/errors', errorCaptureLimit)

const logIngestLimit = rateLimitMiddleware({
  maxRequests: 200,
  windowMs: 60_000,
  keyPrefix: 'log-ingest',
})
app.use('/api/logs', logIngestLimit)
app.use('/api/v1/logs', logIngestLimit)

// API keys manage long-lived credentials — tight limits to slow enumeration/abuse
const apiKeysLimit = rateLimitMiddleware({
  maxRequests: 20,
  windowMs: 60_000,
  keyPrefix: 'api-keys',
})
app.use('/api/api-keys/*', apiKeysLimit)
app.use('/api/v1/api-keys/*', apiKeysLimit)

// Billing endpoints create Stripe objects — tighter limits to prevent abuse
const billingCheckoutLimit = rateLimitMiddleware({
  maxRequests: 10,
  windowMs: 15 * 60_000,
  keyPrefix: 'billing-checkout',
})
app.use('/api/billing/checkout', billingCheckoutLimit)
app.use('/api/v1/billing/checkout', billingCheckoutLimit)

const billingUpgradeLimit = rateLimitMiddleware({
  maxRequests: 5,
  windowMs: 15 * 60_000,
  keyPrefix: 'billing-upgrade',
})
app.use('/api/billing/upgrade', billingUpgradeLimit)
app.use('/api/v1/billing/upgrade', billingUpgradeLimit)

const billingDowngradeLimit = rateLimitMiddleware({
  maxRequests: 5,
  windowMs: 15 * 60_000,
  keyPrefix: 'billing-downgrade',
})
app.use('/api/billing/downgrade', billingDowngradeLimit)
app.use('/api/v1/billing/downgrade', billingDowngradeLimit)

// Populate session if present (non-blocking — sets user context for all API routes)
const optionalAuth = authMiddleware({ required: false })
app.use('/api/*', optionalAuth)
app.use('/api/v1/*', optionalAuth)
// Multi-tenant context (optional by default — routes that require it use requireTenant())
const optionalTenant = tenantMiddleware({ required: false })
app.use('/api/*', optionalTenant)
app.use('/api/v1/*', optionalTenant)

// License status enforcement — catches revoked/expired licenses (5-minute DB cache)
const licenseStatusCheck = checkLicenseStatus(async (customerId) => {
  const db = getClient()
  const [license] = await db
    .select({ status: licenses.status })
    .from(licenses)
    .where(eq(licenses.customerId, customerId))
    .orderBy(desc(licenses.createdAt))
    .limit(1)
  return license?.status ?? null
})
app.use('/api/*', licenseStatusCheck)
app.use('/api/v1/*', licenseStatusCheck)

// License enforcement — gate premium routes by feature
app.use('/api/agent-tasks/*', requireFeature('ai'))
app.use('/api/v1/agent-tasks/*', requireFeature('ai'))
app.use('/api/agent-stream', requireFeature('ai'))
app.use('/api/v1/agent-stream', requireFeature('ai'))
app.use('/api/rag/*', requireFeature('ai'))
app.use('/api/v1/rag/*', requireFeature('ai'))
app.use('/api/collab/agent/*', requireFeature('ai'))
app.use('/api/v1/collab/agent/*', requireFeature('ai'))
app.use('/api/provenance/*', requireFeature('dashboard'))
app.use('/api/v1/provenance/*', requireFeature('dashboard'))

// Role-based access — admin-only operations
// RAG index writes and deletes are administrative operations (rebuilding/managing the vector index).
// Any authenticated user can read RAG query results, but only admins can modify index contents.
app.use('/api/rag/*/index/*', requireRole('admin'))
app.use('/api/v1/rag/*/index/*', requireRole('admin'))
app.delete('/api/rag/*', requireRole('admin'))
app.delete('/api/v1/rag/*', requireRole('admin'))

// Write-protect mutation endpoints — these require authentication
const writeProtected = authMiddleware({ required: true })
app.get('/api/collab/snapshot/*', writeProtected)
app.get('/api/v1/collab/snapshot/*', writeProtected)
app.post('/api/collab/*', writeProtected)
app.post('/api/v1/collab/*', writeProtected)
app.post('/api/collab/agent/*', writeProtected)
app.post('/api/v1/collab/agent/*', writeProtected)
// Ticket routes: all methods require auth — boards/tickets are private workspace data
app.get('/api/tickets/*', writeProtected)
app.get('/api/v1/tickets/*', writeProtected)
app.post('/api/tickets/*', writeProtected)
app.post('/api/v1/tickets/*', writeProtected)
app.patch('/api/tickets/*', writeProtected)
app.patch('/api/v1/tickets/*', writeProtected)
app.delete('/api/tickets/*', writeProtected)
app.delete('/api/v1/tickets/*', writeProtected)
app.post('/api/agent-tasks/*', writeProtected)
app.post('/api/v1/agent-tasks/*', writeProtected)
app.post('/api/agent-stream', writeProtected)
app.post('/api/v1/agent-stream', writeProtected)
app.post('/api/rag/*', writeProtected)
app.post('/api/v1/rag/*', writeProtected)
app.delete('/api/rag/*', writeProtected)
app.delete('/api/v1/rag/*', writeProtected)
app.post('/api/provenance/*', writeProtected)
app.post('/api/v1/provenance/*', writeProtected)
app.patch('/api/provenance/*', writeProtected)
app.patch('/api/v1/provenance/*', writeProtected)
app.delete('/api/provenance/*', writeProtected)
app.delete('/api/v1/provenance/*', writeProtected)
app.post('/api/billing/*', writeProtected)
app.post('/api/v1/billing/*', writeProtected)
app.post('/api/content/*', writeProtected)
app.post('/api/v1/content/*', writeProtected)
app.patch('/api/content/*', writeProtected)
app.patch('/api/v1/content/*', writeProtected)
app.delete('/api/content/*', writeProtected)
app.delete('/api/v1/content/*', writeProtected)

// Resource limits — enforce tier-based caps on site creation
const siteLimit = enforceSiteLimit(() => sites)
app.post('/api/content/sites', siteLimit)
app.post('/api/v1/content/sites', siteLimit)

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
      url: process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:3004',
      description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development server',
    },
  ],
})

// Swagger UI
app.get('/docs', swaggerUI({ url: '/openapi.json' }))

// Routes
app.route('/.well-known', wellKnownRoutes)
app.route('/a2a', a2aRoutes)
app.route('/health', healthRoute)
app.route('/api/errors', errorsRoute)
app.route('/api/logs', logsRoute)
app.route('/api/license', licenseRoute)
app.route('/api/billing', billingRoute)
app.route('/api/webhooks', webhooksRoute)
app.route('/api/provenance', provenanceRoute)
app.route('/api/tickets', ticketsRoute)
app.route('/api/agent-tasks', agentTasksRoute)
app.route('/api/agent-stream', agentStreamRoute)
app.route('/api/content', contentRoute)
app.route('/api/rag', ragIndexRoute)
app.route('/api/api-keys', apiKeysRoute)
app.route('', createCollabRoute())
app.route('', createAgentCollabRoute())

// Versioned routes (/api/v1/*) — mirrors of /api/* for forward compatibility.
// Non-API routes (/.well-known, /a2a, /health) are not versioned.
app.route('/api/v1/errors', errorsRoute)
app.route('/api/v1/logs', logsRoute)
app.route('/api/v1/license', licenseRoute)
app.route('/api/v1/billing', billingRoute)
app.route('/api/v1/webhooks', webhooksRoute)
app.route('/api/v1/provenance', provenanceRoute)
app.route('/api/v1/tickets', ticketsRoute)
app.route('/api/v1/agent-tasks', agentTasksRoute)
app.route('/api/v1/agent-stream', agentStreamRoute)
app.route('/api/v1/content', contentRoute)
app.route('/api/v1/rag', ragIndexRoute)
app.route('/api/v1/api-keys', apiKeysRoute)

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
    const prodRequired = [
      'REVEALUI_SECRET',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'REVEALUI_LICENSE_PRIVATE_KEY',
      'CORS_ORIGIN',
    ]
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
  serve({ fetch: app.fetch, port })
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
