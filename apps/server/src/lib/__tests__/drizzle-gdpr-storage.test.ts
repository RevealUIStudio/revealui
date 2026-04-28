import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockInsertValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectLimit = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

const mockDb = {
  insert: vi.fn(() => ({ values: mockInsertValues })),
  select: vi.fn(() => ({ from: mockSelectFrom })),
  update: vi.fn(() => ({ set: mockUpdateSet })),
};

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  gdprConsents: {
    id: 'gdpr_consents.id',
    userId: 'gdpr_consents.user_id',
    type: 'gdpr_consents.type',
    granted: 'gdpr_consents.granted',
    timestamp: 'gdpr_consents.timestamp',
    expiresAt: 'gdpr_consents.expires_at',
    source: 'gdpr_consents.source',
    version: 'gdpr_consents.version',
    metadata: 'gdpr_consents.metadata',
  },
  gdprDeletionRequests: {
    id: 'gdpr_deletion_requests.id',
    userId: 'gdpr_deletion_requests.user_id',
    requestedAt: 'gdpr_deletion_requests.requested_at',
    processedAt: 'gdpr_deletion_requests.processed_at',
    status: 'gdpr_deletion_requests.status',
    dataCategories: 'gdpr_deletion_requests.data_categories',
    reason: 'gdpr_deletion_requests.reason',
    retainedData: 'gdpr_deletion_requests.retained_data',
    deletedData: 'gdpr_deletion_requests.deleted_data',
  },
  gdprBreaches: {
    id: 'gdpr_breaches.id',
    detectedAt: 'gdpr_breaches.detected_at',
    reportedAt: 'gdpr_breaches.reported_at',
    type: 'gdpr_breaches.type',
    severity: 'gdpr_breaches.severity',
    affectedUsers: 'gdpr_breaches.affected_users',
    dataCategories: 'gdpr_breaches.data_categories',
    description: 'gdpr_breaches.description',
    mitigation: 'gdpr_breaches.mitigation',
    status: 'gdpr_breaches.status',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  eq: vi.fn((col: unknown, val: unknown) => ({ _eq: { col, val } })),
}));

import { DrizzleBreachStorage, DrizzleGDPRStorage } from '../drizzle-gdpr-storage.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupInsertChain(): void {
  mockInsertValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
  mockOnConflictDoUpdate.mockResolvedValue(undefined);
}

function setupSelectChain(rows: unknown[]): void {
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectLimit.mockResolvedValue(rows);
}

function setupSelectChainNoWhere(rows: unknown[]): void {
  // For queries that don't use .where() (e.g. getAllConsents, getAllBreaches)
  mockSelectFrom.mockResolvedValue(rows);
}

function setupSelectChainWithWhere(rows: unknown[]): void {
  // For queries that use .where() but no .limit() (e.g. getConsentsByUser)
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelectWhere.mockResolvedValue(rows);
}

function setupUpdateChain(): void {
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdateWhere.mockResolvedValue(undefined);
}

/** Create a mock DB row matching gdprConsents.$inferSelect shape */
function makeConsentRow(
  overrides: Partial<{
    id: string;
    userId: string;
    type: string;
    granted: boolean;
    timestamp: Date;
    expiresAt: Date | null;
    source: string;
    version: string;
    metadata: Record<string, unknown> | null;
  }> = {},
) {
  return {
    id: overrides.id ?? 'consent-1',
    userId: overrides.userId ?? 'user-1',
    type: overrides.type ?? 'analytics',
    granted: overrides.granted ?? true,
    timestamp: overrides.timestamp ?? new Date('2026-01-15T10:00:00.000Z'),
    expiresAt: overrides.expiresAt ?? null,
    source: overrides.source ?? 'explicit',
    version: overrides.version ?? '1.0.0',
    metadata: overrides.metadata ?? null,
  };
}

/** Create a mock DB row matching gdprDeletionRequests.$inferSelect shape */
function makeDeletionRow(
  overrides: Partial<{
    id: string;
    userId: string;
    requestedAt: Date;
    processedAt: Date | null;
    status: string;
    dataCategories: string[];
    reason: string | null;
    retainedData: string[] | null;
    deletedData: string[] | null;
  }> = {},
) {
  return {
    id: overrides.id ?? 'del-1',
    userId: overrides.userId ?? 'user-1',
    requestedAt: overrides.requestedAt ?? new Date('2026-01-15T10:00:00.000Z'),
    processedAt: overrides.processedAt ?? null,
    status: overrides.status ?? 'pending',
    dataCategories: overrides.dataCategories ?? ['personal'],
    reason: overrides.reason ?? null,
    retainedData: overrides.retainedData ?? null,
    deletedData: overrides.deletedData ?? null,
  };
}

/** Create a mock DB row matching gdprBreaches.$inferSelect shape */
function makeBreachRow(
  overrides: Partial<{
    id: string;
    detectedAt: Date;
    reportedAt: Date | null;
    type: string;
    severity: string;
    affectedUsers: string[];
    dataCategories: string[];
    description: string;
    mitigation: string | null;
    status: string;
  }> = {},
) {
  return {
    id: overrides.id ?? 'breach-1',
    detectedAt: overrides.detectedAt ?? new Date('2026-01-15T10:00:00.000Z'),
    reportedAt: overrides.reportedAt ?? null,
    type: overrides.type ?? 'data_leak',
    severity: overrides.severity ?? 'high',
    affectedUsers: overrides.affectedUsers ?? ['user-1', 'user-2'],
    dataCategories: overrides.dataCategories ?? ['personal', 'financial'],
    description: overrides.description ?? 'Test breach',
    mitigation: overrides.mitigation ?? null,
    status: overrides.status ?? 'detected',
  };
}

// ---------------------------------------------------------------------------
// DrizzleGDPRStorage  -  Consent Records
// ---------------------------------------------------------------------------

describe('DrizzleGDPRStorage', () => {
  let storage: DrizzleGDPRStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DrizzleGDPRStorage();
  });

  describe('setConsent', () => {
    it('inserts a consent record with onConflictDoUpdate', async () => {
      setupInsertChain();

      await storage.setConsent('user-1', 'analytics', {
        id: 'consent-1',
        userId: 'user-1',
        type: 'analytics',
        granted: true,
        timestamp: '2026-01-15T10:00:00.000Z',
        source: 'explicit',
        version: '1.0.0',
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(mockInsertValues).toHaveBeenCalledOnce();
      expect(mockOnConflictDoUpdate).toHaveBeenCalledOnce();

      // Verify insert values contain the correct fields
      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.id).toBe('consent-1');
      expect(insertCall.userId).toBe('user-1');
      expect(insertCall.type).toBe('analytics');
      expect(insertCall.granted).toBe(true);
      expect(insertCall.source).toBe('explicit');
      expect(insertCall.version).toBe('1.0.0');
    });

    it('converts timestamp strings to Date objects', async () => {
      setupInsertChain();

      await storage.setConsent('user-1', 'marketing', {
        id: 'consent-2',
        userId: 'user-1',
        type: 'marketing',
        granted: true,
        timestamp: '2026-03-01T12:00:00.000Z',
        expiresAt: '2027-03-01T12:00:00.000Z',
        source: 'explicit',
        version: '2.0.0',
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.timestamp).toBeInstanceOf(Date);
      expect(insertCall.expiresAt).toBeInstanceOf(Date);
      expect(insertCall.timestamp.toISOString()).toBe('2026-03-01T12:00:00.000Z');
      expect(insertCall.expiresAt.toISOString()).toBe('2027-03-01T12:00:00.000Z');
    });

    it('stores null expiresAt when not provided', async () => {
      setupInsertChain();

      await storage.setConsent('user-1', 'analytics', {
        id: 'consent-3',
        userId: 'user-1',
        type: 'analytics',
        granted: true,
        timestamp: '2026-01-15T10:00:00.000Z',
        source: 'explicit',
        version: '1.0.0',
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.expiresAt).toBeNull();
    });

    it('stores null metadata when not provided', async () => {
      setupInsertChain();

      await storage.setConsent('user-1', 'analytics', {
        id: 'consent-4',
        userId: 'user-1',
        type: 'analytics',
        granted: true,
        timestamp: '2026-01-15T10:00:00.000Z',
        source: 'explicit',
        version: '1.0.0',
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.metadata).toBeNull();
    });

    it('passes metadata through when provided', async () => {
      setupInsertChain();
      const meta = { ip: '192.168.1.1', userAgent: 'TestBot' };

      await storage.setConsent('user-1', 'analytics', {
        id: 'consent-5',
        userId: 'user-1',
        type: 'analytics',
        granted: true,
        timestamp: '2026-01-15T10:00:00.000Z',
        source: 'explicit',
        version: '1.0.0',
        metadata: meta,
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.metadata).toEqual(meta);
    });
  });

  describe('getConsent', () => {
    it('returns a ConsentRecord when found', async () => {
      const row = makeConsentRow();
      setupSelectChain([row]);

      const result = await storage.getConsent('user-1', 'analytics');

      expect(result).toEqual({
        id: 'consent-1',
        userId: 'user-1',
        type: 'analytics',
        granted: true,
        timestamp: '2026-01-15T10:00:00.000Z',
        expiresAt: undefined,
        source: 'explicit',
        version: '1.0.0',
        metadata: undefined,
      });
    });

    it('returns undefined when no consent found', async () => {
      setupSelectChain([]);

      const result = await storage.getConsent('nonexistent-user', 'analytics');

      expect(result).toBeUndefined();
    });

    it('maps expiresAt from Date to ISO string', async () => {
      const row = makeConsentRow({
        expiresAt: new Date('2027-06-01T00:00:00.000Z'),
      });
      setupSelectChain([row]);

      const result = await storage.getConsent('user-1', 'analytics');

      expect(result?.expiresAt).toBe('2027-06-01T00:00:00.000Z');
    });

    it('maps metadata from null to undefined', async () => {
      const row = makeConsentRow({ metadata: null });
      setupSelectChain([row]);

      const result = await storage.getConsent('user-1', 'analytics');

      expect(result?.metadata).toBeUndefined();
    });

    it('passes metadata through when present', async () => {
      const meta = { region: 'EU' };
      const row = makeConsentRow({ metadata: meta });
      setupSelectChain([row]);

      const result = await storage.getConsent('user-1', 'analytics');

      expect(result?.metadata).toEqual(meta);
    });
  });

  describe('getConsentsByUser', () => {
    it('returns all consent records for a user', async () => {
      const rows = [
        makeConsentRow({ id: 'c1', type: 'analytics' }),
        makeConsentRow({ id: 'c2', type: 'marketing', granted: false }),
      ];
      setupSelectChainWithWhere(rows);

      const results = await storage.getConsentsByUser('user-1');

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('c1');
      expect(results[1].id).toBe('c2');
      expect(results[1].granted).toBe(false);
    });

    it('returns empty array when user has no consents', async () => {
      setupSelectChainWithWhere([]);

      const results = await storage.getConsentsByUser('no-consents-user');

      expect(results).toEqual([]);
    });
  });

  describe('getAllConsents', () => {
    it('returns all consent records', async () => {
      const rows = [
        makeConsentRow({ id: 'c1', userId: 'user-1' }),
        makeConsentRow({ id: 'c2', userId: 'user-2' }),
        makeConsentRow({ id: 'c3', userId: 'user-3' }),
      ];
      setupSelectChainNoWhere(rows);

      const results = await storage.getAllConsents();

      expect(results).toHaveLength(3);
    });

    it('returns empty array when no consents exist', async () => {
      setupSelectChainNoWhere([]);

      const results = await storage.getAllConsents();

      expect(results).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Consent update (upsert behavior)
  // -------------------------------------------------------------------------

  describe('consent update (upsert)', () => {
    it('calls onConflictDoUpdate with updated fields', async () => {
      setupInsertChain();

      await storage.setConsent('user-1', 'analytics', {
        id: 'consent-updated',
        userId: 'user-1',
        type: 'analytics',
        granted: false,
        timestamp: '2026-02-01T00:00:00.000Z',
        source: 'explicit',
        version: '2.0.0',
      });

      const conflictCall = mockOnConflictDoUpdate.mock.calls[0][0];
      expect(conflictCall.set.granted).toBe(false);
      expect(conflictCall.set.version).toBe('2.0.0');
      expect(conflictCall.set.id).toBe('consent-updated');
    });
  });

  // -------------------------------------------------------------------------
  // Deletion Requests
  // -------------------------------------------------------------------------

  describe('setDeletionRequest', () => {
    it('inserts a deletion request with onConflictDoUpdate', async () => {
      setupInsertChain();

      await storage.setDeletionRequest({
        id: 'del-1',
        userId: 'user-1',
        requestedAt: '2026-01-15T10:00:00.000Z',
        status: 'pending',
        dataCategories: ['personal', 'financial'],
        reason: 'I want my data deleted',
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(mockInsertValues).toHaveBeenCalledOnce();
      expect(mockOnConflictDoUpdate).toHaveBeenCalledOnce();

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.id).toBe('del-1');
      expect(insertCall.userId).toBe('user-1');
      expect(insertCall.status).toBe('pending');
      expect(insertCall.dataCategories).toEqual(['personal', 'financial']);
      expect(insertCall.reason).toBe('I want my data deleted');
    });

    it('converts requestedAt string to Date', async () => {
      setupInsertChain();

      await storage.setDeletionRequest({
        id: 'del-2',
        userId: 'user-1',
        requestedAt: '2026-03-01T08:00:00.000Z',
        status: 'pending',
        dataCategories: ['personal'],
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.requestedAt).toBeInstanceOf(Date);
      expect(insertCall.requestedAt.toISOString()).toBe('2026-03-01T08:00:00.000Z');
    });

    it('handles completed request with processedAt', async () => {
      setupInsertChain();

      await storage.setDeletionRequest({
        id: 'del-3',
        userId: 'user-1',
        requestedAt: '2026-01-15T10:00:00.000Z',
        processedAt: '2026-01-16T10:00:00.000Z',
        status: 'completed',
        dataCategories: ['personal'],
        deletedData: ['profile', 'activities'],
        retainedData: ['invoices'],
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.processedAt).toBeInstanceOf(Date);
      expect(insertCall.status).toBe('completed');
      expect(insertCall.deletedData).toEqual(['profile', 'activities']);
      expect(insertCall.retainedData).toEqual(['invoices']);
    });

    it('stores null for optional fields when not provided', async () => {
      setupInsertChain();

      await storage.setDeletionRequest({
        id: 'del-4',
        userId: 'user-1',
        requestedAt: '2026-01-15T10:00:00.000Z',
        status: 'pending',
        dataCategories: ['personal'],
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.processedAt).toBeNull();
      expect(insertCall.reason).toBeNull();
      expect(insertCall.retainedData).toBeNull();
      expect(insertCall.deletedData).toBeNull();
    });
  });

  describe('getDeletionRequest', () => {
    it('returns a DataDeletionRequest when found', async () => {
      const row = makeDeletionRow();
      setupSelectChain([row]);

      const result = await storage.getDeletionRequest('del-1');

      expect(result).toEqual({
        id: 'del-1',
        userId: 'user-1',
        requestedAt: '2026-01-15T10:00:00.000Z',
        processedAt: undefined,
        status: 'pending',
        dataCategories: ['personal'],
        reason: undefined,
        retainedData: undefined,
        deletedData: undefined,
      });
    });

    it('returns undefined when request not found', async () => {
      setupSelectChain([]);

      const result = await storage.getDeletionRequest('nonexistent');

      expect(result).toBeUndefined();
    });

    it('maps processedAt from Date to ISO string', async () => {
      const row = makeDeletionRow({
        processedAt: new Date('2026-01-16T10:00:00.000Z'),
        status: 'completed',
      });
      setupSelectChain([row]);

      const result = await storage.getDeletionRequest('del-1');

      expect(result?.processedAt).toBe('2026-01-16T10:00:00.000Z');
    });

    it('maps null optional fields to undefined', async () => {
      const row = makeDeletionRow({
        reason: null,
        retainedData: null,
        deletedData: null,
      });
      setupSelectChain([row]);

      const result = await storage.getDeletionRequest('del-1');

      expect(result?.reason).toBeUndefined();
      expect(result?.retainedData).toBeUndefined();
      expect(result?.deletedData).toBeUndefined();
    });
  });

  describe('getDeletionRequestsByUser', () => {
    it('returns all deletion requests for a user', async () => {
      const rows = [
        makeDeletionRow({ id: 'del-1', status: 'completed' }),
        makeDeletionRow({ id: 'del-2', status: 'pending' }),
      ];
      setupSelectChainWithWhere(rows);

      const results = await storage.getDeletionRequestsByUser('user-1');

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('del-1');
      expect(results[1].id).toBe('del-2');
    });

    it('returns empty array when user has no requests', async () => {
      setupSelectChainWithWhere([]);

      const results = await storage.getDeletionRequestsByUser('no-requests-user');

      expect(results).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('propagates database errors from setConsent', async () => {
      mockInsertValues.mockReturnValue({
        onConflictDoUpdate: vi.fn().mockRejectedValue(new Error('DB connection lost')),
      });

      await expect(
        storage.setConsent('user-1', 'analytics', {
          id: 'consent-err',
          userId: 'user-1',
          type: 'analytics',
          granted: true,
          timestamp: '2026-01-15T10:00:00.000Z',
          source: 'explicit',
          version: '1.0.0',
        }),
      ).rejects.toThrow('DB connection lost');
    });

    it('propagates database errors from getConsent', async () => {
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockReturnValue({
        limit: vi.fn().mockRejectedValue(new Error('Query timeout')),
      });

      await expect(storage.getConsent('user-1', 'analytics')).rejects.toThrow('Query timeout');
    });

    it('propagates database errors from setDeletionRequest', async () => {
      mockInsertValues.mockReturnValue({
        onConflictDoUpdate: vi.fn().mockRejectedValue(new Error('Constraint violation')),
      });

      await expect(
        storage.setDeletionRequest({
          id: 'del-err',
          userId: 'user-1',
          requestedAt: '2026-01-15T10:00:00.000Z',
          status: 'pending',
          dataCategories: ['personal'],
        }),
      ).rejects.toThrow('Constraint violation');
    });

    it('propagates database errors from getDeletionRequest', async () => {
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockReturnValue({
        limit: vi.fn().mockRejectedValue(new Error('Table not found')),
      });

      await expect(storage.getDeletionRequest('del-1')).rejects.toThrow('Table not found');
    });
  });

  // -------------------------------------------------------------------------
  // GDPR compliance: right to erasure
  // -------------------------------------------------------------------------

  describe('GDPR compliance', () => {
    it('consent withdrawal updates granted to false via upsert', async () => {
      setupInsertChain();

      await storage.setConsent('user-1', 'marketing', {
        id: 'consent-revoke',
        userId: 'user-1',
        type: 'marketing',
        granted: false,
        timestamp: '2026-02-01T00:00:00.000Z',
        source: 'explicit',
        version: '1.0.0',
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.granted).toBe(false);

      const conflictCall = mockOnConflictDoUpdate.mock.calls[0][0];
      expect(conflictCall.set.granted).toBe(false);
    });

    it('deletion request tracks which data categories were deleted', async () => {
      setupInsertChain();

      await storage.setDeletionRequest({
        id: 'del-erasure',
        userId: 'user-1',
        requestedAt: '2026-01-15T10:00:00.000Z',
        processedAt: '2026-01-16T10:00:00.000Z',
        status: 'completed',
        dataCategories: ['personal', 'behavioral', 'location'],
        deletedData: ['profile', 'activities', 'location_history'],
        retainedData: ['invoices'],
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.deletedData).toEqual(['profile', 'activities', 'location_history']);
      expect(insertCall.retainedData).toEqual(['invoices']);
      expect(insertCall.status).toBe('completed');
    });

    it('deletion request preserves full audit trail via upsert', async () => {
      setupInsertChain();

      await storage.setDeletionRequest({
        id: 'del-audit',
        userId: 'user-1',
        requestedAt: '2026-01-15T10:00:00.000Z',
        processedAt: '2026-01-16T10:00:00.000Z',
        status: 'completed',
        dataCategories: ['personal'],
        deletedData: ['profile'],
        retainedData: [],
      });

      const conflictCall = mockOnConflictDoUpdate.mock.calls[0][0];
      expect(conflictCall.set.status).toBe('completed');
      expect(conflictCall.set.processedAt).toBeInstanceOf(Date);
    });
  });
});

// ---------------------------------------------------------------------------
// DrizzleBreachStorage
// ---------------------------------------------------------------------------

describe('DrizzleBreachStorage', () => {
  let storage: DrizzleBreachStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new DrizzleBreachStorage();
  });

  describe('setBreach', () => {
    it('inserts a breach record with onConflictDoUpdate', async () => {
      setupInsertChain();

      await storage.setBreach({
        id: 'breach-1',
        detectedAt: '2026-01-15T10:00:00.000Z',
        type: 'data_leak',
        severity: 'high',
        affectedUsers: ['user-1', 'user-2'],
        dataCategories: ['personal', 'financial'],
        description: 'Exposed user data in logs',
        status: 'detected',
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(mockInsertValues).toHaveBeenCalledOnce();
      expect(mockOnConflictDoUpdate).toHaveBeenCalledOnce();

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.id).toBe('breach-1');
      expect(insertCall.type).toBe('data_leak');
      expect(insertCall.severity).toBe('high');
      expect(insertCall.affectedUsers).toEqual(['user-1', 'user-2']);
      expect(insertCall.description).toBe('Exposed user data in logs');
      expect(insertCall.status).toBe('detected');
    });

    it('converts detectedAt string to Date', async () => {
      setupInsertChain();

      await storage.setBreach({
        id: 'breach-2',
        detectedAt: '2026-03-01T08:30:00.000Z',
        type: 'unauthorized_access',
        severity: 'critical',
        affectedUsers: ['user-1'],
        dataCategories: ['sensitive'],
        description: 'Unauthorized DB access',
        status: 'detected',
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.detectedAt).toBeInstanceOf(Date);
      expect(insertCall.detectedAt.toISOString()).toBe('2026-03-01T08:30:00.000Z');
    });

    it('handles reportedAt when present', async () => {
      setupInsertChain();

      await storage.setBreach({
        id: 'breach-3',
        detectedAt: '2026-01-15T10:00:00.000Z',
        reportedAt: '2026-01-15T12:00:00.000Z',
        type: 'data_leak',
        severity: 'high',
        affectedUsers: ['user-1'],
        dataCategories: ['personal'],
        description: 'Breach with report',
        status: 'notified',
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.reportedAt).toBeInstanceOf(Date);
      expect(insertCall.reportedAt.toISOString()).toBe('2026-01-15T12:00:00.000Z');
    });

    it('stores null for optional fields when not provided', async () => {
      setupInsertChain();

      await storage.setBreach({
        id: 'breach-4',
        detectedAt: '2026-01-15T10:00:00.000Z',
        type: 'system_compromise',
        severity: 'medium',
        affectedUsers: [],
        dataCategories: [],
        description: 'No mitigation yet',
        status: 'investigating',
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.reportedAt).toBeNull();
      expect(insertCall.mitigation).toBeNull();
    });
  });

  describe('getBreach', () => {
    it('returns a DataBreach when found', async () => {
      const row = makeBreachRow();
      setupSelectChain([row]);

      const result = await storage.getBreach('breach-1');

      expect(result).toEqual({
        id: 'breach-1',
        detectedAt: '2026-01-15T10:00:00.000Z',
        reportedAt: undefined,
        type: 'data_leak',
        severity: 'high',
        affectedUsers: ['user-1', 'user-2'],
        dataCategories: ['personal', 'financial'],
        description: 'Test breach',
        mitigation: undefined,
        status: 'detected',
      });
    });

    it('returns undefined when breach not found', async () => {
      setupSelectChain([]);

      const result = await storage.getBreach('nonexistent');

      expect(result).toBeUndefined();
    });

    it('maps reportedAt from Date to ISO string', async () => {
      const row = makeBreachRow({
        reportedAt: new Date('2026-01-16T08:00:00.000Z'),
      });
      setupSelectChain([row]);

      const result = await storage.getBreach('breach-1');

      expect(result?.reportedAt).toBe('2026-01-16T08:00:00.000Z');
    });

    it('maps mitigation from null to undefined', async () => {
      const row = makeBreachRow({ mitigation: null });
      setupSelectChain([row]);

      const result = await storage.getBreach('breach-1');

      expect(result?.mitigation).toBeUndefined();
    });

    it('includes mitigation when present', async () => {
      const row = makeBreachRow({ mitigation: 'Rotated credentials and patched vulnerability' });
      setupSelectChain([row]);

      const result = await storage.getBreach('breach-1');

      expect(result?.mitigation).toBe('Rotated credentials and patched vulnerability');
    });
  });

  describe('getAllBreaches', () => {
    it('returns all breach records', async () => {
      const rows = [
        makeBreachRow({ id: 'b1', severity: 'low' }),
        makeBreachRow({ id: 'b2', severity: 'critical' }),
      ];
      setupSelectChainNoWhere(rows);

      const results = await storage.getAllBreaches();

      expect(results).toHaveLength(2);
      expect(results[0].severity).toBe('low');
      expect(results[1].severity).toBe('critical');
    });

    it('returns empty array when no breaches exist', async () => {
      setupSelectChainNoWhere([]);

      const results = await storage.getAllBreaches();

      expect(results).toEqual([]);
    });
  });

  describe('updateBreach', () => {
    it('updates status field', async () => {
      setupUpdateChain();

      await storage.updateBreach('breach-1', { status: 'resolved' });

      expect(mockDb.update).toHaveBeenCalledOnce();
      const setCall = mockUpdateSet.mock.calls[0][0];
      expect(setCall.status).toBe('resolved');
    });

    it('updates mitigation field', async () => {
      setupUpdateChain();

      await storage.updateBreach('breach-1', { mitigation: 'Applied security patch' });

      const setCall = mockUpdateSet.mock.calls[0][0];
      expect(setCall.mitigation).toBe('Applied security patch');
    });

    it('converts reportedAt string to Date on update', async () => {
      setupUpdateChain();

      await storage.updateBreach('breach-1', { reportedAt: '2026-01-17T09:00:00.000Z' });

      const setCall = mockUpdateSet.mock.calls[0][0];
      expect(setCall.reportedAt).toBeInstanceOf(Date);
      expect(setCall.reportedAt.toISOString()).toBe('2026-01-17T09:00:00.000Z');
    });

    it('does not call update when no recognized fields are provided', async () => {
      await storage.updateBreach('breach-1', {});

      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('handles multiple fields at once', async () => {
      setupUpdateChain();

      await storage.updateBreach('breach-1', {
        status: 'notified',
        mitigation: 'User passwords reset',
        reportedAt: '2026-01-17T10:00:00.000Z',
      });

      const setCall = mockUpdateSet.mock.calls[0][0];
      expect(setCall.status).toBe('notified');
      expect(setCall.mitigation).toBe('User passwords reset');
      expect(setCall.reportedAt).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('propagates database errors from setBreach', async () => {
      mockInsertValues.mockReturnValue({
        onConflictDoUpdate: vi.fn().mockRejectedValue(new Error('Insert failed')),
      });

      await expect(
        storage.setBreach({
          id: 'breach-err',
          detectedAt: '2026-01-15T10:00:00.000Z',
          type: 'data_leak',
          severity: 'high',
          affectedUsers: [],
          dataCategories: [],
          description: 'Error test',
          status: 'detected',
        }),
      ).rejects.toThrow('Insert failed');
    });

    it('propagates database errors from getBreach', async () => {
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelectWhere.mockReturnValue({
        limit: vi.fn().mockRejectedValue(new Error('Read error')),
      });

      await expect(storage.getBreach('breach-1')).rejects.toThrow('Read error');
    });

    it('propagates database errors from updateBreach', async () => {
      mockUpdateSet.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Update failed')),
      });

      await expect(storage.updateBreach('breach-1', { status: 'resolved' })).rejects.toThrow(
        'Update failed',
      );
    });

    it('propagates database errors from getAllBreaches', async () => {
      mockSelectFrom.mockRejectedValue(new Error('Connection refused'));

      await expect(storage.getAllBreaches()).rejects.toThrow('Connection refused');
    });
  });

  // -------------------------------------------------------------------------
  // GDPR compliance: breach records
  // -------------------------------------------------------------------------

  describe('GDPR compliance  -  breach records', () => {
    it('breach status can be updated through full lifecycle', async () => {
      // First: insert as detected
      setupInsertChain();
      await storage.setBreach({
        id: 'breach-lifecycle',
        detectedAt: '2026-01-15T10:00:00.000Z',
        type: 'data_leak',
        severity: 'critical',
        affectedUsers: ['user-1'],
        dataCategories: ['personal'],
        description: 'Lifecycle test',
        status: 'detected',
      });

      const insertCall = mockInsertValues.mock.calls[0][0];
      expect(insertCall.status).toBe('detected');

      // Second: update to notified with reportedAt
      setupUpdateChain();
      await storage.updateBreach('breach-lifecycle', {
        status: 'notified',
        reportedAt: '2026-01-15T12:00:00.000Z',
      });

      const updateCall = mockUpdateSet.mock.calls[0][0];
      expect(updateCall.status).toBe('notified');
      expect(updateCall.reportedAt).toBeInstanceOf(Date);
    });

    it('onConflictDoUpdate preserves existing breach data on re-insert', async () => {
      setupInsertChain();

      await storage.setBreach({
        id: 'breach-upsert',
        detectedAt: '2026-01-15T10:00:00.000Z',
        reportedAt: '2026-01-16T08:00:00.000Z',
        type: 'unauthorized_access',
        severity: 'high',
        affectedUsers: ['user-1'],
        dataCategories: ['sensitive'],
        description: 'Re-insert test',
        mitigation: 'Credentials rotated',
        status: 'notified',
      });

      const conflictCall = mockOnConflictDoUpdate.mock.calls[0][0];
      // Only status, mitigation, reportedAt are updated on conflict
      expect(conflictCall.set.status).toBe('notified');
      expect(conflictCall.set.mitigation).toBe('Credentials rotated');
      expect(conflictCall.set.reportedAt).toBeInstanceOf(Date);
    });
  });
});
