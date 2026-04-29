/**
 * Stripe Webhook  -  Dual-Secret Rotation Transition (GAP-144)
 *
 * Verifies the `getWebhookSecret()` + `constructEventAsync` try-fallback
 * path that supports zero-downtime webhook signing-secret rotation.
 *
 * Steady state (no rotation in flight):
 *   STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS unset → only primary tried.
 *
 * Rotation overlap window:
 *   STRIPE_WEBHOOK_SECRET_LIVE      = NEW secret (primary)
 *   STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS = OLD secret (secondary, transitional)
 *   Stripe may deliver events signed with EITHER secret during the overlap.
 *   Verifier tries primary first; on auth-tag mismatch, tries secondary;
 *   on secondary success, logs a `rotation-transition` warning so operators
 *   can confirm the overlap is active. Both failing → 400 (current behavior).
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks  -  declared before imports so vi.mock hoisting takes effect ─────────

const { mockConstructEvent } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    class {
      webhooks = { constructEventAsync: mockConstructEvent };
      subscriptions = { update: vi.fn(), retrieve: vi.fn(), list: vi.fn() };
      charges = { retrieve: vi.fn() };
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

// GAP-131: webhooks.ts uses protectedStripe from @revealui/services
vi.mock('@revealui/services', () => ({
  protectedStripe: {
    webhooks: { constructEventAsync: mockConstructEvent },
    subscriptions: { update: vi.fn(), retrieve: vi.fn(), list: vi.fn() },
    charges: { retrieve: vi.fn() },
    customers: { update: vi.fn() },
  },
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(),
  getFeaturesForTier: vi.fn(() => ({})),
}));

vi.mock('@revealui/core/license', () => ({
  generateLicenseKey: vi.fn(),
  resetLicenseState: vi.fn(),
}));

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
  provisionGitHubAccess: vi.fn().mockResolvedValue(undefined),
}));

// Minimal DB mock — tests use unknown event types so handler short-circuits
// before any DB write, but the signature path still needs getClient() to resolve.
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
};

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
  DrizzleAuditStore: vi.fn().mockImplementation(
    class {
      append = vi.fn();
    } as unknown as (...args: unknown[]) => unknown,
  ),
  executeSaga: vi.fn(),
}));

// ─── Imports under test (after mocks) ─────────────────────────────────────────

import * as loggerModule from '@revealui/core/observability/logger';
import webhooksApp from '../webhooks.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createApp() {
  const app = new Hono();
  app.route('/', webhooksApp);
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

const UNKNOWN_EVENT = {
  id: 'evt_rotation_test',
  type: 'unknown.event.type',
  data: { object: {} },
  created: 1700000000,
  livemode: false,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Webhook signature verification  -  dual-secret rotation transition (GAP-144)', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    savedEnv.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    savedEnv.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    savedEnv.STRIPE_WEBHOOK_SECRET_LIVE = process.env.STRIPE_WEBHOOK_SECRET_LIVE;
    savedEnv.STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS = process.env.STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS;

    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET_LIVE;
    delete process.env.STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS;
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  it('verifies with primary alone when no secondary is configured (steady state)', async () => {
    process.env.STRIPE_WEBHOOK_SECRET_LIVE = 'whsec_primary_steady';

    mockConstructEvent.mockResolvedValueOnce(UNKNOWN_EVENT);

    const res = await createApp().request(postStripe(UNKNOWN_EVENT, 'sig-steady'));

    expect(res.status).toBe(200);
    expect(mockConstructEvent).toHaveBeenCalledTimes(1);
    expect(mockConstructEvent).toHaveBeenCalledWith(
      expect.any(String),
      'sig-steady',
      'whsec_primary_steady',
    );
    expect(vi.mocked(loggerModule.logger).warn).not.toHaveBeenCalled();
  });

  it('falls back to secondary when primary fails during rotation overlap', async () => {
    process.env.STRIPE_WEBHOOK_SECRET_LIVE = 'whsec_new_primary';
    process.env.STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS = 'whsec_old_secondary';

    // Primary verification rejects (event was signed under the OLD secret),
    // secondary verification accepts.
    mockConstructEvent
      .mockRejectedValueOnce(new Error('No signatures found matching the expected signature'))
      .mockResolvedValueOnce(UNKNOWN_EVENT);

    const res = await createApp().request(postStripe(UNKNOWN_EVENT, 'sig-old'));

    expect(res.status).toBe(200);
    expect(mockConstructEvent).toHaveBeenCalledTimes(2);
    expect(mockConstructEvent).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      'sig-old',
      'whsec_new_primary',
    );
    expect(mockConstructEvent).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      'sig-old',
      'whsec_old_secondary',
    );
    expect(vi.mocked(loggerModule.logger).warn).toHaveBeenCalledWith(
      expect.stringContaining('rotation in flight'),
      expect.objectContaining({ eventType: 'rotation-transition' }),
    );
    expect(vi.mocked(loggerModule.logger).error).not.toHaveBeenCalled();
  });

  it('returns 400 when both primary and secondary reject the signature', async () => {
    process.env.STRIPE_WEBHOOK_SECRET_LIVE = 'whsec_new_primary';
    process.env.STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS = 'whsec_old_secondary';

    mockConstructEvent
      .mockRejectedValueOnce(new Error('No signatures found matching the expected signature'))
      .mockRejectedValueOnce(new Error('No signatures found matching the expected signature'));

    const res = await createApp().request(postStripe(UNKNOWN_EVENT, 'sig-bogus'));

    expect(res.status).toBe(400);
    expect(mockConstructEvent).toHaveBeenCalledTimes(2);
    expect(vi.mocked(loggerModule.logger).warn).not.toHaveBeenCalled();
    expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
      expect.stringContaining('both primary and secondary'),
      undefined,
      expect.objectContaining({ detail: expect.stringContaining('No signatures') }),
    );
  });

  it('returns 400 when primary fails and no secondary is configured', async () => {
    process.env.STRIPE_WEBHOOK_SECRET_LIVE = 'whsec_only_primary';
    // no STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS set

    mockConstructEvent.mockRejectedValueOnce(
      new Error('No signatures found matching the expected signature'),
    );

    const res = await createApp().request(postStripe(UNKNOWN_EVENT, 'sig-bogus'));

    expect(res.status).toBe(400);
    expect(mockConstructEvent).toHaveBeenCalledTimes(1); // never tried secondary
    expect(vi.mocked(loggerModule.logger).warn).not.toHaveBeenCalled();
    expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
      'Webhook signature verification failed',
      undefined,
      expect.objectContaining({ detail: expect.stringContaining('No signatures') }),
    );
  });
});
