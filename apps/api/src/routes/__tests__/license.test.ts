import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @revealui/core/features and @revealui/core/license
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/features', () => ({
  getFeaturesForTier: vi.fn((tier: string) => ({
    ai: tier !== 'free',
    collaboration: tier !== 'free',
    analytics: tier === 'enterprise',
  })),
}))

vi.mock('@revealui/core/license', () => ({
  validateLicenseKey: vi.fn(),
  generateLicenseKey: vi.fn(),
}))

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { generateLicenseKey, validateLicenseKey } from '@revealui/core/license'
import licenseApp from '../license.js'

const mockedValidate = vi.mocked(validateLicenseKey)
const mockedGenerate = vi.mocked(generateLicenseKey)

function createApp() {
  const app = new Hono()
  app.route('/', licenseApp)
  return app
}

// biome-ignore lint/suspicious/noExplicitAny: test helper — response shape varies per endpoint
async function parseBody(res: Response): Promise<any> {
  return res.json()
}

function post(_path: string, body: unknown, headers: Record<string, string> = {}) {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  }
}

// ---------------------------------------------------------------------------

describe('POST /verify', () => {
  it('returns valid:true for a good key', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key'
    mockedValidate.mockResolvedValue({
      tier: 'pro',
      customerId: 'cus_123',
      maxSites: 5,
      maxUsers: 25,
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as never)

    const app = createApp()
    const res = await app.request('/verify', post('/verify', { licenseKey: 'tok.en.value' }))
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.valid).toBe(true)
    expect(body.tier).toBe('pro')
    expect(body.customerId).toBe('cus_123')
  })

  it('returns valid:false for an invalid key', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key'
    mockedValidate.mockResolvedValue(null as never)

    const app = createApp()
    const res = await app.request('/verify', post('/verify', { licenseKey: 'bad.key' }))
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.valid).toBe(false)
    expect(body.tier).toBe('free')
  })

  it('returns free tier when public key is not configured', async () => {
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY

    const app = createApp()
    const res = await app.request('/verify', post('/verify', { licenseKey: 'any.key' }))
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(body.valid).toBe(false)
    expect(body.tier).toBe('free')

    // Restore
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key'
  })

  it('returns 400 for missing licenseKey', async () => {
    const app = createApp()
    const res = await app.request('/verify', post('/verify', {}))
    expect(res.status).toBe(400)
  })

  it('includes features object in response', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key'
    mockedValidate.mockResolvedValue({
      tier: 'enterprise',
      customerId: 'cus_ent',
      exp: Math.floor(Date.now() / 1000) + 86400,
    } as never)

    const app = createApp()
    const res = await app.request('/verify', post('/verify', { licenseKey: 'tok' }))
    const body = await parseBody(res)
    expect(typeof body.features).toBe('object')
  })

  it('returns null expiresAt when exp is missing', async () => {
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = 'pub-key'
    mockedValidate.mockResolvedValue({ tier: 'pro', customerId: 'cus_123' } as never)

    const app = createApp()
    const res = await app.request('/verify', post('/verify', { licenseKey: 'tok' }))
    const body = await parseBody(res)
    expect(body.expiresAt).toBeNull()
  })
})

describe('POST /generate', () => {
  const ADMIN_KEY = 'secret-admin'

  it('generates a license key with valid admin key', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'priv-key'
    mockedGenerate.mockResolvedValue('generated.license.token')

    const app = createApp()
    const res = await app.request(
      '/generate',
      post('/generate', { tier: 'pro', customerId: 'cus_abc' }, { 'X-Admin-API-Key': ADMIN_KEY }),
    )
    expect(res.status).toBe(201)
    const body = await parseBody(res)
    expect(body.licenseKey).toBe('generated.license.token')
    expect(body.tier).toBe('pro')
  })

  it('returns 401 when admin key is missing', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY
    const app = createApp()
    const res = await app.request('/generate', post('/generate', { tier: 'pro', customerId: 'c' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when admin key is wrong', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY
    const app = createApp()
    const res = await app.request(
      '/generate',
      post('/generate', { tier: 'pro', customerId: 'c' }, { 'X-Admin-API-Key': 'wrong' }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 500 when private key is not configured', async () => {
    process.env.REVEALUI_ADMIN_API_KEY = ADMIN_KEY
    delete process.env.REVEALUI_LICENSE_PRIVATE_KEY

    const app = createApp()
    const res = await app.request(
      '/generate',
      post('/generate', { tier: 'pro', customerId: 'cus' }, { 'X-Admin-API-Key': ADMIN_KEY }),
    )
    expect(res.status).toBe(500)

    process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'priv-key'
  })
})

describe('GET /features', () => {
  it('returns features for all three tiers', async () => {
    const app = createApp()
    const res = await app.request('/features')
    expect(res.status).toBe(200)
    const body = await parseBody(res)
    expect(typeof body.free).toBe('object')
    expect(typeof body.pro).toBe('object')
    expect(typeof body.enterprise).toBe('object')
  })
})
