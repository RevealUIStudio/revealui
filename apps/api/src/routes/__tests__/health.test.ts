import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @revealui/db so no real DB is needed
// ---------------------------------------------------------------------------
vi.mock('@revealui/db', () => ({
  getClient: vi.fn(),
}))

import { getClient } from '@revealui/db'
import healthApp from '../health.js'

const mockedGetClient = vi.mocked(getClient)

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

function createApp() {
  const app = new Hono()
  app.route('/', healthApp)
  return app
}

// biome-ignore lint/suspicious/noExplicitAny: test helper — response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json()
}

// ---------------------------------------------------------------------------

describe('GET / — liveness probe', () => {
  it('returns 200 with status:ok', async () => {
    const app = createApp()
    const res = await app.request('/')
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.status).toBe('ok')
  })

  it('includes a timestamp ISO string', async () => {
    const app = createApp()
    const res = await app.request('/')
    const body = await parseBody(res)
    expect(typeof body.timestamp).toBe('string')
    expect(() => new Date(body.timestamp)).not.toThrow()
  })

  it('includes a version field', async () => {
    const app = createApp()
    const res = await app.request('/')
    const body = await parseBody(res)
    expect(typeof body.version).toBe('string')
  })

  it('includes the service name', async () => {
    const app = createApp()
    const res = await app.request('/')
    const body = await parseBody(res)
    expect(body.service).toBe('RevealUI API')
  })
})

describe('GET /ready — readiness probe', () => {
  beforeEach(() => {
    // Provide required env vars
    process.env.POSTGRES_URL = 'postgres://localhost/test'
    process.env.NODE_ENV = 'test'
  })

  it('returns 200 when DB is available', async () => {
    const mockDb = { execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]) }
    mockedGetClient.mockReturnValue(mockDb as never)

    const app = createApp()
    const res = await app.request('/ready')
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.status).toBe('ready')
  })

  it('returns 503 when DB fails', async () => {
    const mockDb = { execute: vi.fn().mockRejectedValue(new Error('connection refused')) }
    mockedGetClient.mockReturnValue(mockDb as never)

    const app = createApp()
    const res = await app.request('/ready')
    expect(res.status).toBe(503)
    const body = await parseBody(res)
    expect(body.status).toBe('not_ready')
  })

  it('includes a checks array', async () => {
    const mockDb = { execute: vi.fn().mockResolvedValue([]) }
    mockedGetClient.mockReturnValue(mockDb as never)

    const app = createApp()
    const res = await app.request('/ready')
    const body = await parseBody(res)
    expect(Array.isArray(body.checks)).toBe(true)
  })

  it('returns 503 when required env vars are missing', async () => {
    delete process.env.POSTGRES_URL
    const mockDb = { execute: vi.fn().mockResolvedValue([]) }
    mockedGetClient.mockReturnValue(mockDb as never)

    const app = createApp()
    const res = await app.request('/ready')
    expect(res.status).toBe(503)
    const body = await parseBody(res)
    expect(body.status).toBe('not_ready')

    // Restore
    process.env.POSTGRES_URL = 'postgres://localhost/test'
  })

  it('includes a timestamp in the readiness response', async () => {
    const mockDb = { execute: vi.fn().mockResolvedValue([]) }
    mockedGetClient.mockReturnValue(mockDb as never)

    const app = createApp()
    const res = await app.request('/ready')
    const body = await parseBody(res)
    expect(typeof body.timestamp).toBe('string')
  })
})
