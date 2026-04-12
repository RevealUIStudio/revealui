/**
 * GDPR Storage Tests
 *
 * Tests for InMemoryGDPRStorage  -  the default storage backend
 * for GDPR consent records and deletion requests.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { ConsentRecord, ConsentType, DataDeletionRequest } from '../gdpr.js';
import { InMemoryGDPRStorage } from '../gdpr-storage.js';

function makeConsent(overrides: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    id: crypto.randomUUID(),
    userId: 'user-1',
    type: 'analytics',
    granted: true,
    timestamp: new Date().toISOString(),
    source: 'explicit',
    version: '1.0.0',
    ...overrides,
  };
}

function makeDeletionRequest(overrides: Partial<DataDeletionRequest> = {}): DataDeletionRequest {
  return {
    id: crypto.randomUUID(),
    userId: 'user-1',
    requestedAt: new Date().toISOString(),
    status: 'pending',
    dataCategories: ['personal'],
    ...overrides,
  };
}

describe('InMemoryGDPRStorage', () => {
  let storage: InMemoryGDPRStorage;

  beforeEach(() => {
    storage = new InMemoryGDPRStorage();
  });

  // ── Consent Records ──────────────────────────────────────────────

  describe('setConsent / getConsent', () => {
    it('stores and retrieves a consent record by userId:type key', async () => {
      const consent = makeConsent({ userId: 'user-42', type: 'marketing' });
      await storage.setConsent('user-42', 'marketing', consent);

      const retrieved = await storage.getConsent('user-42', 'marketing');
      expect(retrieved).toEqual(consent);
    });

    it('returns undefined for a non-existent key', async () => {
      const result = await storage.getConsent('no-such-user', 'analytics');
      expect(result).toBeUndefined();
    });

    it('overwrites an existing consent for the same userId:type', async () => {
      const original = makeConsent({ userId: 'user-1', type: 'analytics', granted: true });
      const updated = makeConsent({ userId: 'user-1', type: 'analytics', granted: false });

      await storage.setConsent('user-1', 'analytics', original);
      await storage.setConsent('user-1', 'analytics', updated);

      const retrieved = await storage.getConsent('user-1', 'analytics');
      expect(retrieved).toEqual(updated);
      expect(retrieved?.granted).toBe(false);
    });

    it('keeps different types for the same user separate', async () => {
      const analytics = makeConsent({ userId: 'user-1', type: 'analytics' });
      const marketing = makeConsent({ userId: 'user-1', type: 'marketing' });

      await storage.setConsent('user-1', 'analytics', analytics);
      await storage.setConsent('user-1', 'marketing', marketing);

      expect(await storage.getConsent('user-1', 'analytics')).toEqual(analytics);
      expect(await storage.getConsent('user-1', 'marketing')).toEqual(marketing);
    });
  });

  describe('getConsentsByUser', () => {
    it('returns all consents for a user', async () => {
      const types: ConsentType[] = ['analytics', 'marketing', 'functional'];
      for (const type of types) {
        await storage.setConsent('user-1', type, makeConsent({ userId: 'user-1', type }));
      }
      // Different user  -  should not appear
      await storage.setConsent(
        'user-2',
        'analytics',
        makeConsent({ userId: 'user-2', type: 'analytics' }),
      );

      const consents = await storage.getConsentsByUser('user-1');
      expect(consents).toHaveLength(3);
      expect(consents.every((c) => c.userId === 'user-1')).toBe(true);
    });

    it('returns empty array for an unknown user', async () => {
      const consents = await storage.getConsentsByUser('ghost');
      expect(consents).toEqual([]);
    });
  });

  describe('getAllConsents', () => {
    it('returns all stored consent records', async () => {
      await storage.setConsent('a', 'analytics', makeConsent({ userId: 'a', type: 'analytics' }));
      await storage.setConsent('b', 'marketing', makeConsent({ userId: 'b', type: 'marketing' }));
      await storage.setConsent('c', 'necessary', makeConsent({ userId: 'c', type: 'necessary' }));

      const all = await storage.getAllConsents();
      expect(all).toHaveLength(3);
    });

    it('returns empty array when storage is empty', async () => {
      expect(await storage.getAllConsents()).toEqual([]);
    });
  });

  // ── Deletion Requests ────────────────────────────────────────────

  describe('setDeletionRequest / getDeletionRequest', () => {
    it('stores and retrieves a deletion request by ID', async () => {
      const request = makeDeletionRequest({ id: 'del-1' });
      await storage.setDeletionRequest(request);

      const retrieved = await storage.getDeletionRequest('del-1');
      expect(retrieved).toEqual(request);
    });

    it('returns undefined for a non-existent request ID', async () => {
      expect(await storage.getDeletionRequest('nope')).toBeUndefined();
    });

    it('overwrites an existing request with the same ID', async () => {
      const pending = makeDeletionRequest({ id: 'del-1', status: 'pending' });
      const completed = {
        ...pending,
        status: 'completed' as const,
        processedAt: new Date().toISOString(),
      };

      await storage.setDeletionRequest(pending);
      await storage.setDeletionRequest(completed);

      const retrieved = await storage.getDeletionRequest('del-1');
      expect(retrieved?.status).toBe('completed');
    });
  });

  describe('getDeletionRequestsByUser', () => {
    it('returns all deletion requests for a user', async () => {
      await storage.setDeletionRequest(makeDeletionRequest({ id: 'r1', userId: 'user-1' }));
      await storage.setDeletionRequest(makeDeletionRequest({ id: 'r2', userId: 'user-1' }));
      await storage.setDeletionRequest(makeDeletionRequest({ id: 'r3', userId: 'user-2' }));

      const requests = await storage.getDeletionRequestsByUser('user-1');
      expect(requests).toHaveLength(2);
      expect(requests.every((r) => r.userId === 'user-1')).toBe(true);
    });

    it('returns empty array for an unknown user', async () => {
      const requests = await storage.getDeletionRequestsByUser('nobody');
      expect(requests).toEqual([]);
    });
  });
});
