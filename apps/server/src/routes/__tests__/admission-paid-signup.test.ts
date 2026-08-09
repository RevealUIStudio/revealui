/**
 * GAP-256 PR-4b — paid_signup escape (HC4 bypass waitlist, HC15 paid-pending).
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const admitFreeIntake = vi.fn();
const isSignupAllowed = vi.fn(() => true);
const signUp = vi.fn();
const ensurePaidPendingEntitlement = vi.fn();
const assertLiveCatalogComplete = vi.fn();
const resolveCatalogPriceId = vi.fn();
const ensureStripeCustomer = vi.fn();
const getEarlyAdopterDiscount = vi.fn(() => ({}));
const stripePriceIsUsable = vi.fn(async () => false);
const withStripe = vi.fn();

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// zValidator: parse JSON body into c.req.valid('json') without openapi package build.
vi.mock('@revealui/openapi', () => ({
  zValidator: (_target: string, schema: { parse: (v: unknown) => unknown }) => {
    return async (
      c: { req: { json: () => Promise<unknown>; valid: (k: string) => unknown } },
      next: () => Promise<void>,
    ) => {
      const body = await c.req.json();
      const parsed = schema.parse(body);
      c.req.valid = (key: string) => {
        if (key === 'json') return parsed;
        throw new Error(`valid(${key}) not stubbed`);
      };
      await next();
    };
  },
}));

vi.mock('@revealui/auth/server', () => ({
  admitFreeIntake: (...a: unknown[]) => admitFreeIntake(...a),
  isSignupAllowed: (...a: unknown[]) => isSignupAllowed(...a),
  signUp: (...a: unknown[]) => signUp(...a),
}));

vi.mock('../../lib/ensure-paid-pending-entitlement.js', () => ({
  ensurePaidPendingEntitlement: (...a: unknown[]) => ensurePaidPendingEntitlement(...a),
}));

vi.mock('../billing/helpers.js', () => ({
  assertLiveCatalogComplete: (...a: unknown[]) => assertLiveCatalogComplete(...a),
  resolveCatalogPriceId: (...a: unknown[]) => resolveCatalogPriceId(...a),
  ensureStripeCustomer: (...a: unknown[]) => ensureStripeCustomer(...a),
  getEarlyAdopterDiscount: (...a: unknown[]) => getEarlyAdopterDiscount(...a),
  isStripeTaxEnabled: false,
  TRIAL_PERIOD_DAYS: 7,
  stripePriceIsUsable: (...a: unknown[]) => stripePriceIsUsable(...a),
  withStripe: (...a: unknown[]) => withStripe(...a),
}));

import paidSignupRoute from '../admission/paid-signup.js';

function createApp() {
  const app = new Hono();
  app.route('/admission', paidSignupRoute);
  return app;
}

const validBody = {
  email: 'payer@example.com',
  password: 'SecurePass123',
  name: 'Paying User',
  tier: 'pro' as const,
};

describe('POST /admission/paid-signup (HC4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSignupAllowed.mockReturnValue(true);
    process.env.ADMIN_URL = 'https://admin.example.com';
    admitFreeIntake.mockResolvedValue({
      decision: 'admit',
      mode: 'bypass',
      cohortLimits: { maxSites: 1, maxUsers: 1, maxAgentTasks: 0 },
      snapshotId: 'snap-waitlist',
      reason: 'paying_bypass',
      shadow: false,
      flags: { enabled: true, shadow: false, staleHours: 36 },
    });
    signUp.mockResolvedValue({
      success: true,
      user: { id: 'user-1', email: 'payer@example.com' },
      sessionToken: 'sess-token',
    });
    ensurePaidPendingEntitlement.mockResolvedValue({ accountId: 'acct-1' });
    assertLiveCatalogComplete.mockResolvedValue(undefined);
    resolveCatalogPriceId.mockResolvedValue('price_pro_month');
    ensureStripeCustomer.mockResolvedValue('cus_1');
    withStripe.mockImplementation(async (fn: (stripe: unknown) => Promise<unknown>) => {
      return fn({
        checkout: {
          sessions: {
            create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.test/session' }),
          },
        },
      });
    });
  });

  it('creates user under waitlist mode via paid_signup channel (HC4)', async () => {
    const res = await createApp().request('/admission/paid-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.user.id).toBe('user-1');
    expect(json.sessionToken).toBe('sess-token');
    expect(json.checkoutUrl).toBe('https://checkout.stripe.test/session');

    expect(admitFreeIntake).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'paid_signup',
        email: 'payer@example.com',
        payingIntent: { kind: 'checkout', tier: 'pro' },
      }),
    );
    expect(signUp).toHaveBeenCalled();
    expect(ensurePaidPendingEntitlement).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        pendingTier: 'pro',
      }),
    );
  });

  it('returns 502 with session when Stripe fails after user create (no free AI path)', async () => {
    withStripe.mockRejectedValue(new Error('Stripe unavailable'));

    const res = await createApp().request('/admission/paid-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.user.id).toBe('user-1');
    expect(json.sessionToken).toBe('sess-token');
    expect(json.checkoutUrl).toBeNull();
    expect(json.checkoutError).toBe(true);
    expect(ensurePaidPendingEntitlement).toHaveBeenCalled();
  });

  it('provisions paid-pending entitlement and never free signup path', async () => {
    await createApp().request('/admission/paid-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    expect(ensurePaidPendingEntitlement).toHaveBeenCalledTimes(1);
  });
});
