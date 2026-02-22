import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/license', () => ({
  getMaxSites: vi.fn(() => 5),
  getMaxUsers: vi.fn(() => 25),
}))

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('drizzle-orm', () => ({
  count: vi.fn(() => 'count_fn'),
  eq: vi.fn(() => 'eq_fn'),
}))

import { getMaxSites, getMaxUsers } from '@revealui/core/license'
import { errorHandler } from '../error.js'
import { enforceSiteLimit, enforceUserLimit } from '../resource-limits.js'

const mockedGetMaxSites = vi.mocked(getMaxSites)
const mockedGetMaxUsers = vi.mocked(getMaxUsers)

// biome-ignore lint/suspicious/noExplicitAny: test helper — response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json()
}

function createMockDb(countResult: number) {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ count: countResult }]),
  }
  return mockDb
}

const fakeSitesTable = { ownerId: { name: 'owner_id' } }
const fakeUsersTable = { status: { name: 'status' } }

// biome-ignore lint/suspicious/noExplicitAny: test helper — Hono Variables type requires loose typing in tests
type TestVariables = { db: any; user: any }

function createSiteLimitApp(db: unknown) {
  const app = new Hono<{ Variables: TestVariables }>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    c.set('user', { id: 'user-1' })
    await next()
  })
  // biome-ignore lint/suspicious/noExplicitAny: test helper — middleware type is flexible
  app.use('*', enforceSiteLimit(() => fakeSitesTable) as any)
  app.post('/sites', (c) => c.json({ created: true }, 201))
  app.onError(errorHandler)
  return app
}

function createUserLimitApp(db: unknown) {
  const app = new Hono<{ Variables: TestVariables }>()
  app.use('*', async (c, next) => {
    c.set('db', db)
    await next()
  })
  // biome-ignore lint/suspicious/noExplicitAny: test helper — middleware type is flexible
  app.use('*', enforceUserLimit(() => fakeUsersTable) as any)
  app.post('/users', (c) => c.json({ created: true }, 201))
  app.onError(errorHandler)
  return app
}

// ---------------------------------------------------------------------------
// enforceSiteLimit
// ---------------------------------------------------------------------------
describe('enforceSiteLimit', () => {
  it('passes when under the site limit', async () => {
    mockedGetMaxSites.mockReturnValue(5)
    const db = createMockDb(3)

    const app = createSiteLimitApp(db)
    const res = await app.request('/sites', { method: 'POST' })

    expect(res.status).toBe(201)
  })

  it('returns 403 when at the site limit', async () => {
    mockedGetMaxSites.mockReturnValue(5)
    const db = createMockDb(5)

    const app = createSiteLimitApp(db)
    const res = await app.request('/sites', { method: 'POST' })

    expect(res.status).toBe(403)
    const body = await parseBody(res)
    expect(body.error).toContain('Site limit reached')
    expect(body.error).toContain('5/5')
  })

  it('skips limit check for enterprise (Infinity)', async () => {
    mockedGetMaxSites.mockReturnValue(Number.POSITIVE_INFINITY)
    const db = createMockDb(1000)

    const app = createSiteLimitApp(db)
    const res = await app.request('/sites', { method: 'POST' })

    expect(res.status).toBe(201)
    // DB should not be queried when limit is Infinity
    expect(db.select).not.toHaveBeenCalled()
  })

  it('returns 401 when user is not authenticated', async () => {
    const app = new Hono<{ Variables: TestVariables }>()
    app.use('*', async (c, next) => {
      c.set('db', createMockDb(0))
      // No user set
      await next()
    })
    app.use(
      '*',
      enforceSiteLimit(() => fakeSitesTable),
    )
    app.post('/sites', (c) => c.json({ created: true }, 201))
    app.onError(errorHandler)

    const res = await app.request('/sites', { method: 'POST' })
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// enforceUserLimit
// ---------------------------------------------------------------------------
describe('enforceUserLimit', () => {
  it('passes when under the user limit', async () => {
    mockedGetMaxUsers.mockReturnValue(25)
    const db = createMockDb(10)

    const app = createUserLimitApp(db)
    const res = await app.request('/users', { method: 'POST' })

    expect(res.status).toBe(201)
  })

  it('returns 403 when at the user limit', async () => {
    mockedGetMaxUsers.mockReturnValue(25)
    const db = createMockDb(25)

    const app = createUserLimitApp(db)
    const res = await app.request('/users', { method: 'POST' })

    expect(res.status).toBe(403)
    const body = await parseBody(res)
    expect(body.error).toContain('User limit reached')
    expect(body.error).toContain('25/25')
  })

  it('skips limit check for enterprise (Infinity)', async () => {
    mockedGetMaxUsers.mockReturnValue(Number.POSITIVE_INFINITY)
    const db = createMockDb(5000)

    const app = createUserLimitApp(db)
    const res = await app.request('/users', { method: 'POST' })

    expect(res.status).toBe(201)
    expect(db.select).not.toHaveBeenCalled()
  })
})
