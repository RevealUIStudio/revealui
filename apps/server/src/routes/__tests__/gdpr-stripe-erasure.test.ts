/**
 * I-2 — GDPR Article 17: Stripe customers.del called on erasure
 *
 * Verifies that the GDPR deletion handler calls stripe.customers.del when a
 * user with stripeCustomerId invokes their right to erasure. Also verifies
 * stripeDeletionStatus is updated correctly for success and failure cases.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const {
  mockCustomersDel,
  mockGetServices,
  mockAnonymizeUser,
  mockUpdateUserStripeDeletion,
  mockDeleteAllUserSessions,
  mockRequestDeletion,
  mockProcessDeletion,
  mockGetRequest,
  mockGetUserRequests,
  mockGrantConsent,
  mockRevokeConsent,
  mockGetUserConsents,
  mockHasConsent,
  mockGetStatistics,
  mockGetClient,
  mockDbSelect,
} = vi.hoisted(() => {
  const _del = vi.fn();
  const _services = vi.fn();
  return {
    mockCustomersDel: _del,
    mockGetServices: _services,
    mockAnonymizeUser: vi.fn().mockResolvedValue({ id: 'user-1', stripeCustomerId: 'cus_test' }),
    mockUpdateUserStripeDeletion: vi.fn().mockResolvedValue(undefined),
    mockDeleteAllUserSessions: vi.fn().mockResolvedValue(undefined),
    mockRequestDeletion: vi
      .fn()
      .mockResolvedValue({ id: 'del-1', userId: 'user-1', status: 'pending' }),
    mockProcessDeletion: vi
      .fn()
      .mockImplementation(
        async (_id: string, cb: (userId: string, cats: string[]) => Promise<unknown>) => {
          await cb('user-1', ['personal']);
        },
      ),
    mockGetRequest: vi
      .fn()
      .mockResolvedValue({ id: 'del-1', userId: 'user-1', status: 'completed' }),
    mockGetUserRequests: vi.fn().mockResolvedValue([]),
    mockGrantConsent: vi.fn().mockResolvedValue({}),
    mockRevokeConsent: vi.fn().mockResolvedValue(undefined),
    mockGetUserConsents: vi.fn().mockResolvedValue([]),
    mockHasConsent: vi.fn().mockResolvedValue(true),
    mockGetStatistics: vi.fn().mockResolvedValue({}),
    mockGetClient: vi.fn().mockReturnValue({}),
    mockDbSelect: vi.fn(),
  };
});

vi.mock('@revealui/auth/server', () => ({
  deleteAllUserSessions: mockDeleteAllUserSessions,
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/core/security', () => ({
  createConsentManager: () => ({
    grantConsent: mockGrantConsent,
    revokeConsent: mockRevokeConsent,
    getUserConsents: mockGetUserConsents,
    hasConsent: mockHasConsent,
    getStatistics: mockGetStatistics,
  }),
  createDataDeletionSystem: () => ({
    requestDeletion: mockRequestDeletion,
    processDeletion: mockProcessDeletion,
    getUserRequests: mockGetUserRequests,
    getRequest: mockGetRequest,
  }),
  createDataBreachManager: () => ({}),
}));

vi.mock('@revealui/db', () => ({
  getClient: mockGetClient,
}));

vi.mock('@revealui/db/schema', () => ({
  users: { id: 'users.id', stripeCustomerId: 'users.stripeCustomerId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_c, _v) => 'eq'),
}));

vi.mock('@revealui/db/queries/users', () => ({
  anonymizeUser: mockAnonymizeUser,
  updateUserStripeDeletion: mockUpdateUserStripeDeletion,
}));

vi.mock('../../lib/drizzle-gdpr-storage.js', () => ({
  DrizzleGDPRStorage: class {},
  DrizzleBreachStorage: class {},
}));

vi.mock('../../lib/services-loader.js', () => ({
  getServices: mockGetServices,
}));

import * as loggerModule from '@revealui/core/observability/logger';
import gdprApp from '../gdpr.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

function createApp(user?: UserContext): Hono {
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

const testUser: UserContext = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test',
  role: 'user',
};

function deletionPost(): Promise<Response> {
  const app = createApp(testUser);
  return app.request('/gdpr/deletion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories: ['personal'] }),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('I-2 — GDPR Article 17: stripe.customers.del called on erasure', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // DB select chain: returns user row with stripeCustomerId by default
    const chain = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue([{ stripeCustomerId: 'cus_test123' }]),
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    mockDbSelect.mockReturnValue(chain);
    mockGetClient.mockReturnValue({ select: mockDbSelect });

    mockAnonymizeUser.mockResolvedValue({ id: 'user-1' });
    mockUpdateUserStripeDeletion.mockResolvedValue(undefined);
    mockDeleteAllUserSessions.mockResolvedValue(undefined);
    mockRequestDeletion.mockResolvedValue({ id: 'del-1', userId: 'user-1', status: 'pending' });
    mockGetRequest.mockResolvedValue({ id: 'del-1', userId: 'user-1', status: 'completed' });
    mockProcessDeletion.mockImplementation(
      async (_id: string, cb: (userId: string, cats: string[]) => Promise<unknown>) => {
        await cb('user-1', ['personal']);
      },
    );

    mockCustomersDel.mockResolvedValue({ id: 'cus_test123', deleted: true });
    mockGetServices.mockResolvedValue({
      protectedStripe: { customers: { del: mockCustomersDel } },
    });
  });

  describe('user has stripeCustomerId — stripe.customers.del is called', () => {
    it('calls stripe.customers.del with the user stripeCustomerId', async () => {
      await deletionPost();
      expect(mockCustomersDel).toHaveBeenCalledWith('cus_test123');
    });

    it('sets stripeDeletionStatus to "deleted" on success', async () => {
      await deletionPost();
      expect(mockUpdateUserStripeDeletion).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        'deleted',
      );
    });

    it('returns 201 even when stripe.customers.del succeeds', async () => {
      const res = await deletionPost();
      expect(res.status).toBe(201);
    });
  });

  describe('stripe.customers.del fails — local anonymization still succeeds', () => {
    it('sets stripeDeletionStatus to "failed" when Stripe rejects the call', async () => {
      mockCustomersDel.mockRejectedValue(new Error('No such customer: cus_test123'));

      await deletionPost();

      expect(mockUpdateUserStripeDeletion).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        'failed',
      );
    });

    it('still anonymizes the local user record on Stripe failure', async () => {
      mockCustomersDel.mockRejectedValue(new Error('Stripe error'));

      await deletionPost();

      expect(mockAnonymizeUser).toHaveBeenCalledWith(expect.anything(), 'user-1');
    });

    it('still revokes sessions on Stripe failure', async () => {
      mockCustomersDel.mockRejectedValue(new Error('Stripe error'));

      await deletionPost();

      expect(mockDeleteAllUserSessions).toHaveBeenCalledWith('user-1');
    });

    it('still returns 201 on Stripe failure (local erasure completed)', async () => {
      mockCustomersDel.mockRejectedValue(new Error('Stripe error'));

      const res = await deletionPost();
      expect(res.status).toBe(201);
    });

    it('logs an error with userId and stripeCustomerId when Stripe fails', async () => {
      mockCustomersDel.mockRejectedValue(new Error('rate limit exceeded'));

      await deletionPost();

      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        expect.stringContaining('stripe.customers.del failed'),
        undefined,
        expect.objectContaining({ userId: 'user-1', stripeCustomerId: 'cus_test123' }),
      );
    });
  });

  describe('Stripe service unavailable — stripeDeletionStatus=failed', () => {
    it('sets status to "failed" when getServices returns null', async () => {
      mockGetServices.mockResolvedValue(null);

      await deletionPost();

      expect(mockUpdateUserStripeDeletion).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        'failed',
      );
    });

    it('does not call customers.del when services are unavailable', async () => {
      mockGetServices.mockResolvedValue(null);

      await deletionPost();

      expect(mockCustomersDel).not.toHaveBeenCalled();
    });
  });

  describe('user has no stripeCustomerId — no Stripe call', () => {
    it('does not call stripe.customers.del when stripeCustomerId is null', async () => {
      const chain = {
        from: vi.fn(),
        where: vi.fn(),
        limit: vi.fn().mockResolvedValue([{ stripeCustomerId: null }]),
      };
      chain.from.mockReturnValue(chain);
      chain.where.mockReturnValue(chain);
      mockDbSelect.mockReturnValue(chain);
      mockGetClient.mockReturnValue({ select: mockDbSelect });

      await deletionPost();

      expect(mockCustomersDel).not.toHaveBeenCalled();
    });

    it('does not update stripeDeletionStatus when stripeCustomerId is null', async () => {
      const chain = {
        from: vi.fn(),
        where: vi.fn(),
        limit: vi.fn().mockResolvedValue([{ stripeCustomerId: null }]),
      };
      chain.from.mockReturnValue(chain);
      chain.where.mockReturnValue(chain);
      mockDbSelect.mockReturnValue(chain);
      mockGetClient.mockReturnValue({ select: mockDbSelect });

      await deletionPost();

      expect(mockUpdateUserStripeDeletion).not.toHaveBeenCalled();
    });

    it('returns 201 for users without Stripe customer', async () => {
      const chain = {
        from: vi.fn(),
        where: vi.fn(),
        limit: vi.fn().mockResolvedValue([{ stripeCustomerId: null }]),
      };
      chain.from.mockReturnValue(chain);
      chain.where.mockReturnValue(chain);
      mockDbSelect.mockReturnValue(chain);
      mockGetClient.mockReturnValue({ select: mockDbSelect });

      const res = await deletionPost();
      expect(res.status).toBe(201);
    });
  });
});
