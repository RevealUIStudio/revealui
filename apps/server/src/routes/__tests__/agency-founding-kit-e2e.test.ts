/**
 * GAP-448 P2-T1 — Agency Founding Kit e2e dry-run (test-mode path, no live Stripe).
 *
 * Proves the acceptance chain without founder intervention on the happy path:
 *   1. Webhook checkout.session.completed (mode=payment, tier=max perpetual)
 *      mints Agency caps (maxSites 10) and enqueues kit.stamp.agency
 *   2. Real Ed25519 mint → JWT verifies; claims carry maxSites 10 / maxUsers 100
 *   3. Stamp package + signed download token → download body is complete
 *      and never embeds private key material
 *   4. Double webhook keeps a single idempotency key for the stamp job
 *
 * Live Stripe secrets are not required; constructEvent is mocked like other
 * webhook suite files. P2-T0 unit coverage of the stamp handler lives in
 * jobs/__tests__/kit-stamp-agency.test.ts.
 */

import { generateKeyPairSync } from 'node:crypto';
import { Hono } from 'hono';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockConstructEvent,
  mockSubscriptionsUpdate,
  mockSubscriptionsRetrieve,
  mockSubscriptionsList,
  mockChargesRetrieve,
  mockPaymentIntentsUpdate,
  mockEnqueue,
} = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockSubscriptionsUpdate: vi.fn(),
  mockSubscriptionsRetrieve: vi.fn(),
  mockSubscriptionsList: vi.fn(),
  mockChargesRetrieve: vi.fn(),
  mockPaymentIntentsUpdate: vi.fn(),
  mockEnqueue: vi.fn().mockResolvedValue({ id: 'job_kit_1' }),
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
      paymentIntents = { update: mockPaymentIntentsUpdate };
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
    paymentIntents: { update: mockPaymentIntentsUpdate },
    customers: { update: vi.fn() },
  },
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(),
  getFeaturesForTier: vi.fn(() => ({})),
}));

// Real license issuer + verifier (same pattern as webhook-license-roundtrip).
vi.mock('@revealui/core/license', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../../packages/core/src/license.ts')
  >('../../../../../packages/core/src/license.ts');
  return actual;
});

vi.mock('@revealui/core/license/mint-client', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../../packages/core/src/license/mint-client.ts')
  >('../../../../../packages/core/src/license/mint-client.ts');
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
  sendAgencyKitPackageEmail: vi.fn().mockResolvedValue(undefined),
  sendTierFallbackAlert: vi.fn().mockResolvedValue(undefined),
  sendTrialEndingEmail: vi.fn().mockResolvedValue(undefined),
  sendWebhookFailureAlert: vi.fn().mockResolvedValue(undefined),
  sendDisputeLostEmail: vi.fn().mockResolvedValue(undefined),
  sendLivemodeMismatchAlert: vi.fn().mockResolvedValue(undefined),
  provisionGitHubAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@revealui/db/jobs', () => ({
  enqueue: (...args: unknown[]) => mockEnqueue(...args),
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

// getClient is also imported from @revealui/db/client by the stamp job path;
// download route uses @revealui/db.
vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}));

import { validateLicenseKey } from '@revealui/core/license';
import { mintKitDownloadToken, verifyKitDownloadToken } from '../../lib/kit-download-token.js';
import {
  buildAgencyKitArtifact,
  resolveAgencyKitBranding,
  serializeKitArtifactForDownload,
} from '../../lib/kit-stamp-artifact.js';
import kitsApp from '../kits.js';
import webhooksApp from '../webhooks.js';

function createWebhookApp() {
  const app = new Hono();
  app.route('/', webhooksApp);
  return app;
}

function createKitsApp() {
  const app = new Hono();
  app.route('/', kitsApp);
  return app;
}

function postStripe(eventJson: unknown, sig = 'valid-sig') {
  return new Request('http://localhost/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': sig,
    },
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

function makeAgencyPerpetualEvent(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        mode: 'payment',
        subscription: null,
        customer: 'cus_agency_kit',
        customer_email: 'agency-buyer@example.com',
        payment_intent: 'pi_agency_kit',
        metadata: {
          tier: 'max',
          perpetual: 'true',
          revealui_user_id: 'user_agency_kit',
          company: 'Buyer Agency Co',
          slug: 'buyer-agency',
          brand: '#1a56db',
        },
        ...overrides,
      },
    },
  };
}

function capturedLicenseRow(): Record<string, unknown> | undefined {
  for (const call of mockDbInsertChain.values.mock.calls) {
    const arg = call[0] as Record<string, unknown> | undefined;
    if (arg && typeof arg === 'object' && typeof arg.licenseKey === 'string') return arg;
  }
  return undefined;
}

function decodeJwtSegment(jwt: string, index: 0 | 1): Record<string, unknown> {
  const segment = jwt.split('.')[index];
  if (!segment) throw new Error(`JWT missing segment ${index}`);
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

describe('GAP-448 P2-T1 Agency Founding Kit e2e dry-run', () => {
  let privateKeyPem: string;
  let publicKeyPem: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
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
    mockSubscriptionsRetrieve.mockResolvedValue({ status: 'active', trial_end: null });
    mockSubscriptionsList.mockResolvedValue({ data: [] });
    mockChargesRetrieve.mockResolvedValue({ id: 'ch_test', customer: 'cus_test' });
    mockPaymentIntentsUpdate.mockResolvedValue({});
    mockEnqueue.mockResolvedValue({ id: 'job_kit_1' });
    mockAuditAppend.mockResolvedValue(undefined);
    resetDbChains();

    for (const key of [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'REVEALUI_LICENSE_PRIVATE_KEY',
      'REVEALUI_LICENSE_PUBLIC_KEY',
      'REVEALUI_SECRET',
      'STRIPE_WEBHOOK_SECRET_LIVE',
    ] as const) {
      savedEnv[key] = process.env[key];
    }

    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
    process.env.REVEALUI_LICENSE_PRIVATE_KEY = privateKeyPem;
    process.env.REVEALUI_LICENSE_PUBLIC_KEY = publicKeyPem;
    process.env.REVEALUI_SECRET = 'kit-e2e-test-secret';
    delete process.env.STRIPE_WEBHOOK_SECRET_LIVE;
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  it('test-mode Agency perpetual checkout mints maxSites 10 JWT and enqueues kit.stamp.agency', async () => {
    const event = makeAgencyPerpetualEvent('evt_agency_kit_t1');
    mockConstructEvent.mockReturnValueOnce(event);

    // saga: verify-user → existing-license check → post-mint licenseKey select for email
    mockDbSelectChain.limit
      .mockResolvedValueOnce([{ id: 'user_agency_kit' }])
      .mockResolvedValueOnce([])
      .mockImplementation(async () => {
        const row = capturedLicenseRow();
        return row ? [{ licenseKey: row.licenseKey }] : [];
      });

    const res = await createWebhookApp().request(postStripe(event));
    expect(res.status).toBe(200);

    const row = capturedLicenseRow();
    expect(row).toBeDefined();
    expect(row?.tier).toBe('max');
    expect(row?.perpetual).toBe(true);
    expect(row?.expiresAt).toBeNull();
    expect(row?.mode).toBe('test');

    const jwt = row?.licenseKey as string;
    expect(jwt.split('.')).toHaveLength(3);

    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload).not.toBeNull();
    expect(payload?.tier).toBe('max');
    expect(payload?.customerId).toBe('cus_agency_kit');
    expect(payload?.maxSites).toBe(10);
    expect(payload?.maxUsers).toBe(100);
    expect(payload?.perpetual).toBe(true);

    const claims = decodeJwtSegment(jwt, 1);
    expect(claims.maxSites).toBe(10);
    expect(claims.maxUsers).toBe(100);

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      'kit.stamp.agency',
      expect.objectContaining({
        stripeEventId: 'evt_agency_kit_t1',
        customerId: 'cus_agency_kit',
        userId: 'user_agency_kit',
        livemode: false,
        branding: expect.objectContaining({
          company: 'Buyer Agency Co',
          slug: 'buyer-agency',
          brand: '#1a56db',
          email: 'agency-buyer@example.com',
        }),
      }),
      expect.objectContaining({
        idempotencyKey: 'kit.stamp.agency:evt_agency_kit_t1',
        retryLimit: 5,
      }),
    );

    const enqueuePayload = mockEnqueue.mock.calls[0]?.[1] as { licenseId?: string };
    expect(enqueuePayload.licenseId).toBeTruthy();
    expect(enqueuePayload.licenseId).toBe(row?.id);
  });

  it('double webhook keeps a single stamp idempotency key (P2-T0 double-fire)', async () => {
    const event = makeAgencyPerpetualEvent('evt_agency_kit_double');

    for (let i = 0; i < 2; i++) {
      mockConstructEvent.mockReturnValueOnce(event);
      mockDbSelectChain.limit
        .mockResolvedValueOnce([{ id: 'user_agency_kit' }])
        .mockResolvedValueOnce([])
        .mockImplementation(async () => {
          const row = capturedLicenseRow();
          return row ? [{ licenseKey: row.licenseKey }] : [];
        });
      const res = await createWebhookApp().request(postStripe(event));
      expect(res.status).toBe(200);
      // Reset chain for next fire; inserts still accumulate.
      resetDbChains();
      mockDbSelectChain.limit.mockReset();
    }

    const keys = mockEnqueue.mock.calls.map(
      (c) => (c[2] as { idempotencyKey?: string } | undefined)?.idempotencyKey,
    );
    expect(keys).toEqual([
      'kit.stamp.agency:evt_agency_kit_double',
      'kit.stamp.agency:evt_agency_kit_double',
    ]);
  });

  it('stamp artifact + download token serve a private-key-free package with Agency caps', async () => {
    const branding = resolveAgencyKitBranding({
      company: 'Buyer Agency Co',
      slug: 'buyer-agency',
      brand: '#1a56db',
      email: 'agency-buyer@example.com',
    });
    const licenseId = 'lic_agency_e2e';
    const artifact = buildAgencyKitArtifact({
      branding,
      licenseId,
      livemode: false,
      packageFormat: 'text',
    });

    expect(artifact.manifest).toMatchObject({
      product: 'agency-founding-kit',
      tier: 'max',
      perpetual: true,
      maxSites: 10,
      maxUsers: 100,
      licenseId,
      livemode: false,
    });
    expect(artifact.revforgeJson).toMatchObject({
      licenseTier: 'max',
      licensePerpetual: true,
      licenseMaxSites: 10,
    });

    const body = serializeKitArtifactForDownload(artifact);
    expect(body).toContain('maxSites');
    expect(body).toContain('Agency Founding Kit');
    expect(body).not.toMatch(/BEGIN PRIVATE KEY/i);
    expect(body).not.toContain('REVEALUI_LICENSE_PRIVATE_KEY');
    expect(JSON.stringify(artifact)).not.toContain(privateKeyPem.split('\n')[1] ?? 'PRIVATE');

    const fulfillmentId = 'ful_agency_e2e';
    const token = mintKitDownloadToken(fulfillmentId);
    expect(verifyKitDownloadToken(token)).toEqual({ ok: true, fulfillmentId });

    mockDbSelectChain.limit.mockResolvedValueOnce([
      {
        id: fulfillmentId,
        status: 'ready',
        artifact,
        artifactUri: null,
        branding,
      },
    ]);

    const res = await createKitsApp().request(
      `http://localhost/agency-founding/download?token=${encodeURIComponent(token)}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/text\/plain/);
    const downloaded = await res.text();
    expect(downloaded).toContain('START-HERE.md');
    expect(downloaded).toContain('buyer-agency');
    expect(downloaded).toContain('"maxSites": 10');
    expect(downloaded).not.toMatch(/BEGIN PRIVATE KEY/i);
  });

  it('initializeLicense-equivalent validation: Agency JWT unlocks max tier with site cap 10', async () => {
    // Self-host acceptance: buyer pastes JWT → validateLicenseKey → max + maxSites 10.
    // Full process boot with FreeTierBanner is covered by admin UI tests; crypto is the gate.
    const { mintLicenseKey } = await import('@revealui/core/license/mint-client');
    const jwt = await mintLicenseKey({
      tier: 'max',
      customerId: 'cus_selfhost_agency',
      perpetual: true,
      expiresInSeconds: null,
      maxSites: 10,
      maxUsers: 100,
    });
    const payload = await validateLicenseKey(jwt, publicKeyPem);
    expect(payload?.tier).toBe('max');
    expect(payload?.maxSites).toBe(10);
    expect(payload?.maxUsers).toBe(100);
    expect(payload?.perpetual).toBe(true);
  });
});
