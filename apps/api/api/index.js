// Vercel serverless function entry point
// Uses @hono/node-server/vercel adapter to convert Hono app to Node.js handler
import { handle } from '@hono/node-server/vercel'
import app from '../dist/index.js'

export default handle(app)
