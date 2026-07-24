/**
 * GAP-287 PR-2 — subscription license exp derivation + renewal re-mint cadence,
 * driven through the REAL webhook handler and the REAL `@revealui/core/license`
 * issuer (no mocked signer — the same pattern as webhook-license-roundtrip).
 *
 * Proves the wiring, not just the pure helpers:
 *  - checkout.session.completed mints a token whose exp = current_period_end +
 *    RENEWAL_SLACK (RED against the pre-GAP-287 flat 365d default).
 *  - invoice.payment_succeeded on a healthy, already-active subscription
 *    RE-MINTS when the stored key's exp is below the new period bound, and
 *    SKIPS when the stored key already covers it (the WH-2 idempotency property
 *    extended to the exp dimension — proven both directions).
 */

import { generateKeyPairSync } from 'node:crypto';
import { Hono } from 'hono';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockConstructEvent,
  mockSubscriptionsUpdate,
  mockSubscriptionsRetrieve,
  mockSubscriptionsList,
  mockChargesRetrieve,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockSubscriptionsUpdate: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockSubscriptionsList: vi.fn(),
  mockChargesRetrieve: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    class {
      webhooks = { constructEventAsync: mockConstructEvent };
      subscriptions = {
        update: mockSubscriptionsUpdate,
        retrieve: mockSubscriptionsRetrieve,
        list: mockSubscriptionsList,
      };
      charges = { retrieve: mockChargesRetrieve };
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

vi.mock('@revealui/services', () => ({
  protectedStripe: {
    webhooks: { constructEventAsync: mockConstructEvent },
    subscriptions: {
      update: mockSubscriptionsUpdate,
      retrieve: mockSubscriptionsRetrieve,
      list: mockSubscriptionsList,
    },
    charges: { retrieve: mockChargesRetrieve },
    customers: { update: vi.fn() },
  },
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(),
  getFeaturesForTier: vi.fn(() => ({})),
}));

// Resolve `@revealui/core/license` (+ mint-client) to REAL source so the handler
// signs with the genuine issuer (see webhook-license-roundtrip.test.ts).
vi.mock('@revealui/core/license', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../../packages/core/src/license.ts')
  >('../../../../../packages/core/src/license.ts');
  return actual;
});

vi.mock('@revealui/core/license/mint-client', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../../packages/core/src/license-mint-client.ts')
  >('../../../../../packages/core/src/license-mint-client.ts');
  return actual;
});

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/webhook-emails.js', () => ({
  sendLicenseActivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentRecoveredEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentReceiptEmail: vi.fn().mockResolvedValue(undefined),
  sendPerpetualLicenseActivatedEmail: vi.fn().mockResolvedValue(undefined),
  sendTierFallbackAlert: vi.fn().mockResolvedValue(undefined),
  sendTrialEndingEmail: vi.fn().mockResolvedValue(undefined),
  sendWebhookFailureAlert: vi.fn().mockResolvedValue(undefined),
  sendDisputeLostEmail: vi.fn().mockResolvedValue(undefined),
  sendLivemodeMismatchAlert: vi.fn().mockResolvedValue(undefined),
  provisionGitHubAccess: vi.fn().mockResolvedValue(undefined),
}));

const mockAuditAppend = vi.fn();
const mockDbSelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
};
const mockDbInsertChain = { values: vi.fn() };
const mockDbUpdateChain = { set: vi.fn(), where: vi.fn() };
const mockDbDeleteChain = { where: vi.fn().mockResolvedValue(undefined) };
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn().mockReturnValue(mockDbDeleteChain),
  transaction: vi.fn(),
};

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
  DrizzleAuditStore: vi.fn().mockImplementation(
    class {
      append = mockAuditAppend;
    } as unknown as (...args: unknown[]) => unknown,
  ),
  executeSaga: vi.fn(
    async (
      db: unknown,
      _sagaName: string,
      _sagaKey: string,
      steps: Array<{
        name: string;
        execute: (ctx: {
          db: unknown;
          sagaId: string;
          checkpoint: (n: string, o: unknown) => Promise<void>;
        }) => Promise<unknown>;
      }>,
    ) => {
      const sagaId = `mock-saga-${Date.now()}`;
      const ctx = { db, sagaId, checkpoint: async () => {} };
      const completedSteps: string[] = [];
      let lastOutput: unknown;
      for (const step of steps) {
        lastOutput = await step.execute(ctx);
        completedSteps.push(step.name);
      }
      return { sagaId, status: 'completed', result: lastOutput, completedSteps };
    },
  ),
}));

import { generateLicenseKey, subscriptionLicenseExpiresInSeconds } from '@revealui/core/license';
import webhooksApp from '../webhooks.js';

const DAY = 86_400;
const SLACK_SEC = 7 * DAY;

function createApp() {
  const app = new Hono();
  app.route('/', webhooksApp);
  return app;
}

function postStripe(eventJson: unknown, sig = 'valid-sig') {
  return new Request('http://localhost/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig },
    body: JSON.stringify(eventJson),
  });
}

function resetDbChains() {
  mockDbSelectChain.from.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.where.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.orderBy.mockReturnValue(mockDbSelectChain);
  mockDbSelectChain.limit.mockResolvedValue([]);
  mockDbInsertChain.values.mockResolvedValue(undefined);
  mockDbUpdateChain.set.mockReturnValue(mockDbUpdateChain);
  mockDbUpdateChain.where.mockResolvedValue({ rowCount: 1 });
  mockDbDeleteChain.where.mockResolvedValue(undefined);
  mockDb.select.mockReturnValue(mockDbSelectChain);
  mockDb.insert.mockReturnValue(mockDbInsertChain);
  mockDb.update.mockReturnValue(mockDbUpdateChain);
  mockDb.delete.mockReturnValue(mockDbDeleteChain);
  mockDb.transaction.mockImplementation(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
    cb(mockDb),
  );
}

/** Decode a JWT segment (base64url) — split + Buffer + JSON.parse, no regex. */
function decodeJwtClaims(jwt: string): Record<string, unknown> {
  const segment = jwt.split('.')[1];
  if (!segment) throw new Error('JWT missing claims segment');
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

/**
 * Builds an unverified JWT-shaped string carrying an exact `exp` claim, for
 * pinning the renewal idempotency-boundary test to a precise second without
 * racing the real signer's own `iat` capture. `readLicenseExp` (the only
 * consumer of the stored key on the re-mint path) decodes without verifying
 * the signature, so a well-formed but unsigned token is a faithful stand-in.
 */
function fakeLicenseKeyWithExp(exp: number, customerId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ tier: 'pro', customerId, exp })).toString(
    'base64url',
  );
  return `${header}.${payload}.unverified-test-signature`;
}

/** The `licenses` row the checkout saga inserted (the one carrying a licenseKey). */
function capturedInsertedLicenseKey(): string | undefined {
  for (const call of mockDbInsertChain.values.mock.calls) {
    const arg = call[0] as Record<string, unknown> | undefined;
    if (arg && typeof arg.licenseKey === 'string') return arg.licenseKey;
  }
  return undefined;
}

/** The licenseKey from a `db.update().set({ licenseKey })` call, if any (the re-mint). */
function capturedUpdatedLicenseKey(): string | undefined {
  for (const call of mockDbUpdateChain.set.mock.calls) {
    const arg = call[0] as Record<string, unknown> | undefined;
    if (arg && typeof arg.licenseKey === 'string') return arg.licenseKey;
  }
  return undefined;
}

let privateKeyPem: string;

beforeAll(() => {
  const { publicKey: _pub, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  privateKeyPem = privateKey;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSubscriptionsUpdate.mockResolvedValue({});
  mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
  mockSubscriptionsList.mockResolvedValue({ data: [] });
  mockChargesRetrieve.mockResolvedValue({ id: 'ch_test', customer: 'cus_test' });
  mockAuditAppend.mockResolvedValue(undefined);
  resetDbChains();

  process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
  process.env.REVEALUI_LICENSE_PRIVATE_KEY = privateKeyPem;
});

// ─── checkout.session.completed — period-bound exp ────────────────────────────

describe('checkout.session.completed — exp = period_end + slack', () => {
  function makeCheckoutEvent() {
    return {
      id: 'evt_checkout_exp',
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          mode: 'subscription',
          subscription: 'sub_checkout_exp',
          customer: 'cus_checkout_exp',
          metadata: { tier: 'pro', revealui_user_id: 'user_exp' },
        },
      },
    };
  }

  it('binds the minted exp to current_period_end + 7d (not a flat 365d)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const periodEndSec = nowSec + 30 * DAY;

    const event = makeCheckoutEvent();
    mockConstructEvent.mockReturnValueOnce(event);
    mockSubscriptionsRetrieve.mockResolvedValueOnce({
      status: 'active',
      trial_end: null,
      metadata: { tier: 'pro' },
      items: { data: [{ current_period_end: periodEndSec }] },
    });
    // verify-user-exists → found; insert-existing check → none.
    mockDbSelectChain.limit.mockResolvedValueOnce([{ id: 'user_exp' }]).mockResolvedValueOnce([]);

    const res = await createApp().request(postStripe(event));
    expect(res.status).toBe(200);

    const jwt = capturedInsertedLicenseKey();
    expect(jwt).toBeDefined();
    const claims = decodeJwtClaims(jwt as string);
    const exp = claims.exp as number;

    expect(Math.abs(exp - (periodEndSec + SLACK_SEC))).toBeLessThanOrEqual(5);
    // Period-bound (~37d), decisively short of a year — the RED assertion.
    expect(exp).toBeLessThan(nowSec + 60 * DAY);
  });
});

// ─── invoice.payment_succeeded — renewal re-mint cadence ──────────────────────

describe('invoice.payment_succeeded — renewal re-mint cadence', () => {
  const customerId = 'cus_renew';
  const subscriptionId = 'sub_renew';

  function makeRenewalEvent(id: string, newPeriodEndSec: number) {
    // Prime the active subscription Stripe returns from subscriptions.list.
    mockSubscriptionsList.mockResolvedValue({
      data: [
        {
          id: subscriptionId,
          status: 'active',
          cancel_at_period_end: false,
          metadata: { tier: 'pro' },
          items: { data: [{ current_period_end: newPeriodEndSec }] },
        },
      ],
    });
    return {
      id,
      type: 'invoice.payment_succeeded',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: 'inv_renew',
          customer: customerId,
          customer_email: 'renew@test.com',
          subscription: subscriptionId,
          amount_paid: 4900,
          currency: 'usd',
          period_end: newPeriodEndSec,
        },
      },
    };
  }

  /**
   * Sequence the 5 `.limit(1)` reads the handler performs on the healthy active
   * renewal path: receipt-tier lookup, existingLicense, hosted-status (two
   * reads → 'active'), then the re-mint row carrying the stored key.
   */
  function sequenceRenewalReads(storedKey: string) {
    mockDbSelectChain.limit
      .mockResolvedValueOnce([{ tier: 'pro' }]) // receipt tier
      .mockResolvedValueOnce([{ id: 'lic_1', status: 'active' }]) // existingLicense
      .mockResolvedValueOnce([{ accountId: 'acct_1' }]) // hosted: subscription
      .mockResolvedValueOnce([{ status: 'active' }]) // hosted: entitlement
      .mockResolvedValueOnce([{ status: 'active', tier: 'pro', licenseKey: storedKey }]); // re-mint row
  }

  it('RE-MINTS when the stored key exp is below the new period bound', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const newPeriodEndSec = nowSec + 30 * DAY;

    // Stored key expires ~now+7d — below the new bound (now+37d).
    const staleKey = await generateLicenseKey(
      { tier: 'pro', customerId },
      privateKeyPem,
      subscriptionLicenseExpiresInSeconds(new Date(nowSec * 1000)),
    );

    const event = makeRenewalEvent('evt_renew_remint', newPeriodEndSec);
    mockConstructEvent.mockReturnValueOnce(event);
    sequenceRenewalReads(staleKey);

    const res = await createApp().request(postStripe(event));
    expect(res.status).toBe(200);

    const reminted = capturedUpdatedLicenseKey();
    expect(reminted).toBeDefined();
    const exp = decodeJwtClaims(reminted as string).exp as number;
    expect(Math.abs(exp - (newPeriodEndSec + SLACK_SEC))).toBeLessThanOrEqual(5);
  });

  it('SKIPS re-mint when the stored key already covers the new bound (idempotent)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const newPeriodEndSec = nowSec + 30 * DAY;

    // Stored key expires ~now+97d — already beyond the new bound (now+37d).
    const freshKey = await generateLicenseKey(
      { tier: 'pro', customerId },
      privateKeyPem,
      subscriptionLicenseExpiresInSeconds(new Date((nowSec + 90 * DAY) * 1000)),
    );

    const event = makeRenewalEvent('evt_renew_skip', newPeriodEndSec);
    mockConstructEvent.mockReturnValueOnce(event);
    sequenceRenewalReads(freshKey);

    const res = await createApp().request(postStripe(event));
    expect(res.status).toBe(200);

    // No license-key update occurred (markCompleted's update carries no licenseKey).
    expect(capturedUpdatedLicenseKey()).toBeUndefined();
  });

  it('SKIPS re-mint when the stored key exp is exactly 1s below the new bound (idempotency tolerance, #1978 verdict fast-follow)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const newPeriodEndSec = nowSec + 30 * DAY;
    const newBound = newPeriodEndSec + SLACK_SEC;

    // The flooring gap between subscriptionLicenseExpiresInSeconds's relative TTL
    // and the signer's own second-granularity exp can leave a previously-minted
    // key's exp exactly 1s short of the bound it targeted. A duplicate/retried
    // invoice.payment_succeeded landing on that 1s gap must still no-op.
    const staleByOneSecond = fakeLicenseKeyWithExp(newBound - 1, customerId);

    const event = makeRenewalEvent('evt_renew_tolerance', newPeriodEndSec);
    mockConstructEvent.mockReturnValueOnce(event);
    sequenceRenewalReads(staleByOneSecond);

    const res = await createApp().request(postStripe(event));
    expect(res.status).toBe(200);

    expect(capturedUpdatedLicenseKey()).toBeUndefined();
  });
});
