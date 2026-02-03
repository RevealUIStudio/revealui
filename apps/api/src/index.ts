import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { dbMiddleware } from './middleware/db.js'
import { errorHandler } from './middleware/error.js'
import healthRoute from './routes/health.js'

const app = new Hono()

// Global middleware
app.use('*', logger())
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

// Error handling
app.onError(errorHandler)

// For Vercel serverless
export default app

// For local development
if (process.env.NODE_ENV !== 'production') {
  const port = Number(process.env.PORT) || 3004
  serve({ fetch: app.fetch, port })
  console.log(`🚀 API server running on http://localhost:${port}`)
}
