import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @revealui/ai — all dynamic imports return null by default
// ---------------------------------------------------------------------------
vi.mock('@revealui/ai', () => null)
vi.mock('@revealui/ai/llm/client', () => null)
vi.mock('@revealui/ai/orchestration/streaming-runtime', () => null)

import agentStream from '../agent-stream.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = new Hono()
  app.route('/agent-stream', agentStream)
  return app
}

function jsonPost(app: Hono, path: string, body: unknown, headers?: Record<string, string>) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
async function parseBody(res: Response): Promise<any> {
  return res.json()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('agent-stream route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when instruction is missing', async () => {
    const app = createApp()

    const res = await jsonPost(app, '/agent-stream', {})

    expect(res.status).toBe(400)
    const body = await parseBody(res)
    expect(body.error).toContain('instruction is required')
  })

  it('returns 400 when body is empty', async () => {
    const app = createApp()

    const res = await jsonPost(app, '/agent-stream', null)

    expect(res.status).toBe(400)
  })

  it('returns 503 when AI package is not available', async () => {
    const app = createApp()

    const res = await jsonPost(app, '/agent-stream', {
      instruction: 'Hello',
    })

    expect(res.status).toBe(503)
    const body = await parseBody(res)
    expect(body.error).toContain('AI package not available')
  })

  it('returns 400 with empty instruction string', async () => {
    const app = createApp()

    const res = await jsonPost(app, '/agent-stream', {
      instruction: '',
    })

    expect(res.status).toBe(400)
  })
})
