import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @revealui/core modules
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/license', () => ({
  isLicensed: vi.fn(),
  getCurrentTier: vi.fn(() => 'free'),
}))

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(),
  getRequiredTier: vi.fn(() => 'pro'),
}))

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { isFeatureEnabled } from '@revealui/core/features'
import { getCurrentTier, isLicensed } from '@revealui/core/license'
import { errorHandler } from '../error.js'
import { requireFeature, requireLicense } from '../license.js'

const mockedIsLicensed = vi.mocked(isLicensed)
const mockedGetCurrentTier = vi.mocked(getCurrentTier)
const mockedIsFeatureEnabled = vi.mocked(isFeatureEnabled)

// biome-ignore lint/suspicious/noExplicitAny: test helper — response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json()
}

function createApp(middleware: Parameters<InstanceType<typeof Hono>['use']>[1]) {
  const app = new Hono()
  // biome-ignore lint/suspicious/noExplicitAny: test helper — middleware type is flexible
  app.use('/protected/*', middleware as any)
  app.get('/protected/resource', (c) => c.json({ ok: true }))
  app.onError(errorHandler)
  return app
}

// ---------------------------------------------------------------------------
// requireLicense
// ---------------------------------------------------------------------------
describe('requireLicense', () => {
  it('returns 403 when tier is insufficient', async () => {
    mockedIsLicensed.mockReturnValue(false)
    mockedGetCurrentTier.mockReturnValue('free')

    const app = createApp(requireLicense('pro'))
    const res = await app.request('/protected/resource')

    expect(res.status).toBe(403)
    const body = await parseBody(res)
    expect(body.error).toContain('pro')
    expect(body.error).toContain('free')
    expect(body.error).toContain('revealui.com/pricing')
  })

  it('passes when tier is sufficient', async () => {
    mockedIsLicensed.mockReturnValue(true)

    const app = createApp(requireLicense('pro'))
    const res = await app.request('/protected/resource')

    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.ok).toBe(true)
  })

  it('enterprise license passes pro check', async () => {
    mockedIsLicensed.mockReturnValue(true)
    mockedGetCurrentTier.mockReturnValue('enterprise')

    const app = createApp(requireLicense('pro'))
    const res = await app.request('/protected/resource')

    expect(res.status).toBe(200)
  })

  it('returns 403 for enterprise requirement with pro tier', async () => {
    mockedIsLicensed.mockReturnValue(false)
    mockedGetCurrentTier.mockReturnValue('pro')

    const app = createApp(requireLicense('enterprise'))
    const res = await app.request('/protected/resource')

    expect(res.status).toBe(403)
    const body = await parseBody(res)
    expect(body.error).toContain('enterprise')
    expect(body.error).toContain('pro')
  })

  it('allows free tier when free is required', async () => {
    mockedIsLicensed.mockReturnValue(true)
    mockedGetCurrentTier.mockReturnValue('free')

    const app = createApp(requireLicense('free'))
    const res = await app.request('/protected/resource')

    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// requireFeature
// ---------------------------------------------------------------------------
describe('requireFeature', () => {
  it('returns 403 when feature is disabled', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false)
    mockedGetCurrentTier.mockReturnValue('free')

    const app = createApp(requireFeature('ai'))
    const res = await app.request('/protected/resource')

    expect(res.status).toBe(403)
    const body = await parseBody(res)
    expect(body.error).toContain('ai')
    expect(body.error).toContain('revealui.com/pricing')
  })

  it('passes when feature is enabled', async () => {
    mockedIsFeatureEnabled.mockReturnValue(true)

    const app = createApp(requireFeature('ai'))
    const res = await app.request('/protected/resource')

    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.ok).toBe(true)
  })

  it('includes required tier in error message', async () => {
    mockedIsFeatureEnabled.mockReturnValue(false)
    mockedGetCurrentTier.mockReturnValue('free')

    const app = createApp(requireFeature('multiTenant'))
    const res = await app.request('/protected/resource')

    expect(res.status).toBe(403)
    const body = await parseBody(res)
    expect(body.error).toContain('multiTenant')
  })
})
