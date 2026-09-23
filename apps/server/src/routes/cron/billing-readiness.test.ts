/**
 * Tests for the billing-readiness cron's Stripe price parity check
 * (CR8-P2-04) and Stripe Tax flag check (GAP-437).
 *
 * The cron response only surfaces FAILED checks in `body.failures`, so the
 * tests assert:
 *   - parity pass → no `stripe:price:*` entries in `failures`
 *   - parity fail → `stripe:price:<tier>` in `failures` with the detail
 *
 * Price parity covers:
 *   1. Parity pass — Stripe unit_amount matches MRR fallback
 *   2. Parity fail — Stripe unit_amount differs (hard-fail check)
 *   3. Null unit_amount — Stripe returned a free-form / tiered price
 *   4. Stripe lookup error — prices.retrieve throws (deleted / network)
 *   5. Missing env var — tier is skipped (earlier check already flags)
 *
 * Stripe Tax flag (GAP-437) covers:
 *   1. Live mode + active + flag off → alerts (stripe:tax-flag in failures)
 *   2. Live mode + active + flag on → silent (ok:true, not in failures)
 *   3. Live mode + pending status → silent (ok:true, not in failures)
 *   4. Stripe API error → tolerated (surfaces as a warning, not a failure)
 *   5. Not live mode → check skipped entirely (no stripe:tax-flag entry)
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MRR_TIER_PRICE_FALLBACK_CENTS } from '../../lib/tier-pricing.js';

// --- Module mocks ---

const mockRetrieve = vi.fn();
const mockTaxSettingsRetrieve = vi.fn();

vi.mock('stripe', () => ({
  default: class MockStripe {
    prices = { retrieve: mockRetrieve };
    tax = { settings: { retrieve: mockTaxSettingsRetrieve } };
  },
}));

// GAP-131: billing-readiness now uses the protectedStripe wrapper from
// @revealui/services for Stripe price parity + Tax Settings checks.
vi.mock('@revealui/services', () => ({
  protectedStripe: {
    prices: { retrieve: mockRetrieve },
    tax: { settings: { retrieve: mockTaxSettingsRetrieve } },
  },
}));

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  billingCatalog: { planId: 'plan_id', stripePriceId: 'stripe_price_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => [a, b],
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../lib/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

// Billing catalog mock — return rows for every EXPECTED_PLAN_IDS entry so
// section 3 passes cleanly and isn't the source of failures in these tests.
const mockDb = {
  select: vi.fn(() => mockDb),
  from: vi.fn(() =>
    Promise.resolve([
      { planId: 'subscription:pro', stripePriceId: 'price_pro' },
      { planId: 'subscription:max', stripePriceId: 'price_max' },
      { planId: 'subscription:enterprise', stripePriceId: 'price_enterprise' },
      { planId: 'perpetual:pro', stripePriceId: 'price_perp_pro' },
      { planId: 'perpetual:max', stripePriceId: 'price_perp_max' },
      { planId: 'perpetual:enterprise', stripePriceId: 'price_perp_enterprise' },
      { planId: 'credits:starter', stripePriceId: 'price_credits_starter' },
      { planId: 'credits:standard', stripePriceId: 'price_credits_standard' },
      { planId: 'credits:scale', stripePriceId: 'price_credits_scale' },
    ]),
  ),
};

// --- Setup ---

const CRON_SECRET = 'test-cron-secret-long-enough-32chars!';

interface CronBody {
  status: 'ok' | 'failed';
  checkCount: number;
  failureCount: number;
  failures: Array<{ check: string; detail: string }>;
  warningCount: number;
  warnings: Array<{ check: string; detail: string }>;
  checkedAt: string;
}

// First import pulls @revealui/core/license/mint-client. On a cold Vite
// transform that exceeds the 15s test budget, so warm it under a longer hook.
beforeAll(async () => {
  await import('./billing-readiness.js');
}, 60_000);

beforeEach(() => {
  vi.resetAllMocks();
  mockDb.select.mockReturnValue(mockDb);

  process.env.REVEALUI_CRON_SECRET = CRON_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';
  process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'mock_priv_key';
  delete process.env.REVEALUI_LICENSE_SIGN_VIA_SIGNER;
  delete process.env.REVEALUI_LICENSE_SIGNER_URL;
  delete process.env.REVEALUI_LICENSE_PUBLIC_KEY;
  delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
  delete process.env.REVEALUI_SIGNER_INVOKE_SECRET;
  process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
  process.env.STRIPE_MAX_PRICE_ID = 'price_max';
  process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_enterprise';
  // GAP-437: default to not-live so the price-parity tests above (which
  // predate this check) are unaffected; the tax-flag describe block below
  // sets STRIPE_LIVE_MODE='true' explicitly per test.
  delete process.env.STRIPE_LIVE_MODE;
  delete process.env.STRIPE_TAX_ENABLED;

  // Default: every price matches the fallback (parity pass)
  mockRetrieve.mockImplementation((id: string) => {
    const tierMap: Record<string, keyof typeof MRR_TIER_PRICE_FALLBACK_CENTS> = {
      price_pro: 'pro',
      price_max: 'max',
      price_enterprise: 'enterprise',
    };
    const tier = tierMap[id];
    if (!tier) throw new Error(`no mock for ${id}`);
    return Promise.resolve({ id, unit_amount: MRR_TIER_PRICE_FALLBACK_CENTS[tier] });
  });

  // Default Tax Settings mock: pending (steady state, never alerts).
  mockTaxSettingsRetrieve.mockImplementation(() => Promise.resolve({ status: 'pending' }));
});

// Dynamic import to respect the env/module mocks above.
async function callCron(): Promise<{ status: number; body: CronBody }> {
  const { default: app } = await import('./billing-readiness.js');
  const res = await app.request('/billing-readiness', {
    method: 'POST',
    headers: { 'X-Cron-Secret': CRON_SECRET },
  });
  return { status: res.status, body: (await res.json()) as CronBody };
}

// --- Tests ---

describe('billing-readiness cron — Stripe price parity (CR8-P2-04)', () => {
  it('parity pass: no stripe:price:* entries in failures', async () => {
    const { body } = await callCron();
    const priceFailures = body.failures.filter((f) => f.check.startsWith('stripe:price:'));
    expect(priceFailures).toHaveLength(0);
  });

  it('parity fail: pro unit_amount drifts → stripe:price:pro in failures', async () => {
    mockRetrieve.mockImplementation((id: string) => {
      if (id === 'price_pro') return Promise.resolve({ id, unit_amount: 5900 }); // drift from 4900
      const tierMap: Record<string, keyof typeof MRR_TIER_PRICE_FALLBACK_CENTS> = {
        price_max: 'max',
        price_enterprise: 'enterprise',
      };
      const tier = tierMap[id];
      return Promise.resolve({ id, unit_amount: MRR_TIER_PRICE_FALLBACK_CENTS[tier!] });
    });

    const { body } = await callCron();
    const pro = body.failures.find((f) => f.check === 'stripe:price:pro');
    expect(pro).toBeDefined();
    expect(pro?.detail).toContain('5900');
    expect(pro?.detail).toContain('4900');
  });

  it('null unit_amount → check fails with tiered-price message', async () => {
    mockRetrieve.mockImplementation((id: string) => {
      if (id === 'price_pro') return Promise.resolve({ id, unit_amount: null });
      const tierMap: Record<string, keyof typeof MRR_TIER_PRICE_FALLBACK_CENTS> = {
        price_max: 'max',
        price_enterprise: 'enterprise',
      };
      const tier = tierMap[id];
      return Promise.resolve({ id, unit_amount: MRR_TIER_PRICE_FALLBACK_CENTS[tier!] });
    });

    const { body } = await callCron();
    const pro = body.failures.find((f) => f.check === 'stripe:price:pro');
    expect(pro).toBeDefined();
    expect(pro?.detail).toMatch(/no unit_amount|tiered|free-form/);
  });

  it('Stripe lookup error → check fails with lookup-failed detail', async () => {
    mockRetrieve.mockImplementation((id: string) => {
      if (id === 'price_max') return Promise.reject(new Error('resource_missing'));
      const tierMap: Record<string, keyof typeof MRR_TIER_PRICE_FALLBACK_CENTS> = {
        price_pro: 'pro',
        price_enterprise: 'enterprise',
      };
      const tier = tierMap[id];
      return Promise.resolve({ id, unit_amount: MRR_TIER_PRICE_FALLBACK_CENTS[tier!] });
    });

    const { body } = await callCron();
    const max = body.failures.find((f) => f.check === 'stripe:price:max');
    expect(max).toBeDefined();
    expect(max?.detail).toContain('lookup failed');
    expect(max?.detail).toContain('resource_missing');
  });

  it('missing env var → parity check skipped; env-var failure still surfaced', async () => {
    delete process.env.STRIPE_ENTERPRISE_PRICE_ID;

    const { body } = await callCron();
    // No stripe:price:enterprise parity entry because we skip when env-var missing.
    const enterpriseParity = body.failures.find((f) => f.check === 'stripe:price:enterprise');
    expect(enterpriseParity).toBeUndefined();
    // But the missing env var IS flagged by section 1.
    const envCheck = body.failures.find((f) => f.check === 'env:STRIPE_ENTERPRISE_PRICE_ID');
    expect(envCheck).toBeDefined();
    expect(envCheck?.detail).toBe('MISSING');
  });
});

describe('billing-readiness cron — Stripe Tax flag (GAP-437)', () => {
  it('live + active + flag off → alerts (stripe:tax-flag in failures)', async () => {
    process.env.STRIPE_LIVE_MODE = 'true';
    delete process.env.STRIPE_TAX_ENABLED;
    mockTaxSettingsRetrieve.mockResolvedValue({ status: 'active' });

    const { body } = await callCron();
    const taxCheck = body.failures.find((f) => f.check === 'stripe:tax-flag');
    expect(taxCheck).toBeDefined();
    expect(taxCheck?.detail).toMatch(/STRIPE_TAX_ENABLED/);
    expect(body.status).toBe('failed');
  });

  it('live + active + flag "false" → alerts (same as unset)', async () => {
    process.env.STRIPE_LIVE_MODE = 'true';
    process.env.STRIPE_TAX_ENABLED = 'false';
    mockTaxSettingsRetrieve.mockResolvedValue({ status: 'active' });

    const { body } = await callCron();
    const taxCheck = body.failures.find((f) => f.check === 'stripe:tax-flag');
    expect(taxCheck).toBeDefined();
  });

  it('live + active + flag on → silent (no failure, ok entry only)', async () => {
    process.env.STRIPE_LIVE_MODE = 'true';
    process.env.STRIPE_TAX_ENABLED = 'true';
    mockTaxSettingsRetrieve.mockResolvedValue({ status: 'active' });

    const { body } = await callCron();
    const taxFailure = body.failures.find((f) => f.check === 'stripe:tax-flag');
    expect(taxFailure).toBeUndefined();
  });

  it('live + pending status → silent regardless of flag', async () => {
    process.env.STRIPE_LIVE_MODE = 'true';
    delete process.env.STRIPE_TAX_ENABLED;
    mockTaxSettingsRetrieve.mockResolvedValue({ status: 'pending' });

    const { body } = await callCron();
    const taxFailure = body.failures.find((f) => f.check === 'stripe:tax-flag');
    expect(taxFailure).toBeUndefined();
  });

  it('Stripe API error → tolerated: surfaces as a warning, not a failure', async () => {
    process.env.STRIPE_LIVE_MODE = 'true';
    delete process.env.STRIPE_TAX_ENABLED;
    mockTaxSettingsRetrieve.mockRejectedValue(new Error('permission_denied: missing scope'));

    const { body } = await callCron();
    const taxFailure = body.failures.find((f) => f.check === 'stripe:tax-flag');
    expect(taxFailure).toBeUndefined();
    const taxWarning = body.warnings.find((w) => w.check === 'stripe:tax-flag');
    expect(taxWarning).toBeDefined();
    expect(taxWarning?.detail).toMatch(/permission_denied/);
  });

  it('not live mode → check skipped entirely (no stripe:tax-flag entry anywhere)', async () => {
    delete process.env.STRIPE_LIVE_MODE;
    mockTaxSettingsRetrieve.mockResolvedValue({ status: 'active' });

    const { body } = await callCron();
    expect(mockTaxSettingsRetrieve).not.toHaveBeenCalled();
    expect(body.failures.find((f) => f.check === 'stripe:tax-flag')).toBeUndefined();
    expect(body.warnings.find((w) => w.check === 'stripe:tax-flag')).toBeUndefined();
  });
});

const LICENSE_SECTION_CHECKS = [
  'env:REVEALUI_LICENSE_PRIVATE_KEY',
  'env:REVEALUI_LICENSE_SIGNER_URL',
  'env:REVEALUI_LICENSE_PUBLIC_KEY',
  'env:REVEALUI_LICENSE_PUBLIC_KEY_NEXT',
  'env:REVEALUI_SIGNER_INVOKE_SECRET',
  'signer:health',
] as const;

function licenseSectionFailures(body: CronBody): CronBody['failures'] {
  return body.failures.filter((f) =>
    (LICENSE_SECTION_CHECKS as readonly string[]).includes(f.check),
  );
}

describe('billing-readiness cron — license mint (REVEALUI-SERVER-A)', () => {
  const PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nCANARY-PUBLIC\n-----END PUBLIC KEY-----';
  const INVOKE_SECRET = 'invoke-secret-canary-do-not-leak';
  const SIGNER_URL = 'https://signer.example';

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function enableSignerMode(flag = '1'): void {
    process.env.REVEALUI_LICENSE_SIGN_VIA_SIGNER = flag;
    process.env.REVEALUI_LICENSE_SIGNER_URL = SIGNER_URL;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = PUBLIC_KEY;
    process.env.REVEALUI_SIGNER_INVOKE_SECRET = INVOKE_SECRET;
    delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;
  }

  it('signer mode on + public key + signer URL + invoke secret + no private key passes the license section', async () => {
    enableSignerMode('true');

    const { body } = await callCron();
    expect(licenseSectionFailures(body)).toEqual([]);
    expect(JSON.stringify(body)).not.toContain(INVOKE_SECRET);
    expect(JSON.stringify(body)).not.toContain('CANARY-PUBLIC');
    expect(JSON.stringify(body)).not.toContain('mock_priv_key');

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${SIGNER_URL}/health/live`);
    expect(init.method).toBe('GET');
    expect(JSON.stringify(init)).not.toContain(INVOKE_SECRET);
  });

  it('signer mode on accepts 1/yes/on the same way as true', async () => {
    for (const flag of ['1', 'yes', 'on']) {
      enableSignerMode(flag);
      const { body } = await callCron();
      expect(licenseSectionFailures(body), flag).toEqual([]);
    }
  });

  it('signer mode off (absent) + no private key fails env:REVEALUI_LICENSE_PRIVATE_KEY', async () => {
    delete process.env.REVEALUI_LICENSE_SIGN_VIA_SIGNER;
    delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;

    const { body } = await callCron();
    const license = licenseSectionFailures(body);
    expect(license).toEqual([{ check: 'env:REVEALUI_LICENSE_PRIVATE_KEY', detail: 'MISSING' }]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('signer mode explicitly false + no private key still names PRIVATE_KEY', async () => {
    process.env.REVEALUI_LICENSE_SIGN_VIA_SIGNER = 'false';
    delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;

    const { body } = await callCron();
    expect(licenseSectionFailures(body)).toEqual([
      { check: 'env:REVEALUI_LICENSE_PRIVATE_KEY', detail: 'MISSING' },
    ]);
  });

  it('signer mode on + missing SIGNER_URL fails naming SIGNER_URL, not PRIVATE_KEY', async () => {
    enableSignerMode('yes');
    delete process.env.REVEALUI_LICENSE_SIGNER_URL;

    const { body } = await callCron();
    const license = licenseSectionFailures(body);
    expect(license.map((f) => f.check)).toEqual(['env:REVEALUI_LICENSE_SIGNER_URL']);
    expect(license[0]?.detail).toBe('MISSING');
    expect(license.some((f) => f.check === 'env:REVEALUI_LICENSE_PRIVATE_KEY')).toBe(false);
    expect(JSON.stringify(body)).not.toContain(INVOKE_SECRET);
    expect(JSON.stringify(body)).not.toContain('CANARY-PUBLIC');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('signer mode on + missing public key names PUBLIC_KEY, not PRIVATE_KEY', async () => {
    enableSignerMode();
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY;

    const { body } = await callCron();
    expect(licenseSectionFailures(body).map((f) => f.check)).toEqual([
      'env:REVEALUI_LICENSE_PUBLIC_KEY',
    ]);
  });

  it('signer mode on + missing invoke secret names REVEALUI_SIGNER_INVOKE_SECRET, not PRIVATE_KEY', async () => {
    enableSignerMode();
    delete process.env.REVEALUI_SIGNER_INVOKE_SECRET;

    const { body } = await callCron();
    expect(licenseSectionFailures(body).map((f) => f.check)).toEqual([
      'env:REVEALUI_SIGNER_INVOKE_SECRET',
    ]);
  });

  it('signer mode on does not require PUBLIC_KEY_NEXT', async () => {
    enableSignerMode();
    delete process.env.REVEALUI_LICENSE_PUBLIC_KEY_NEXT;

    const { body } = await callCron();
    expect(body.failures.some((f) => f.check === 'env:REVEALUI_LICENSE_PUBLIC_KEY_NEXT')).toBe(
      false,
    );
  });

  it('signer health miss is a warning and does not fail the license section or echo the URL', async () => {
    enableSignerMode();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error(`connect ECONNREFUSED ${SIGNER_URL} secret=${INVOKE_SECRET}`);
      }),
    );

    const { body } = await callCron();
    expect(licenseSectionFailures(body)).toEqual([]);
    const warning = body.warnings.find((w) => w.check === 'signer:health');
    expect(warning?.detail).toBe('probe failed (non-fatal)');
    expect(JSON.stringify(body)).not.toContain(SIGNER_URL);
    expect(JSON.stringify(body)).not.toContain(INVOKE_SECRET);
    expect(JSON.stringify(body)).not.toContain('CANARY-PUBLIC');
  });
});
