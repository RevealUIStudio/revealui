import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { logger } from '@revealui/core/observability/logger'
import { SecurityHeaders, SecurityPresets } from '@revealui/core/security'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { dbMiddleware } from './middleware/db.js'
import { errorHandler } from './middleware/error.js'
import { tenantMiddleware } from './middleware/tenant.js'
import { createAgentCollabRoute } from './routes/agent-collab.js'
import provenanceRoute from './routes/code-provenance.js'
import { createCollabRoute } from './routes/collab.js'
import healthRoute from './routes/health.js'
import licenseRoute from './routes/license.js'
import ticketsRoute from './routes/tickets.js'

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

  // Critical: CORS must be configured in production to prevent blocking all requests
  if (isProduction && corsOrigins.length === 0) {
    logger.error('CORS_ORIGIN not configured in production environment', undefined, {
      corsOrigins,
      nodeEnv: process.env.NODE_ENV,
      corsOriginValue: process.env.CORS_ORIGIN,
    })
    throw new Error(
      'PRODUCTION BLOCKER: CORS_ORIGIN environment variable must be set in production. ' +
        'Without this, all cross-origin requests will be blocked. ' +
        'Set it to a comma-separated list of allowed origins. ' +
        'Example: CORS_ORIGIN="https://app.example.com,https://www.example.com"',
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
    c.res.headers.set(key, value)
  }
})
app.use('*', dbMiddleware())

// Multi-tenant context (optional by default — routes that require it use requireTenant())
app.use('/api/*', tenantMiddleware({ required: false }))

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
app.route('/api/provenance', provenanceRoute)
app.route('/api/tickets', ticketsRoute)
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
}
