/**
 * Log Ingestion Route Tests
 *
 * Covers: POST / (unauthenticated, fire-and-forget, OpenAPIHono)
 * across schema validation, DB write, and failure fallback scenarios.
 *
 * Only warn/error/fatal levels are accepted; info/debug are rejected by the schema.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks — declared before imports so vi.mock hoisting takes effect ─────────

vi.mock('@revealui/db/schema', () => ({
  appLogs: 'appLogs',
}))

const mockInsertValues = vi.fn()
const mockDb = { insert: vi.fn() }

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}))

// ─── Import under test (after mocks) ─────────────────────────────────────────

import logsApp from '../logs.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function post(body: unknown) {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Flush macrotask queue so detached async IIFEs can complete. */
async function flushAsync() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockInsertValues.mockResolvedValue({ rowCount: 1 })
  mockDb.insert.mockReturnValue({ values: mockInsertValues })
  process.env.NODE_ENV = 'test'
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST / — schema validation', () => {
  it('returns 202 with received:true on valid warn payload', async () => {
    const res = await logsApp.request(
      post({ level: 'warn', message: 'Low disk space', app: 'cms' }),
    )
    expect(res.status).toBe(202)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.received).toBe(true)
  })

  it('returns 202 on full valid payload', async () => {
    const res = await logsApp.request(
      post({
        level: 'error',
        message: 'Unhandled rejection',
        app: 'api',
        environment: 'production',
        requestId: 'req-123',
        userId: 'user-456',
        data: { code: 'ECONNRESET' },
      }),
    )
    expect(res.status).toBe(202)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.received).toBe(true)
  })

  it('accepts all three valid levels (warn, error, fatal)', async () => {
    for (const level of ['warn', 'error', 'fatal'] as const) {
      const res = await logsApp.request(post({ level, message: 'test', app: 'cms' }))
      expect(res.status).toBe(202)
    }
  })

  it('returns 400 when level is info (not in schema enum)', async () => {
    const res = await logsApp.request(post({ level: 'info', message: 'Informational', app: 'cms' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when level is debug', async () => {
    const res = await logsApp.request(post({ level: 'debug', message: 'Debug msg', app: 'api' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when message is missing', async () => {
    const res = await logsApp.request(post({ level: 'error', app: 'cms' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when app is missing', async () => {
    const res = await logsApp.request(post({ level: 'warn', message: 'Missing app' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when level is missing', async () => {
    const res = await logsApp.request(post({ message: 'No level', app: 'cms' }))
    expect(res.status).toBe(400)
  })
})

describe('POST / — fire-and-forget DB write', () => {
  it('returns 202 even when DB insert throws', async () => {
    mockInsertValues.mockRejectedValueOnce(new Error('DB timeout'))

    const res = await logsApp.request(
      post({ level: 'error', message: 'DB write will fail', app: 'cms' }),
    )
    expect(res.status).toBe(202)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.received).toBe(true)
  })

  it('inserts with correct fields from payload', async () => {
    await logsApp.request(
      post({
        level: 'fatal',
        message: 'Process crashed',
        app: 'api',
        environment: 'staging',
        requestId: 'req-abc',
        userId: 'u-999',
        data: { code: 1 },
      }),
    )
    await flushAsync()

    expect(mockDb.insert).toHaveBeenCalledWith('appLogs')
    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insertArgs.level).toBe('fatal')
    expect(insertArgs.message).toBe('Process crashed')
    expect(insertArgs.app).toBe('api')
    expect(insertArgs.environment).toBe('staging')
    expect(insertArgs.requestId).toBe('req-abc')
    expect(insertArgs.userId).toBe('u-999')
    expect(insertArgs.data).toEqual({ code: 1 })
  })

  it('defaults environment to process.env.NODE_ENV when not in payload', async () => {
    process.env.NODE_ENV = 'production'

    await logsApp.request(post({ level: 'warn', message: 'No env field', app: 'cms' }))
    await flushAsync()

    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insertArgs.environment).toBe('production')
  })

  it('sets requestId to null when not provided', async () => {
    await logsApp.request(post({ level: 'warn', message: 'No requestId', app: 'cms' }))
    await flushAsync()

    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insertArgs.requestId).toBeNull()
  })

  it('sets userId to null when not provided', async () => {
    await logsApp.request(post({ level: 'error', message: 'No userId', app: 'api' }))
    await flushAsync()

    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insertArgs.userId).toBeNull()
  })

  it('sets data to null when not provided', async () => {
    await logsApp.request(post({ level: 'fatal', message: 'No data', app: 'cms' }))
    await flushAsync()

    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insertArgs.data).toBeNull()
  })
})
