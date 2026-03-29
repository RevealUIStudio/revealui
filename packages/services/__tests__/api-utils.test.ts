/**
 * API Utilities Tests
 *
 * Tests the utility functions in packages/services/src/api/utils.ts:
 * - createClient() — creates Supabase server client from request context
 * - getURL() — URL resolution for the current module path
 * - createStripeCustomer() — creates or retrieves Stripe customer by email
 */

import type { RevealRequest } from '@revealui/core';
import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreateServerClient = vi.fn().mockReturnValue({ from: vi.fn() });

vi.mock('../src/supabase/index.js', () => ({
  default: vi.fn(),
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

const mockStripeCustomersList = vi.fn();
const mockStripeCustomersCreate = vi.fn();

vi.mock('../src/stripe/stripeClient.js', () => ({
  protectedStripe: {
    customers: {
      list: (...args: unknown[]) => mockStripeCustomersList(...args),
      create: (...args: unknown[]) => mockStripeCustomersCreate(...args),
    },
  },
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@revealui/config', () => ({
  default: {
    stripe: { secretKey: 'sk_test_mock' },
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('API Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createClient', () => {
    it('creates a Supabase server client from request context', async () => {
      const { createClient } = await import('../src/api/utils.js');

      const mockReq = {} as import('node:http').IncomingMessage;
      const mockRes = {} as import('node:http').ServerResponse;
      const context = { req: mockReq, res: mockRes };

      createClient(context);

      expect(mockCreateServerClient).toHaveBeenCalledOnce();
      expect(mockCreateServerClient).toHaveBeenCalledWith(context);
    });
  });

  describe('getURL', () => {
    it('returns a URL string ending with a slash', async () => {
      const { getURL } = await import('../src/api/utils.js');
      const url = getURL();

      expect(typeof url).toBe('string');
      expect(url.endsWith('/')).toBe(true);
    });

    it('prefixes with https:// when path does not contain http', async () => {
      const { getURL } = await import('../src/api/utils.js');
      const url = getURL();

      expect(url.startsWith('https://')).toBe(true);
    });
  });

  describe('createStripeCustomer', () => {
    it('returns data unchanged when operation is not create', async () => {
      const { createStripeCustomer } = await import('../src/api/utils.js');

      const data = { email: 'test@example.com' };
      const req = { revealui: null } as unknown as RevealRequest;

      const result = await createStripeCustomer({ req, data, operation: 'update' });

      expect(result).toEqual(data);
      expect(mockStripeCustomersList).not.toHaveBeenCalled();
      expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
    });

    it('returns data unchanged when stripeCustomerID already exists', async () => {
      const { createStripeCustomer } = await import('../src/api/utils.js');

      const data = { email: 'test@example.com', stripeCustomerID: 'cus_existing' };
      const req = { revealui: null } as unknown as RevealRequest;

      const result = await createStripeCustomer({ req, data, operation: 'create' });

      expect(result).toEqual(data);
      expect(mockStripeCustomersList).not.toHaveBeenCalled();
    });

    it('returns data unchanged when email is not a string', async () => {
      const { createStripeCustomer } = await import('../src/api/utils.js');

      const data = { email: undefined };
      const req = { revealui: null } as unknown as RevealRequest;

      const result = await createStripeCustomer({ req, data, operation: 'create' });

      expect(result).toEqual(data);
      expect(mockStripeCustomersList).not.toHaveBeenCalled();
    });

    it('retrieves existing Stripe customer by email', async () => {
      const { createStripeCustomer } = await import('../src/api/utils.js');

      mockStripeCustomersList.mockResolvedValueOnce({
        data: [{ id: 'cus_existing_123' }],
      });

      const data = { email: 'existing@example.com' };
      const req = { revealui: null } as unknown as RevealRequest;

      const result = await createStripeCustomer({ req, data, operation: 'create' });

      expect(result).toEqual({
        email: 'existing@example.com',
        stripeCustomerID: 'cus_existing_123',
      });
      expect(mockStripeCustomersList).toHaveBeenCalledWith({
        email: 'existing@example.com',
        limit: 1,
      });
      expect(mockStripeCustomersCreate).not.toHaveBeenCalled();
    });

    it('creates a new Stripe customer when none exists', async () => {
      const { createStripeCustomer } = await import('../src/api/utils.js');

      mockStripeCustomersList.mockResolvedValueOnce({ data: [] });
      mockStripeCustomersCreate.mockResolvedValueOnce({
        id: 'cus_new_456',
      } as Stripe.Customer);

      const data = { email: 'new@example.com' };
      const req = { revealui: null } as unknown as RevealRequest;

      const result = await createStripeCustomer({ req, data, operation: 'create' });

      expect(result).toEqual({
        email: 'new@example.com',
        stripeCustomerID: 'cus_new_456',
      });
      expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
        email: 'new@example.com',
      });
    });

    it('returns original data on Stripe API error (uses revealui logger)', async () => {
      const { createStripeCustomer } = await import('../src/api/utils.js');

      mockStripeCustomersList.mockRejectedValueOnce(new Error('Stripe API error'));

      const mockRevealuiLogger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
      const data = { email: 'error@example.com' };
      const req = {
        revealui: { logger: mockRevealuiLogger },
      } as unknown as RevealRequest;

      const result = await createStripeCustomer({ req, data, operation: 'create' });

      expect(result).toEqual(data);
      expect(mockRevealuiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating Stripe customer'),
      );
    });

    it('returns original data on Stripe API error (uses fallback logger)', async () => {
      const { createStripeCustomer } = await import('../src/api/utils.js');
      const { logger } = await import('@revealui/core/utils/logger');

      mockStripeCustomersList.mockRejectedValueOnce(new Error('Connection failed'));

      const data = { email: 'error@example.com' };
      const req = { revealui: null } as unknown as RevealRequest;

      const result = await createStripeCustomer({ req, data, operation: 'create' });

      expect(result).toEqual(data);
      expect(logger.error).toHaveBeenCalledWith('Error creating Stripe customer', {
        error: 'Connection failed',
      });
    });

    it('handles non-Error thrown values gracefully', async () => {
      const { createStripeCustomer } = await import('../src/api/utils.js');

      mockStripeCustomersList.mockRejectedValueOnce('string error');

      const data = { email: 'error@example.com' };
      const req = { revealui: null } as unknown as RevealRequest;

      const result = await createStripeCustomer({ req, data, operation: 'create' });

      expect(result).toEqual(data);
    });
  });
});
