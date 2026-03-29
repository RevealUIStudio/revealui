import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerDebugMock = vi.fn();
const loggerErrorMock = vi.fn();
const createServerClientFromRequestMock = vi.fn();
const createOrRetrieveCustomerMock = vi.fn();
const getURLMock = vi.fn();
const checkoutCreateMock = vi.fn();
const portalCreateMock = vi.fn();

vi.mock('@revealui/core/utils/logger', () => ({
  logger: {
    debug: loggerDebugMock,
    error: loggerErrorMock,
  },
}));

vi.mock('../src/supabase/index.js', () => ({
  createServerClientFromRequest: createServerClientFromRequestMock,
}));

vi.mock('../src/stripe/stripeClient.js', () => ({
  protectedStripe: {
    checkout: {
      sessions: {
        create: checkoutCreateMock,
      },
    },
    billingPortal: {
      sessions: {
        create: portalCreateMock,
      },
    },
  },
}));

vi.mock('../src/api/utils.js', () => ({
  createOrRetrieveCustomer: createOrRetrieveCustomerMock,
  getURL: getURLMock,
}));

describe('services API entrypoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getURLMock.mockReturnValue('https://revealui.test');
  });

  describe('create-checkout-session POST', () => {
    it('returns 500 when the Supabase client is unavailable', async () => {
      createServerClientFromRequestMock.mockReturnValue(null);

      const { POST } = await import('../src/api/create-checkout-session/index.js');
      const response = await POST(
        new Request('https://revealui.test/api/checkout', {
          method: 'POST',
          body: JSON.stringify({ price: { id: 'price_basic' } }),
        }),
      );

      await expect(response.text()).resolves.toBe('Supabase client not available');
      expect(response.status).toBe(500);
      expect(createOrRetrieveCustomerMock).not.toHaveBeenCalled();
    });

    it('creates a checkout session and returns the session id', async () => {
      createServerClientFromRequestMock.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'user_123',
                email: 'test@example.com',
              },
            },
          }),
        },
      });
      createOrRetrieveCustomerMock.mockResolvedValue({ stripe_customer_id: 'cus_123' });
      checkoutCreateMock.mockResolvedValue({ id: 'cs_123' });

      const { POST } = await import('../src/api/create-checkout-session/index.js');
      const response = await POST(
        new Request('https://revealui.test/api/checkout', {
          method: 'POST',
          body: JSON.stringify({
            price: { id: 'price_basic' },
            quantity: 2,
            metadata: { plan: 'pro' },
          }),
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ sessionId: 'cs_123' });
      expect(createOrRetrieveCustomerMock).toHaveBeenCalledWith({
        uuid: 'user_123',
        email: 'test@example.com',
        supabase: expect.any(Object),
      });
      expect(checkoutCreateMock).toHaveBeenCalledWith({
        payment_method_types: ['card'],
        billing_address_collection: 'required',
        customer: 'cus_123',
        line_items: [
          {
            price: 'price_basic',
            quantity: 2,
          },
        ],
        mode: 'subscription',
        allow_promotion_codes: true,
        subscription_data: {
          trial_period_days: 7,
          metadata: { plan: 'pro' },
        },
        success_url: 'https://revealui.test/account',
        cancel_url: 'https://revealui.test/',
      });
    });
  });

  describe('create-portal-link POST', () => {
    it('returns 500 when the Supabase client is unavailable', async () => {
      createServerClientFromRequestMock.mockReturnValue(null);

      const { POST } = await import('../src/api/create-portal-link/index.js');
      const response = await POST(
        new Request('https://revealui.test/api/portal', { method: 'POST' }),
      );

      await expect(response.text()).resolves.toBe('Supabase client not available');
      expect(response.status).toBe(500);
      expect(portalCreateMock).not.toHaveBeenCalled();
    });

    it('creates a billing portal link for the authenticated user', async () => {
      createServerClientFromRequestMock.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'user_123',
                email: 'test@example.com',
              },
            },
          }),
        },
      });
      createOrRetrieveCustomerMock.mockResolvedValue('cus_123');
      portalCreateMock.mockResolvedValue({ url: 'https://billing.stripe.test/session' });

      const { POST } = await import('../src/api/create-portal-link/index.js');
      const response = await POST(
        new Request('https://revealui.test/api/portal', { method: 'POST' }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        url: 'https://billing.stripe.test/session',
      });
      expect(createOrRetrieveCustomerMock).toHaveBeenCalledWith({
        uuid: 'user_123',
        email: 'test@example.com',
        supabase: expect.any(Object),
      });
      expect(portalCreateMock).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: 'https://revealui.test/account',
      });
    });
  });
});
