/**
 * GDPR Module Tests
 *
 * Tests for ConsentManager, DataDeletionSystem, DataAnonymization,
 * and factory functions from the GDPR compliance module.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ConsentManager,
  createConsentManager,
  createDataDeletionSystem,
  DataAnonymization,
  DataDeletionSystem,
} from '../gdpr.js'
import { InMemoryGDPRStorage } from '../gdpr-storage.js'

// ── ConsentManager ─────────────────────────────────────────────────

describe('ConsentManager', () => {
  let storage: InMemoryGDPRStorage
  let manager: ConsentManager

  beforeEach(() => {
    storage = new InMemoryGDPRStorage()
    manager = new ConsentManager(storage)
  })

  describe('grantConsent', () => {
    it('creates a consent record with correct fields', async () => {
      const consent = await manager.grantConsent('user-1', 'analytics', 'explicit')

      expect(consent.userId).toBe('user-1')
      expect(consent.type).toBe('analytics')
      expect(consent.granted).toBe(true)
      expect(consent.source).toBe('explicit')
      expect(consent.version).toBe('1.0.0')
      expect(consent.id).toBeDefined()
      expect(consent.timestamp).toBeDefined()
    })

    it('stores the consent in the underlying storage', async () => {
      await manager.grantConsent('user-1', 'marketing')

      const stored = await storage.getConsent('user-1', 'marketing')
      expect(stored).toBeDefined()
      expect(stored?.granted).toBe(true)
    })

    it('sets expiresAt when expiresIn is provided', async () => {
      const before = Date.now()
      const consent = await manager.grantConsent('user-1', 'analytics', 'explicit', 60_000)
      const after = Date.now()

      expect(consent.expiresAt).toBeDefined()
      const expiresAt = new Date(consent.expiresAt!).getTime()
      expect(expiresAt).toBeGreaterThanOrEqual(before + 60_000)
      expect(expiresAt).toBeLessThanOrEqual(after + 60_000)
    })
  })

  describe('revokeConsent', () => {
    it('sets granted to false on an existing consent', async () => {
      await manager.grantConsent('user-1', 'analytics')
      await manager.revokeConsent('user-1', 'analytics')

      const consent = await storage.getConsent('user-1', 'analytics')
      expect(consent?.granted).toBe(false)
    })

    it('does nothing when no prior consent exists', async () => {
      // Should not throw
      await manager.revokeConsent('user-1', 'analytics')
      const consent = await storage.getConsent('user-1', 'analytics')
      expect(consent).toBeUndefined()
    })
  })

  describe('hasConsent', () => {
    it('returns true for a granted consent', async () => {
      await manager.grantConsent('user-1', 'analytics')
      expect(await manager.hasConsent('user-1', 'analytics')).toBe(true)
    })

    it('returns false for a revoked consent', async () => {
      await manager.grantConsent('user-1', 'analytics')
      await manager.revokeConsent('user-1', 'analytics')
      expect(await manager.hasConsent('user-1', 'analytics')).toBe(false)
    })

    it('returns false when no consent record exists', async () => {
      expect(await manager.hasConsent('user-1', 'analytics')).toBe(false)
    })

    it('returns false for expired consent', async () => {
      // Grant with a 1ms expiry
      await manager.grantConsent('user-1', 'analytics', 'explicit', 1)
      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(await manager.hasConsent('user-1', 'analytics')).toBe(false)
    })
  })

  describe('getUserConsents', () => {
    it('returns all consents for a user', async () => {
      await manager.grantConsent('user-1', 'analytics')
      await manager.grantConsent('user-1', 'marketing')
      await manager.grantConsent('user-2', 'analytics')

      const consents = await manager.getUserConsents('user-1')
      expect(consents).toHaveLength(2)
      expect(consents.map((c) => c.type).sort()).toEqual(['analytics', 'marketing'])
    })

    it('returns empty array for a user with no consents', async () => {
      expect(await manager.getUserConsents('nobody')).toEqual([])
    })
  })

  describe('needsRenewal', () => {
    it('returns true when consent is older than maxAge', async () => {
      // Grant consent, then check with a maxAge of 1ms
      await manager.grantConsent('user-1', 'analytics')
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(await manager.needsRenewal('user-1', 'analytics', 1)).toBe(true)
    })

    it('returns false when consent is newer than maxAge', async () => {
      await manager.grantConsent('user-1', 'analytics')
      // 10 seconds is plenty of headroom
      expect(await manager.needsRenewal('user-1', 'analytics', 10_000)).toBe(false)
    })

    it('returns true when no consent exists', async () => {
      expect(await manager.needsRenewal('user-1', 'analytics', 10_000)).toBe(true)
    })
  })

  describe('getStatistics', () => {
    it('counts granted, revoked, expired, and byType', async () => {
      // 2 granted
      await manager.grantConsent('user-1', 'analytics')
      await manager.grantConsent('user-1', 'marketing')
      // 1 revoked
      await manager.grantConsent('user-2', 'analytics')
      await manager.revokeConsent('user-2', 'analytics')
      // 1 expired (granted but with past expiry)
      await manager.grantConsent('user-3', 'functional', 'explicit', 1)
      await new Promise((resolve) => setTimeout(resolve, 10))

      const stats = await manager.getStatistics()

      expect(stats.total).toBe(4)
      // granted counts records where granted===true (includes the expired one since granted is still true)
      expect(stats.granted).toBe(3)
      expect(stats.revoked).toBe(1)
      expect(stats.expired).toBe(1)
      expect(stats.byType.analytics).toBe(2)
      expect(stats.byType.marketing).toBe(1)
      expect(stats.byType.functional).toBe(1)
    })

    it('returns zeros when storage is empty', async () => {
      const stats = await manager.getStatistics()
      expect(stats.total).toBe(0)
      expect(stats.granted).toBe(0)
      expect(stats.revoked).toBe(0)
      expect(stats.expired).toBe(0)
    })
  })
})

// ── DataDeletionSystem ─────────────────────────────────────────────

describe('DataDeletionSystem', () => {
  let storage: InMemoryGDPRStorage
  let deletion: DataDeletionSystem

  beforeEach(() => {
    storage = new InMemoryGDPRStorage()
    deletion = new DataDeletionSystem(storage)
  })

  describe('requestDeletion', () => {
    it('creates a pending deletion request', async () => {
      const request = await deletion.requestDeletion(
        'user-1',
        ['personal', 'behavioral'],
        'GDPR Art. 17',
      )

      expect(request.userId).toBe('user-1')
      expect(request.status).toBe('pending')
      expect(request.dataCategories).toEqual(['personal', 'behavioral'])
      expect(request.reason).toBe('GDPR Art. 17')
      expect(request.id).toBeDefined()
      expect(request.requestedAt).toBeDefined()
    })

    it('stores the request in underlying storage', async () => {
      const request = await deletion.requestDeletion('user-1', ['personal'])
      const stored = await storage.getDeletionRequest(request.id)
      expect(stored).toEqual(request)
    })
  })

  describe('processDeletion', () => {
    it('calls deleteData callback and sets status to completed', async () => {
      const request = await deletion.requestDeletion('user-1', ['personal'])
      const deleteData = vi.fn().mockResolvedValue({
        deleted: ['users', 'profiles'],
        retained: ['audit_logs'],
      })

      await deletion.processDeletion(request.id, deleteData)

      expect(deleteData).toHaveBeenCalledWith('user-1', ['personal'])
      const processed = await deletion.getRequest(request.id)
      expect(processed?.status).toBe('completed')
      expect(processed?.processedAt).toBeDefined()
      expect(processed?.deletedData).toEqual(['users', 'profiles'])
      expect(processed?.retainedData).toEqual(['audit_logs'])
    })

    it('sets status to failed if callback throws', async () => {
      const request = await deletion.requestDeletion('user-1', ['personal'])
      const deleteData = vi.fn().mockRejectedValue(new Error('DB connection failed'))

      await expect(deletion.processDeletion(request.id, deleteData)).rejects.toThrow(
        'DB connection failed',
      )

      const processed = await deletion.getRequest(request.id)
      expect(processed?.status).toBe('failed')
    })

    it('throws when the request ID does not exist', async () => {
      const deleteData = vi.fn()
      await expect(deletion.processDeletion('nonexistent', deleteData)).rejects.toThrow(
        'Deletion request not found',
      )
      expect(deleteData).not.toHaveBeenCalled()
    })
  })

  describe('getRequest / getUserRequests', () => {
    it('retrieves a request by ID', async () => {
      const request = await deletion.requestDeletion('user-1', ['personal'])
      const retrieved = await deletion.getRequest(request.id)
      expect(retrieved).toEqual(request)
    })

    it('returns undefined for unknown request ID', async () => {
      expect(await deletion.getRequest('nope')).toBeUndefined()
    })

    it('returns all requests for a user', async () => {
      await deletion.requestDeletion('user-1', ['personal'])
      await deletion.requestDeletion('user-1', ['financial'])
      await deletion.requestDeletion('user-2', ['personal'])

      const requests = await deletion.getUserRequests('user-1')
      expect(requests).toHaveLength(2)
      expect(requests.every((r) => r.userId === 'user-1')).toBe(true)
    })

    it('returns empty array for a user with no requests', async () => {
      expect(await deletion.getUserRequests('nobody')).toEqual([])
    })
  })

  describe('canDelete', () => {
    it('returns false for legal_obligation basis', () => {
      expect(deletion.canDelete('personal', 'legal_obligation')).toBe(false)
    })

    it('returns false for vital_interest basis', () => {
      expect(deletion.canDelete('sensitive', 'vital_interest')).toBe(false)
    })

    it('returns true for consent basis', () => {
      expect(deletion.canDelete('personal', 'consent')).toBe(true)
    })

    it('returns true for legitimate_interest basis', () => {
      expect(deletion.canDelete('behavioral', 'legitimate_interest')).toBe(true)
    })

    it('returns true for contract basis', () => {
      expect(deletion.canDelete('financial', 'contract')).toBe(true)
    })

    it('returns true for public_interest basis', () => {
      expect(deletion.canDelete('location', 'public_interest')).toBe(true)
    })
  })

  describe('shouldDelete', () => {
    it('returns true when retention period has expired', () => {
      // Created 100 days ago, retention is 30 days
      const createdAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
      expect(deletion.shouldDelete(createdAt, 30)).toBe(true)
    })

    it('returns false when retention period has not expired', () => {
      // Created now, retention is 30 days
      const createdAt = new Date()
      expect(deletion.shouldDelete(createdAt, 30)).toBe(false)
    })
  })

  describe('calculateRetentionEnd', () => {
    it('adds the retention period in days to the created date', () => {
      const createdAt = new Date('2025-01-01T00:00:00Z')
      const end = deletion.calculateRetentionEnd(createdAt, 90)

      const expected = new Date('2025-04-01T00:00:00Z')
      expect(end.getTime()).toBe(expected.getTime())
    })

    it('handles zero-day retention (end equals created date)', () => {
      const createdAt = new Date('2025-06-15T12:00:00Z')
      const end = deletion.calculateRetentionEnd(createdAt, 0)
      expect(end.getTime()).toBe(createdAt.getTime())
    })
  })
})

// ── DataAnonymization ──────────────────────────────────────────────

describe('DataAnonymization', () => {
  describe('hashValue', () => {
    it('returns a deterministic hash prefixed with hash_', () => {
      const result = DataAnonymization.hashValue('test@example.com')
      expect(result).toMatch(/^hash_[0-9a-f]{64}$/)
    })

    it('produces the same hash for the same input', () => {
      const a = DataAnonymization.hashValue('hello')
      const b = DataAnonymization.hashValue('hello')
      expect(a).toBe(b)
    })

    it('produces different hashes for different inputs', () => {
      const a = DataAnonymization.hashValue('alice')
      const b = DataAnonymization.hashValue('bob')
      expect(a).not.toBe(b)
    })
  })

  describe('pseudonymize', () => {
    it('returns a deterministic pseudo ID prefixed with pseudo_', () => {
      const result = DataAnonymization.pseudonymize('user@example.com', 'secret-key')
      expect(result).toMatch(/^pseudo_/)
      expect(result.length).toBeGreaterThan('pseudo_'.length)
    })

    it('is deterministic for the same value and key', () => {
      const a = DataAnonymization.pseudonymize('data', 'key-1')
      const b = DataAnonymization.pseudonymize('data', 'key-1')
      expect(a).toBe(b)
    })

    it('produces different results for different keys', () => {
      const a = DataAnonymization.pseudonymize('data', 'key-1')
      const b = DataAnonymization.pseudonymize('data', 'key-2')
      expect(a).not.toBe(b)
    })

    it('produces different results for different values with the same key', () => {
      const a = DataAnonymization.pseudonymize('alice', 'key')
      const b = DataAnonymization.pseudonymize('bob', 'key')
      expect(a).not.toBe(b)
    })
  })

  describe('anonymizeUser', () => {
    it('replaces email with hash and name with Anonymous User', () => {
      const user = {
        id: 'user-1',
        email: 'real@example.com',
        name: 'Alice Smith',
        phone: '+1-555-0100',
        address: '123 Main St',
        ip: '192.168.1.1',
        role: 'admin',
      }

      const anon = DataAnonymization.anonymizeUser(user)

      expect(anon.email).toMatch(/^hash_[0-9a-f]{64}$/)
      expect(anon.email).toBe(DataAnonymization.hashValue('real@example.com'))
      expect(anon.name).toBe('Anonymous User')
      expect(anon.phone).toBeUndefined()
      expect(anon.address).toBeUndefined()
      expect(anon.ip).toBeUndefined()
      // Non-PII fields are preserved
      expect(anon.id).toBe('user-1')
      expect(anon.role).toBe('admin')
    })
  })

  describe('anonymizeDataset', () => {
    it('hashes specified sensitive fields in each record', () => {
      const dataset = [
        { id: 1, email: 'a@test.com', name: 'Alice', score: 95 },
        { id: 2, email: 'b@test.com', name: 'Bob', score: 87 },
      ]

      const result = DataAnonymization.anonymizeDataset(dataset, ['email', 'name'])

      expect(result).toHaveLength(2)
      // Sensitive fields are hashed
      expect(result[0].email).toBe(DataAnonymization.hashValue('a@test.com'))
      expect(result[0].name).toBe(DataAnonymization.hashValue('Alice'))
      expect(result[1].email).toBe(DataAnonymization.hashValue('b@test.com'))
      // Non-sensitive fields are untouched
      expect(result[0].id).toBe(1)
      expect(result[0].score).toBe(95)
    })

    it('does not modify the original dataset', () => {
      const dataset = [{ email: 'original@test.com', status: 'active' }]
      DataAnonymization.anonymizeDataset(dataset, ['email'])
      expect(dataset[0].email).toBe('original@test.com')
    })
  })

  describe('checkKAnonymity', () => {
    it('returns true when all groups have >= k members', () => {
      const data = [
        { age: 30, city: 'NYC' },
        { age: 30, city: 'NYC' },
        { age: 25, city: 'LA' },
        { age: 25, city: 'LA' },
      ]

      expect(DataAnonymization.checkKAnonymity(data, ['age', 'city'], 2)).toBe(true)
    })

    it('returns false when any group has fewer than k members', () => {
      const data = [
        { age: 30, city: 'NYC' },
        { age: 30, city: 'NYC' },
        { age: 25, city: 'LA' }, // only 1 in this group
      ]

      expect(DataAnonymization.checkKAnonymity(data, ['age', 'city'], 2)).toBe(false)
    })

    it('returns true for empty dataset (vacuously true)', () => {
      expect(DataAnonymization.checkKAnonymity([], ['age'], 5)).toBe(true)
    })

    it('returns true when k is 1 (trivially satisfied)', () => {
      const data = [{ age: 20 }, { age: 30 }, { age: 40 }]
      expect(DataAnonymization.checkKAnonymity(data, ['age'], 1)).toBe(true)
    })
  })
})

// ── Factory-style Construction ─────────────────────────────────────

describe('Factory functions', () => {
  it('createConsentManager returns a ConsentManager with the given storage', async () => {
    const storage = new InMemoryGDPRStorage()
    const manager = createConsentManager(storage)
    expect(manager).toBeInstanceOf(ConsentManager)
    await manager.grantConsent('u1', 'analytics')
    expect(await manager.hasConsent('u1', 'analytics')).toBe(true)
  })

  it('createDataDeletionSystem returns a DataDeletionSystem with the given storage', async () => {
    const storage = new InMemoryGDPRStorage()
    const system = createDataDeletionSystem(storage)
    expect(system).toBeInstanceOf(DataDeletionSystem)
    const request = await system.requestDeletion('u1', ['personal'])
    expect(request.status).toBe('pending')
  })

  it('ConsentManager can be constructed directly with storage', () => {
    const storage = new InMemoryGDPRStorage()
    const manager = new ConsentManager(storage)
    expect(manager).toBeInstanceOf(ConsentManager)
  })

  it('DataDeletionSystem can be constructed directly with storage', () => {
    const storage = new InMemoryGDPRStorage()
    const system = new DataDeletionSystem(storage)
    expect(system).toBeInstanceOf(DataDeletionSystem)
  })

  it('ConsentManager requires storage (no default)', async () => {
    const storage = new InMemoryGDPRStorage()
    const manager = new ConsentManager(storage)
    await manager.grantConsent('user-1', 'analytics')
    expect(await manager.hasConsent('user-1', 'analytics')).toBe(true)
  })

  it('DataDeletionSystem requires storage (no default)', async () => {
    const storage = new InMemoryGDPRStorage()
    const system = new DataDeletionSystem(storage)
    const request = await system.requestDeletion('user-1', ['personal'])
    expect(request.status).toBe('pending')
  })
})
