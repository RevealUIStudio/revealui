import { describe, expect, it } from 'vitest'
import {
  CORSManager,
  CORSPresets,
  SecurityHeaders,
  SecurityPresets,
} from '../../security/headers.js'

describe('SecurityPresets.strict()', () => {
  it('produces a CSP header', () => {
    const headers = new SecurityHeaders(SecurityPresets.strict()).getHeaders()
    expect(headers['Content-Security-Policy']).toBeTruthy()
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'")
  })

  it('produces HSTS header', () => {
    const headers = new SecurityHeaders(SecurityPresets.strict()).getHeaders()
    expect(headers['Strict-Transport-Security']).toBeTruthy()
    expect(headers['Strict-Transport-Security']).toContain('max-age=')
  })

  it('sets X-Frame-Options to DENY', () => {
    const headers = new SecurityHeaders(SecurityPresets.strict()).getHeaders()
    expect(headers['X-Frame-Options']).toBe('DENY')
  })

  it('sets X-Content-Type-Options to nosniff', () => {
    const headers = new SecurityHeaders(SecurityPresets.strict()).getHeaders()
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
  })
})

describe('SecurityPresets.moderate()', () => {
  it('produces a valid HSTS header', () => {
    const headers = new SecurityHeaders(SecurityPresets.moderate()).getHeaders()
    expect(headers['Strict-Transport-Security']).toContain('max-age=31536000')
  })

  it('sets X-Frame-Options to SAMEORIGIN', () => {
    const headers = new SecurityHeaders(SecurityPresets.moderate()).getHeaders()
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN')
  })
})

describe('SecurityPresets.development()', () => {
  it('does NOT include HSTS (not safe in dev)', () => {
    const headers = new SecurityHeaders(SecurityPresets.development()).getHeaders()
    expect(headers['Strict-Transport-Security']).toBeUndefined()
  })

  it('sets X-Content-Type-Options', () => {
    const headers = new SecurityHeaders(SecurityPresets.development()).getHeaders()
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
  })
})

describe('SecurityHeaders.getHeaders()', () => {
  it('returns only configured headers (no empty strings)', () => {
    const sh = new SecurityHeaders({ xFrameOptions: 'DENY' })
    const headers = sh.getHeaders()
    for (const value of Object.values(headers)) {
      expect(value).toBeTruthy()
    }
  })

  it('builds CSP from object config', () => {
    const sh = new SecurityHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.example.com'],
      },
    })
    const headers = sh.getHeaders()
    expect(headers['Content-Security-Policy']).toContain('https://cdn.example.com')
  })

  it('passes through CSP string directly', () => {
    const raw = "default-src 'none'"
    const sh = new SecurityHeaders({ contentSecurityPolicy: raw })
    expect(sh.getHeaders()['Content-Security-Policy']).toBe(raw)
  })
})

describe('CORSManager', () => {
  it('allows whitelisted origin', () => {
    const cors = new CORSManager(CORSPresets.moderate(['https://app.example.com']))
    expect(cors.isOriginAllowed('https://app.example.com')).toBe(true)
  })

  it('rejects unlisted origin', () => {
    const cors = new CORSManager(CORSPresets.moderate(['https://app.example.com']))
    expect(cors.isOriginAllowed('https://evil.example.com')).toBe(false)
  })

  it('preflight response includes Access-Control-Allow-Methods', () => {
    const cors = new CORSManager(CORSPresets.moderate(['https://app.example.com']))
    const headers = cors.getPreflightHeaders('https://app.example.com')
    expect(headers['Access-Control-Allow-Methods']).toBeTruthy()
    expect(headers['Access-Control-Allow-Methods']).toContain('GET')
  })

  it('wildcard CORSPresets.api() allows any origin', () => {
    const cors = new CORSManager(CORSPresets.api())
    expect(cors.isOriginAllowed('https://any-domain.com')).toBe(true)
  })
})
