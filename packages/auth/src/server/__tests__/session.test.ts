/**
 * Session Infrastructure Tests
 *
 * Tests for createSession with expiresAt override and metadata support.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies (vi.mock is hoisted above imports by Vitest)
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Chain mocks for drizzle-orm query builder
const mockReturning = vi.fn();
const mockInsertValues = vi.fn().mockReturnValue({ returning: mockReturning });
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({
    insert: mockInsert,
  })),
}));

vi.mock('@revealui/db/schema', () => ({
  sessions: { tokenHash: 'tokenHash', expiresAt: 'expiresAt' },
  users: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: string, val: string) => ({ col, val })),
  and: vi.fn((...conditions: unknown[]) => conditions),
  gt: vi.fn((col: string, val: unknown) => ({ gt: col, val })),
  isNull: vi.fn((col: string) => ({ isNull: col })),
}));

import { createSession } from '../session.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-123',
    schemaVersion: '1',
    userId: 'user-123',
    tokenHash: 'hashed-token',
    userAgent: null,
    ipAddress: null,
    persistent: false,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    metadata: null,
    ...overrides,
  };
}

describe('createSession extensions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup drizzle chain mocks (clearAllMocks removes implementations)
    mockInsertValues.mockReturnValue({ returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockReturning.mockResolvedValue([makeSessionRow()]);
  });

  it('creates session with custom expiresAt', async () => {
    const customExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    mockReturning.mockResolvedValueOnce([makeSessionRow({ expiresAt: customExpiry })]);

    const result = await createSession('user-123', {
      expiresAt: customExpiry,
    });

    expect(result.token).toBeDefined();
    expect(result.session).toBeDefined();

    // Verify the session expiresAt is approximately 30 minutes from now
    const diffMs = result.session.expiresAt.getTime() - Date.now();
    const diffMinutes = diffMs / (60 * 1000);
    expect(diffMinutes).toBeGreaterThan(28);
    expect(diffMinutes).toBeLessThan(32);

    // Verify that insert was called with the custom expiresAt
    const insertCall = mockInsertValues.mock.calls[0][0];
    expect(insertCall.expiresAt).toBe(customExpiry);
  });

  it('creates session with metadata', async () => {
    const metadata = { recovery: true, method: 'totp' };

    mockReturning.mockResolvedValueOnce([makeSessionRow({ metadata })]);

    const result = await createSession('user-123', {
      metadata,
    });

    expect(result.token).toBeDefined();
    expect(result.session).toBeDefined();
    expect(result.session.metadata).toEqual({ recovery: true, method: 'totp' });

    // Verify that insert was called with the metadata
    const insertCall = mockInsertValues.mock.calls[0][0];
    expect(insertCall.metadata).toEqual(metadata);
  });

  it('falls back to default expiry without expiresAt (non-persistent = 1 day)', async () => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    mockReturning.mockResolvedValueOnce([makeSessionRow({ expiresAt: new Date(now + oneDay) })]);

    const result = await createSession('user-123', {
      persistent: false,
    });

    expect(result.token).toBeDefined();
    expect(result.session).toBeDefined();

    // Verify the insert was called with an expiresAt ~1 day from now (not custom)
    const insertCall = mockInsertValues.mock.calls[0][0];
    const insertExpiry = insertCall.expiresAt as Date;
    const diffMs = insertExpiry.getTime() - now;
    const diffHours = diffMs / (60 * 60 * 1000);

    // Should be approximately 24 hours (1 day), not 30 min or 7 days
    expect(diffHours).toBeGreaterThan(23);
    expect(diffHours).toBeLessThan(25);
  });

  it('falls back to default expiry without expiresAt (persistent = 7 days)', async () => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    mockReturning.mockResolvedValueOnce([makeSessionRow({ expiresAt: new Date(now + sevenDays) })]);

    const result = await createSession('user-123', {
      persistent: true,
    });

    expect(result.token).toBeDefined();
    expect(result.session).toBeDefined();

    // Verify the insert was called with an expiresAt ~7 days from now
    const insertCall = mockInsertValues.mock.calls[0][0];
    const insertExpiry = insertCall.expiresAt as Date;
    const diffMs = insertExpiry.getTime() - now;
    const diffDays = diffMs / (24 * 60 * 60 * 1000);

    // Should be approximately 7 days
    expect(diffDays).toBeGreaterThan(6.5);
    expect(diffDays).toBeLessThan(7.5);
  });

  it('sets metadata to null when not provided', async () => {
    mockReturning.mockResolvedValueOnce([makeSessionRow()]);

    await createSession('user-123');

    const insertCall = mockInsertValues.mock.calls[0][0];
    expect(insertCall.metadata).toBeNull();
  });
});
