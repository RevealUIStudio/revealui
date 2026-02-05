import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { logger } from '@revealui/core/observability/logger'
import { dbMiddleware } from './middleware/db.js'
import { errorHandler } from './middleware/error.js'
import healthRoute from './routes/health.js'
import todosRoute from './routes/todos.js'

const app = new Hono()

// Global middleware
app.use('*', honoLogger())
app.use(
  '*',
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.CORS_ORIGIN?.split(',') || []
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
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
