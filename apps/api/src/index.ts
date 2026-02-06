import { serve } from '@hono/node-server'
import { logger } from '@revealui/core/observability/logger'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { dbMiddleware } from './middleware/db.js'
import { errorHandler } from './middleware/error.js'
import healthRoute from './routes/health.js'
import todosRoute from './routes/todos.js'

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
    logger.error('CORS_ORIGIN not configured in production environment', {
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

const app = new Hono()
const corsOrigins = getCorsOrigins()

// Global middleware
app.use('*', honoLogger())
app.use(
  '*',
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
)
app.use('*', dbMiddleware())

// Routes
app.route('/health', healthRoute)
app.route('/api/todos', todosRoute)

// Error handling
app.onError(errorHandler)

// For Vercel serverless
export default app

// For local development
if (process.env.NODE_ENV !== 'production') {
  const port = Number(process.env.PORT) || 3004
  serve({ fetch: app.fetch, port })
  logger.info(`🚀 API server running on http://localhost:${port}`)
}
