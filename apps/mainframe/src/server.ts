import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { logger } from '@revealui/core/observability/logger'
import { Hono } from 'hono'
import app from './app.js'

// In dev, serve static assets from disk. In production, Vercel CDN handles this.
const devApp = new Hono()
devApp.use('/assets/*', serveStatic({ root: './public' }))
devApp.use('/src/*', serveStatic({ root: '.' }))
devApp.route('/', app)

const port = Number(process.env.MAINFRAME_PORT || process.env.PORT) || 3001

serve({ fetch: devApp.fetch, port })

logger.info(`RevealUI server running on http://localhost:${port}`)
