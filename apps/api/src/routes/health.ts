import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'RevealUI API',
  })
})

export default app
