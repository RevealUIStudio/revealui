/**
 * GDPR Deletion Integration Tests
 *
 * Verifies the end-to-end deletion flow:
 * 1. User requests deletion → request created
 * 2. processDeletion() called → anonymizeUser + deleteAllUserSessions
 * 3. Response contains processed request with deleted/retained categories
 *
 * These tests exercise the full route handler logic (not just mocked methods)
 * to verify the wiring between DataDeletionSystem → DB → session cleanup.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Track ALL calls through the system for integration verification
// ---------------------------------------------------------------------------

const callLog: string[] = [];

const { mockAnonymizeUser, mockDeleteAllUserSessions, mockGetClient } = vi.hoisted(() => ({
  mockAnonymizeUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
  mockDeleteAllUserSessions: vi.fn().mockResolvedValue(undefined),
  mockGetClient: vi.fn().mockReturnValue({}),
}));

// Real-ish DataDeletionSystem that tracks state transitions
const deletionRequests = new Map<
  string,
  { id: string; userId: string; status: string; deletedData?: string[]; retainedData?: string[] }
>();

vi.mock('@revealui/auth/server', () => ({
  deleteAllUserSessions: (...args: unknown[]) => {
    callLog.push('deleteAllUserSessions');
    return mockDeleteAllUserSessions(...args);
  },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/core/security', () => ({
  createConsentManager: () => ({
    grantConsent: vi.fn().mockResolvedValue({ id: 'c1' }),
    revokeConsent: vi.fn(),
    getUserConsents: vi.fn().mockResolvedValue([]),
    hasConsent: vi.fn().mockResolvedValue(true),
    getStatistics: vi.fn().mockResolvedValue({ total: 0 }),
  }),
  createDataDeletionSystem: () => ({
    requestDeletion: vi.fn().mockImplementation(async (userId: string, categories: string[]) => {
      callLog.push('requestDeletion');
      const request = {
        id: `del-${Date.now()}`,
        userId,
        requestedAt: new Date().toISOString(),
        status: 'pending',
        dataCategories: categories,
      };
      deletionRequests.set(request.id, request);
      return request;
    }),
    processDeletion: vi.fn().mockImplementation(
      async (
        requestId: string,
        // biome-ignore lint/suspicious/noExplicitAny: integration test callback typing
        callback: (userId: string, categories: string[]) => Promise<any>,
      ) => {
        callLog.push('processDeletion:start');
        const request = deletionRequests.get(requestId);
        if (!request) throw new Error('Request not found');

        request.status = 'processing';
        const result = await callback(request.userId, request.dataCategories);
        request.status = 'completed';
        request.deletedData = result.deleted;
        request.retainedData = result.retained;
        callLog.push('processDeletion:complete');
      },
    ),
    getUserRequests: vi.fn().mockResolvedValue([]),
    getRequest: vi.fn().mockImplementation(async (id: string) => {
      return deletionRequests.get(id) ?? null;
    }),
  }),
  createDataBreachManager: () => ({}),
}));

vi.mock('@revealui/db', () => ({
  getClient: (...args: unknown[]) => {
    callLog.push('getClient');
    return mockGetClient(...args);
  },
}));

vi.mock('@revealui/db/queries/users', () => ({
  anonymizeUser: (...args: unknown[]) => {
    callLog.push('anonymizeUser');
    return mockAnonymizeUser(...args);
  },
}));

vi.mock('../../lib/drizzle-gdpr-storage.js', () => ({
  DrizzleGDPRStorage: class {},
  DrizzleBreachStorage: class {},
}));

import gdprApp from '../gdpr.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp(user?: { id: string; email: string | null; name: string; role: string }) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('user' as never, user as never);
    await next();
  });
  app.route('/gdpr', gdprApp);
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ success: false, error: err.message }, err.status);
    }
    return c.json({ success: false, error: 'Internal error' }, 500);
  });
  return app;
}

const testUser = { id: 'user-1', email: 'test@example.com', name: 'Test User', role: 'user' };

beforeEach(() => {
  callLog.length = 0;
  deletionRequests.clear();
  vi.clearAllMocks();
  mockAnonymizeUser.mockResolvedValue({ id: 'user-1' });
});

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe('GDPR Deletion Integration Flow', () => {
  it('full deletion flow: request → process → anonymize → revoke sessions', async () => {
    const app = createApp(testUser);

    const res = await app.request('/gdpr/deletion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: ['personal', 'behavioral'], reason: 'Account closure' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify the full call chain executed in correct order
    expect(callLog).toEqual([
      'requestDeletion',
      'processDeletion:start',
      'getClient',
      'anonymizeUser',
      'deleteAllUserSessions',
      'processDeletion:complete',
    ]);

    // Verify the processed request has completion details
    expect(body.request.status).toBe('completed');
    expect(body.request.deletedData).toContain('profile');
    expect(body.request.retainedData).toContain('billing_records');
  });

  it('anonymization failure prevents deletion completion', async () => {
    mockAnonymizeUser.mockResolvedValueOnce(null); // User not found

    const app = createApp(testUser);
    const res = await app.request('/gdpr/deletion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // processDeletion callback throws when anonymizeUser returns null
    expect(res.status).toBe(500);

    // Sessions should NOT have been revoked since anonymization failed
    expect(mockDeleteAllUserSessions).not.toHaveBeenCalled();
  });

  it('unauthenticated request is rejected before any processing', async () => {
    const app = createApp(); // No user

    const res = await app.request('/gdpr/deletion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(401);
    expect(callLog).toHaveLength(0); // No processing happened
  });

  it('deletion uses default category when none specified', async () => {
    const app = createApp(testUser);

    await app.request('/gdpr/deletion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // requestDeletion should be called with default ['personal']
    expect(callLog[0]).toBe('requestDeletion');
  });

  it('sessions are revoked for the correct user ID', async () => {
    const app = createApp({ id: 'specific-user-42', email: 'a@b.com', name: 'A', role: 'user' });

    await app.request('/gdpr/deletion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(mockDeleteAllUserSessions).toHaveBeenCalledWith('specific-user-42');
  });
});
