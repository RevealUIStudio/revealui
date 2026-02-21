/**
 * Security Tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { AuditSystem, InMemoryAuditStorage } from '../audit'
import { AuthSystem } from '../auth'
import { AuthorizationSystem, PolicyBuilder } from '../authorization'
import { DataMasking, EncryptionSystem, TokenGenerator } from '../encryption'
import { ConsentManager, DataAnonymization, DataExportSystem } from '../gdpr'
import { CORSManager, SecurityHeaders, SecurityPresets } from '../headers'

describe('Authentication', () => {
  let auth: AuthSystem

  beforeEach(() => {
    auth = new AuthSystem({
      jwtSecret: 'test-secret',
      accessTokenExpiry: 3600,
    })
  })

  it('should create JWT token', () => {
    const user = {
      id: '123',
      email: 'test@example.com',
      username: 'test',
      roles: ['user'],
      permissions: ['read'],
    }

    const token = auth.createToken(user)

    expect(token.accessToken).toBeDefined()
    expect(token.refreshToken).toBeDefined()
    expect(token.tokenType).toBe('Bearer')
  })

  it('should verify JWT token', () => {
    const user = {
      id: '123',
      email: 'test@example.com',
      roles: ['user'],
      permissions: ['read'],
    }

    const token = auth.createToken(user)
    const payload = auth.verifyToken(token.accessToken)

    expect(payload.sub).toBe('123')
    expect(payload.email).toBe('test@example.com')
  })

  it('should create and manage sessions', () => {
    const user = {
      id: '123',
      email: 'test@example.com',
      roles: ['user'],
      permissions: ['read'],
    }

    const token = auth.createToken(user)
    const session = auth.createSession(user, token)

    expect(session.user.id).toBe('123')
    expect(session.token).toEqual(token)

    const retrieved = auth.getSession('123')
    expect(retrieved).toBeDefined()
    expect(retrieved?.user.id).toBe('123')
  })

  it('should destroy session', () => {
    const user = {
      id: '123',
      email: 'test@example.com',
      roles: ['user'],
      permissions: ['read'],
    }

    const token = auth.createToken(user)
    auth.createSession(user, token)

    auth.destroySession('123')

    const retrieved = auth.getSession('123')
    expect(retrieved).toBeUndefined()
  })
})

describe('Authorization', () => {
  let authorization: AuthorizationSystem

  beforeEach(() => {
    authorization = new AuthorizationSystem()

    // Register test role
    authorization.registerRole({
      id: 'admin',
      name: 'Administrator',
      permissions: [{ resource: '*', action: '*' }],
    })

    authorization.registerRole({
      id: 'user',
      name: 'User',
      permissions: [
        { resource: 'posts', action: 'read' },
        { resource: 'posts', action: 'create' },
      ],
    })
  })

  it('should check permissions', () => {
    expect(authorization.hasPermission(['admin'], 'users', 'delete')).toBe(true)
    expect(authorization.hasPermission(['user'], 'posts', 'read')).toBe(true)
    expect(authorization.hasPermission(['user'], 'posts', 'delete')).toBe(false)
  })

  it('should support wildcard permissions', () => {
    expect(authorization.hasPermission(['admin'], 'anything', 'anything')).toBe(true)
  })

  it('should check access with policies', () => {
    const policy = new PolicyBuilder()
      .id('allow-own-posts')
      .name('Allow Own Posts')
      .allow()
      .resources('posts')
      .actions('update', 'delete')
      .condition('resource.owner', 'eq', '123')
      .build()

    authorization.registerPolicy(policy)

    const context = {
      user: { id: '123', roles: [] },
      resource: {
        type: 'posts',
        id: '1',
        owner: '123',
      },
    }

    const result = authorization.checkAccess(context, 'posts', 'update')
    expect(result.allowed).toBe(true)
  })

  it('should deny access when conditions not met', () => {
    const policy = new PolicyBuilder()
      .id('deny-other-posts')
      .name('Deny Other Posts')
      .deny()
      .resources('posts')
      .actions('update')
      .condition('resource.owner', 'ne', '123')
      .build()

    authorization.registerPolicy(policy)

    const context = {
      user: { id: '456', roles: [] },
      resource: {
        type: 'posts',
        id: '1',
        owner: '123',
      },
    }

    const result = authorization.checkAccess(context, 'posts', 'update')
    expect(result.allowed).toBe(false)
  })
})

describe('Encryption', () => {
  let encryption: EncryptionSystem

  beforeEach(() => {
    encryption = new EncryptionSystem()
  })

  it('should encrypt and decrypt data', async () => {
    const key = await encryption.generateKey()
    const plaintext = 'Hello, World!'

    const encrypted = await encryption.encrypt(plaintext, key)
    expect(encrypted.data).toBeDefined()
    expect(encrypted.iv).toBeDefined()

    const decrypted = await encryption.decrypt(encrypted, key)
    expect(decrypted).toBe(plaintext)
  })

  it('should encrypt and decrypt objects', async () => {
    const key = await encryption.generateKey()
    const obj = { name: 'John', age: 30 }

    const encrypted = await encryption.encryptObject(obj, key)
    const decrypted = await encryption.decryptObject(encrypted, key)

    expect(decrypted).toEqual(obj)
  })

  it('should hash data', async () => {
    const hash1 = await encryption.hash('password')
    const hash2 = await encryption.hash('password')

    expect(hash1).toBe(hash2)
  })

  it('should generate random strings', () => {
    const random1 = encryption.randomString(32)
    const random2 = encryption.randomString(32)

    expect(random1).toHaveLength(32)
    expect(random2).toHaveLength(32)
    expect(random1).not.toBe(random2)
  })
})

describe('Data Masking', () => {
  it('should mask email', () => {
    expect(DataMasking.maskEmail('test@example.com')).toBe('t**t@example.com')
    expect(DataMasking.maskEmail('ab@example.com')).toBe('a*@example.com')
  })

  it('should mask phone number', () => {
    const masked = DataMasking.maskPhone('1234567890')
    expect(masked).toContain('7890')
    expect(masked).toContain('*')
  })

  it('should mask credit card', () => {
    expect(DataMasking.maskCreditCard('1234567890123456')).toBe('****-****-****-3456')
  })

  it('should mask SSN', () => {
    expect(DataMasking.maskSSN('123-45-6789')).toBe('***-**-6789')
  })
})

describe('Token Generator', () => {
  it('should generate tokens', () => {
    const token = TokenGenerator.generate(32)
    // 32 bytes → 64 hex chars
    expect(token).toHaveLength(64)
  })

  it('should generate UUIDs', () => {
    const uuid = TokenGenerator.generateUUID()
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('should generate API keys', () => {
    const apiKey = TokenGenerator.generateAPIKey('sk')
    expect(apiKey).toMatch(/^sk_/)
  })
})

describe('Audit Logging', () => {
  let audit: AuditSystem

  beforeEach(() => {
    audit = new AuditSystem(new InMemoryAuditStorage())
  })

  it('should log audit events', async () => {
    await audit.log({
      type: 'auth.login',
      severity: 'low',
      actor: { id: '123', type: 'user' },
      action: 'login',
      result: 'success',
    })

    const events = await audit.query({})
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('auth.login')
  })

  it('should log authentication events', async () => {
    await audit.logAuth('auth.login', '123', 'success')

    const events = await audit.query({ types: ['auth.login'] })
    expect(events).toHaveLength(1)
  })

  it('should log data access events', async () => {
    await audit.logDataAccess('read', '123', 'users', '456', 'success')

    const events = await audit.query({ types: ['data.read'] })
    expect(events).toHaveLength(1)
  })

  it('should query events by actor', async () => {
    await audit.logAuth('auth.login', '123', 'success')
    await audit.logAuth('auth.login', '456', 'success')

    const events = await audit.query({ actorId: '123' })
    expect(events).toHaveLength(1)
    expect(events[0].actor.id).toBe('123')
  })

  it('should filter events by severity', async () => {
    await audit.log({
      type: 'security.violation',
      severity: 'critical',
      actor: { id: '123', type: 'user' },
      action: 'violation',
      result: 'failure',
    })

    await audit.log({
      type: 'auth.login',
      severity: 'low',
      actor: { id: '123', type: 'user' },
      action: 'login',
      result: 'success',
    })

    const critical = await audit.query({ severity: ['critical'] })
    expect(critical).toHaveLength(1)
    expect(critical[0].severity).toBe('critical')
  })
})

describe('GDPR Compliance', () => {
  describe('Consent Manager', () => {
    let consent: ConsentManager

    beforeEach(() => {
      consent = new ConsentManager()
    })

    it('should grant consent', async () => {
      await consent.grantConsent('123', 'analytics', 'explicit')

      expect(consent.hasConsent('123', 'analytics')).toBe(true)
    })

    it('should revoke consent', async () => {
      await consent.grantConsent('123', 'analytics', 'explicit')
      await consent.revokeConsent('123', 'analytics')

      expect(consent.hasConsent('123', 'analytics')).toBe(false)
    })

    it('should handle consent expiration', async () => {
      await consent.grantConsent('123', 'analytics', 'explicit', 100)

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150))

      expect(consent.hasConsent('123', 'analytics')).toBe(false)
    })
  })

  describe('Data Export', () => {
    let exporter: DataExportSystem

    beforeEach(() => {
      exporter = new DataExportSystem()
    })

    it('should export user data', async () => {
      const exported = await exporter.exportUserData('123', async () => ({
        profile: { name: 'John', email: 'john@example.com' },
        activities: [],
        consents: [],
      }))

      expect(exported.userId).toBe('123')
      expect(exported.data.profile.name).toBe('John')
    })

    it('should format as JSON', async () => {
      const exported = await exporter.exportUserData('123', async () => ({
        profile: { name: 'John' },
        activities: [],
        consents: [],
      }))

      const json = exporter.formatAsJSON(exported)
      expect(json).toContain('John')
    })
  })

  describe('Data Anonymization', () => {
    it('should anonymize user data', () => {
      const user = {
        email: 'test@example.com',
        name: 'John Doe',
        phone: '1234567890',
      }

      const anonymized = DataAnonymization.anonymizeUser(user)

      expect(anonymized.email).not.toBe('test@example.com')
      expect(anonymized.name).toBe('Anonymous User')
      expect(anonymized.phone).toBeUndefined()
    })

    it('should check k-anonymity', () => {
      const data = [
        { age: 25, zip: '12345' },
        { age: 25, zip: '12345' },
        { age: 30, zip: '54321' },
      ]

      // Should not satisfy 2-anonymity (third record is unique)
      expect(DataAnonymization.checkKAnonymity(data, ['age', 'zip'], 2)).toBe(false)
    })
  })
})

describe('Security Headers', () => {
  it('should generate security headers', () => {
    const security = new SecurityHeaders(SecurityPresets.strict())
    const headers = security.getHeaders()

    expect(headers['Content-Security-Policy']).toBeDefined()
    expect(headers['Strict-Transport-Security']).toBeDefined()
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
  })

  it('should build CSP header', () => {
    const security = new SecurityHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'"],
      },
    })

    const headers = security.getHeaders()
    const csp = headers['Content-Security-Policy']

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self' 'unsafe-inline'")
  })
})

describe('CORS', () => {
  let cors: CORSManager

  beforeEach(() => {
    cors = new CORSManager({
      origin: ['https://example.com'],
      methods: ['GET', 'POST'],
      credentials: true,
    })
  })

  it('should check if origin is allowed', () => {
    expect(cors.isOriginAllowed('https://example.com')).toBe(true)
    expect(cors.isOriginAllowed('https://other.com')).toBe(false)
  })

  it('should generate CORS headers', () => {
    const headers = cors.getCORSHeaders('https://example.com')

    expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com')
    expect(headers['Access-Control-Allow-Credentials']).toBe('true')
  })

  it('should handle preflight requests', () => {
    const request = new Request('https://api.example.com', {
      method: 'OPTIONS',
      headers: { Origin: 'https://example.com' },
    })

    const response = cors.handlePreflight(request, 'https://example.com')

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET')
  })
})
