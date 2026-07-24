/**
 * Stripe Webhook  -  REAL license sign+verify round-trip (A1, flip-blocking)
 *
 * webhook-handler.test.ts mocks `generateLicenseKey`, so nothing in that file
 * proves the webhook actually issues a *cryptographically valid* license. This
 * file closes that gap: it drives the REAL `checkout.session.completed`
 * subscription saga with the REAL `@revealui/core/license` issuer signing with a
 * REAL ephemeral Ed25519 keypair, captures the license row the saga inserts, and
 * verifies the issued JWT with the REAL `validateLicenseKey`. That is the
 * payment -> license integration proof the go-live gate requires, and it runs
 * deterministically in CI (no Stripe creds, no DB, no running server).
 *
 * It also asserts the issued token carries exactly the claims the RevDev daemon
 * verifier requires (alg=EdDSA, iss, aud, tier) — the unit-level half of A9
 * (one purchase -> one JWT both the framework AND the daemon accept). The actual
 * daemon-accept (worktree.create no longer -32001) is exercised end-to-end in
 * e2e/billing-paid-path.e2e.ts and revdev's verifyLicenseJWT cross-issuer test.
 */

import { generateKeyPairSync } from 'node:crypto';
import { Hono } from 'hono';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (mirrors webhook-handler.test.ts) — but NOT @revealui/core/license ──
// The whole point of this file is to exercise the real license issuer + verifier.

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

// Resolve `@revealui/core/license` (+ mint-client) to REAL source. The package
// subpaths map to dist/, which is not built during the server test run (and the
// build runs in parallel with vitest in CI), so a bare import fails to resolve.
// Other server tests sidestep this by mocking; this file needs the genuine
// issuer + verifier. GAP-260 P4-3: webhooks mint via mintLicenseKey (local path
// still calls generateLicenseKey under the hood).
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

// ─── DB Mock (mirrors webhook-handler.test.ts) ───────────────────────────────

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

// ─── Import under test (after mocks). REAL license module — NOT mocked. ──────

import { validateLicenseKey } from '@revealui/core/license';
import webhooksApp from '../webhooks.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** Decode a JWT segment (base64url) to a plain object. No regex; split + Buffer + JSON.parse. */
function decodeJwtSegment(jwt: string, index: 0 | 1): Record<string, unknown> {
  const segment = jwt.split('.')[index];
  if (!segment) throw new Error(`JWT missing segment ${index}`);
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

/** Pull the inserted `licenses` row (the saga makes several inserts — find the one with a licenseKey). */
function capturedLicenseRow(): Record<string, unknown> | undefined {
  for (const call of mockDbInsertChain.values.mock.calls) {
    const arg = call[0] as Record<string, unknown> | undefined;
    if (arg && typeof arg === 'object' && typeof arg.licenseKey === 'string') return arg;
  }
  return undefined;
}

function makeSubscriptionCheckoutEvent(
  id: string,
  tier: 'pro' | 'max' | 'enterprise',
  customerId: string,
) {
  return {
    id,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        mode: 'subscription',
        subscription: `sub_${id}`,
        customer: customerId,
        metadata: { tier, revealui_user_id: 'user_roundtrip' },
      },
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('checkout.session.completed  -  REAL license sign+verify round-trip', () => {
  let privateKeyPem: string;
  let publicKeyPem: string;

  beforeAll(() => {
    // Real Ed25519 keypair — the same algorithm production uses (EdDSA / Ed25519).
    const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    publicKeyPem = publicKey;
    privateKeyPem = privateKey;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionsUpdate.mockResolvedValue({});
    // The handler retrieves the subscription up front (webhooks.ts:1375).
    mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
    mockSubscriptionsList.mockResolvedValue({ data: [] });
    mockChargesRetrieve.mockResolvedValue({ id: 'ch_test', customer: 'cus_test' });
    mockAuditAppend.mockResolvedValue(undefined);
    resetDbChains();

    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = privateKeyPem;
  });

  it('issues a license JWT that verifies against the real public key (tier=pro)', async () => {
    const event = makeSubscriptionCheckoutEvent('evt_rt_pro', 'pro', 'cus_rt_pro');
    mockConstructEvent.mockReturnValueOnce(event);
    // verify-user-exists -> found; insert-existing-license check -> none.
    mockDbSelectChain.limit
      .mockResolvedValueOnce([{ id: 'user_roundtrip' }])
      .mockResolvedValueOnce([]);

    const res = await createApp().request(postStripe(event));
    expect(res.status).toBe(200);

    const row = capturedLicenseRow();
    expect(row).toBeDefined();
    const jwt = row?.licenseKey as string;

    // Not the mock placeholder — a real compact JWS (header.payload.signature).
    expect(jwt).not.toBe('rv-license-key-test-123');
    expect(jwt.split('.')).toHaveLength(3);

    // The real verifier accepts it.
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload).not.toBeNull();
    expect(payload?.tier).toBe('pro');
    expect(payload?.customerId).toBe('cus_rt_pro');
  });

  it('signs the resolved tier into the verifiable token (tier=max)', async () => {
    const event = makeSubscriptionCheckoutEvent('evt_rt_max', 'max', 'cus_rt_max');
    mockConstructEvent.mockReturnValueOnce(event);
    mockDbSelectChain.limit
      .mockResolvedValueOnce([{ id: 'user_roundtrip' }])
      .mockResolvedValueOnce([]);

    const res = await createApp().request(postStripe(event));
    expect(res.status).toBe(200);

    const jwt = capturedLicenseRow()?.licenseKey as string;
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload?.tier).toBe('max');
    expect(payload?.customerId).toBe('cus_rt_max');
  });

  it('a forged tier-escalation token fails verification (negative control)', async () => {
    const event = makeSubscriptionCheckoutEvent('evt_rt_tamper', 'pro', 'cus_rt_tamper');
    mockConstructEvent.mockReturnValueOnce(event);
    mockDbSelectChain.limit
      .mockResolvedValueOnce([{ id: 'user_roundtrip' }])
      .mockResolvedValueOnce([]);

    await createApp().request(postStripe(event));
    const jwt = capturedLicenseRow()?.licenseKey as string;

    // Attempt privilege escalation: rewrite the signed `tier` claim from pro to
    // enterprise while keeping the original signature. The signature covers the
    // original payload bytes, so verification MUST reject the forgery — proving a
    // customer cannot self-upgrade by editing the JWT they receive.
    const parts = jwt.split('.');
    const claims = decodeJwtSegment(jwt, 1);
    claims.tier = 'enterprise';
    const forgedPayload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const forged = `${parts[0]}.${forgedPayload}.${parts[2]}`;
    expect(await validateLicenseKey(forged, publicKeyPem)).toBeNull();
  });

  it('the issued token carries exactly the claims the RevDev daemon verifier requires (A9)', async () => {
    // revdev daemon verifyLicenseJWT (packages/daemon/src/license-crypto.ts) rejects
    // unless: header alg === 'EdDSA', iss === 'https://revealui.com',
    // aud === 'revealui-license', and tier ∈ {pro,max,enterprise}. A token that
    // verifies framework-side AND carries these claims is, with the shared signing
    // key, accepted by the daemon — that is the one-JWT-both-accept guarantee.
    const event = makeSubscriptionCheckoutEvent('evt_rt_daemon', 'pro', 'cus_rt_daemon');
    mockConstructEvent.mockReturnValueOnce(event);
    mockDbSelectChain.limit
      .mockResolvedValueOnce([{ id: 'user_roundtrip' }])
      .mockResolvedValueOnce([]);

    await createApp().request(postStripe(event));
    const jwt = capturedLicenseRow()?.licenseKey as string;

    const header = decodeJwtSegment(jwt, 0);
    const claims = decodeJwtSegment(jwt, 1);
    expect(header.alg).toBe('EdDSA');
    expect(claims.iss).toBe('https://revealui.com');
    expect(claims.aud).toBe('revealui-license');
    expect(claims.tier).toBe('pro');
  });
});
