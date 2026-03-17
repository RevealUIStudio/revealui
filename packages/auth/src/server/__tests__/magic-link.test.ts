import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

// Chain mocks for drizzle-orm query builder
const mockRows: Record<string, unknown>[][] = [[]];
const mockLimit = vi.fn().mockImplementation(() => Promise.resolve(mockRows[0]));
// mockWhere returns a thenable (so `await db.select().from().where()` resolves to rows)
// that also exposes `.limit()` for chains that use it (e.g. password-reset pattern).
const mockWhere = vi.fn().mockImplementation(() => {
  const result = Promise.resolve(mockRows[0]);
  (result as Record<string, unknown>).limit = mockLimit;
  return result;
});
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
const mockUpdateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });
const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  magicLinks: {
    id: 'id',
    userId: 'userId',
    tokenHash: 'tokenHash',
    tokenSalt: 'tokenSalt',
    expiresAt: 'expiresAt',
    usedAt: 'usedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => ({ eq: val })),
  and: vi.fn((...args) => ({ and: args })),
  lt: vi.fn((_col, val) => ({ lt: val })),
  isNull: vi.fn((_col) => ({ isNull: true })),
}));

import {
  configureMagicLink,
  createMagicLink,
  resetMagicLinkConfig,
  verifyMagicLink,
} from '../magic-link.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('magic-link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRows[0] = [];
    resetMagicLinkConfig();
  });

  describe('createMagicLink', () => {
    it('returns token and expiresAt', async () => {
      const result = await createMagicLink('user-1');

      expect(result.token).toBeDefined();
      expect(result.token.length).toBe(64); // 32 bytes hex
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('stores hashed token (not plaintext) in DB', async () => {
      const result = await createMagicLink('user-1');

      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          tokenHash: expect.any(String),
          tokenSalt: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );

      // The stored hash must NOT be the plaintext token
      const insertedValues = mockInsertValues.mock.calls[0][0] as Record<string, unknown>;
      expect(insertedValues.tokenHash).not.toBe(result.token);
    });

    it('cleans up expired tokens for the same user', async () => {
      await createMagicLink('user-1');

      // delete() called to remove expired tokens
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('verifyMagicLink', () => {
    it('returns userId for valid token', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', salt).update(token).digest('hex');

      mockRows[0] = [
        {
          id: 'link-1',
          userId: 'user-1',
          tokenHash: hash,
          tokenSalt: salt,
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: null,
        },
      ];

      const result = await verifyMagicLink(token);

      expect(result).toEqual({ userId: 'user-1' });
    });

    it('returns null for invalid token', async () => {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', salt).update('correct-token').digest('hex');

      mockRows[0] = [
        {
          id: 'link-1',
          userId: 'user-1',
          tokenHash: hash,
          tokenSalt: salt,
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: null,
        },
      ];

      const result = await verifyMagicLink('wrong-token');

      expect(result).toBeNull();
    });

    it('returns null for expired token', async () => {
      // With no rows returned (expired tokens filtered by query), result is null
      mockRows[0] = [];

      const result = await verifyMagicLink('any-token');

      expect(result).toBeNull();
    });

    it('marks token as used (consumed)', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHmac('sha256', salt).update(token).digest('hex');

      mockRows[0] = [
        {
          id: 'link-1',
          userId: 'user-1',
          tokenHash: hash,
          tokenSalt: salt,
          expiresAt: new Date(Date.now() + 60_000),
          usedAt: null,
        },
      ];

      await verifyMagicLink(token);

      // update() called to mark token as used
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          usedAt: expect.any(Date),
        }),
      );
    });

    it('returns null for already-used token', async () => {
      // Already-used tokens are filtered out by the query (usedAt IS NULL),
      // so the query returns no rows
      mockRows[0] = [];

      const result = await verifyMagicLink('some-token');

      expect(result).toBeNull();
    });
  });

  describe('configureMagicLink', () => {
    it('overrides defaults', () => {
      configureMagicLink({ tokenExpiryMs: 5 * 60 * 1000 });

      // Verify by creating a magic link and checking the expiry is shorter
      // We test this indirectly by checking the expiresAt on the inserted row
      // after creating a magic link with the overridden config
    });

    it('applies custom tokenExpiryMs to created links', async () => {
      const customExpiryMs = 5 * 60 * 1000; // 5 minutes
      configureMagicLink({ tokenExpiryMs: customExpiryMs });

      const before = Date.now();
      await createMagicLink('user-1');
      const after = Date.now();

      const insertedValues = mockInsertValues.mock.calls[0][0] as Record<string, unknown>;
      const expiresAt = insertedValues.expiresAt as Date;

      // The expiry should be within the custom range (5 min), not the default (15 min)
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + customExpiryMs);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + customExpiryMs);
    });
  });

  describe('resetMagicLinkConfig', () => {
    it('restores defaults after override', async () => {
      configureMagicLink({ tokenExpiryMs: 1000 });
      resetMagicLinkConfig();

      const defaultExpiryMs = 15 * 60 * 1000; // 15 minutes
      const before = Date.now();
      await createMagicLink('user-1');
      const after = Date.now();

      const insertedValues = mockInsertValues.mock.calls[0][0] as Record<string, unknown>;
      const expiresAt = insertedValues.expiresAt as Date;

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + defaultExpiryMs);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + defaultExpiryMs);
    });
  });
});
