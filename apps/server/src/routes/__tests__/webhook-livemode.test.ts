/**
 * D.1 / L.4 — Webhook livemode cross-check tests
 *
 * Verifies that the webhook handler rejects events whose `livemode` flag does
 * not match the server's `STRIPE_LIVE_MODE` deployment mode.
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const { mockConstructEvent, mockSendEmail } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockSendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(
    class {
      webhooks = { constructEventAsync: mockConstructEvent };
    } as unknown as (...args: unknown[]) => unknown,
  ),
}));

vi.mock('@revealui/services', () => ({
  protectedStripe: {
    webhooks: { constructEventAsync: mockConstructEvent },
    subscriptions: { update: vi.fn(), retrieve: vi.fn(), list: vi.fn() },
    customers: { update: vi.fn() },
    charges: { retrieve: vi.fn() },
  },
}));

vi.mock('@revealui/core/features', () => ({
  isFeatureEnabled: vi.fn(),
  getFeaturesForTier: vi.fn(() => ({})),
}));

vi.mock('@revealui/core/license', () => ({
  generateLicenseKey: vi.fn(),
  resetLicenseState: vi.fn(),
  subscriptionLicenseExpiresInSeconds: vi.fn(() => 3600),
  subscriptionExpBound: vi.fn(() => 9_999_999_999),
  readLicenseExp: vi.fn(async () => null),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/email.js', () => ({
  sendEmail: mockSendEmail,
  sanitizeEmailHeader: (value: string) => value.replace(/[\r\n]/g, ''),
}));

const mockDbInsertChain = { values: vi.fn().mockResolvedValue(undefined) };
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
    }),
  }),
  insert: vi.fn().mockReturnValue(mockDbInsertChain),
  update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }),
  delete: vi.fn().mockReturnValue({ where: vi.fn() }),
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

vi.mock('@revealui/db/schema', () => ({
  accounts: {},
  accountMemberships: {},
  accountSubscriptions: {},
  accountEntitlements: {},
  licenses: { userId: 'licenses.userId', id: 'licenses.id' },
  processedWebhookEvents: {
    id: 'processedWebhookEvents.id',
    eventType: 'processedWebhookEvents.eventType',
  },
  users: { id: 'users.id', stripeCustomerId: 'users.stripeCustomerId', email: 'users.email' },
  agentCreditBalance: {},
  unreconciledWebhooks: {},
  appLogs: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_c: unknown, _v: unknown) => `eq`),
  and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
  desc: vi.fn(() => 'desc'),
  isNull: vi.fn(() => 'isNull'),
  lt: vi.fn(() => 'lt'),
  sql: vi.fn(() => 'sql'),
}));

import * as loggerModule from '@revealui/core/observability/logger';
import webhooksApp from '../webhooks.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.route('/', webhooksApp);
  return app;
}

function postStripe(eventJson: unknown, sig = 'valid-sig'): Request {
  return new Request('http://localhost/stripe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig },
    body: JSON.stringify(eventJson),
  });
}

function makeRelevantEvent(id: string, livemode: boolean) {
  return {
    id,
    type: 'customer.subscription.updated',
    created: 1700000000,
    livemode,
    data: {
      object: { id: 'sub_lm', customer: 'cus_lm', status: 'active', metadata: { tier: 'pro' } },
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('D.1 / L.4 — Webhook livemode cross-check', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsertChain.values.mockResolvedValue(undefined);

    savedEnv.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    savedEnv.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
    savedEnv.STRIPE_LIVE_MODE = process.env.STRIPE_LIVE_MODE;
    savedEnv.REVEALUI_ALERT_EMAIL = process.env.REVEALUI_ALERT_EMAIL;

    process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    delete process.env.STRIPE_LIVE_MODE;
    delete process.env.REVEALUI_ALERT_EMAIL;
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  describe('mismatch: live event against test server (most dangerous)', () => {
    it('returns 400 and does not process the event', async () => {
      process.env.STRIPE_LIVE_MODE = 'false';
      const event = makeRelevantEvent('evt_lm_live_on_test', true);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(typeof body.error).toBe('string');
      expect(body.error as string).toContain('livemode mismatch');
    });

    it('includes both expected and received mode in the error message', async () => {
      process.env.STRIPE_LIVE_MODE = 'false';
      const event = makeRelevantEvent('evt_lm_msg', true);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));
      const body = (await res.json()) as Record<string, unknown>;
      const msg = body.error as string;

      expect(msg).toContain('live=false');
      expect(msg).toContain('live=true');
    });

    it('does not write to the database', async () => {
      process.env.STRIPE_LIVE_MODE = 'false';
      const event = makeRelevantEvent('evt_lm_no_db', true);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('logs CRITICAL error to stderr', async () => {
      process.env.STRIPE_LIVE_MODE = 'false';
      const event = makeRelevantEvent('evt_lm_log', true);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      expect(vi.mocked(loggerModule.logger).error).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL'),
        undefined,
        expect.objectContaining({
          eventLivemode: true,
          serverExpectsLive: false,
        }),
      );
    });

    it('fires an operator alert email', async () => {
      process.env.STRIPE_LIVE_MODE = 'false';
      process.env.REVEALUI_ALERT_EMAIL = 'ops@revealui.com';
      const event = makeRelevantEvent('evt_lm_alert', true);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      await vi.waitFor(
        () => {
          expect(mockSendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
              to: 'ops@revealui.com',
              subject: expect.stringContaining('SECURITY'),
            }),
          );
        },
        { timeout: 1000 },
      );
    });

    it('falls back to founder@revealui.com when REVEALUI_ALERT_EMAIL unset', async () => {
      process.env.STRIPE_LIVE_MODE = 'false';
      const event = makeRelevantEvent('evt_lm_alert_default', true);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      await vi.waitFor(
        () => {
          expect(mockSendEmail).toHaveBeenCalledWith(
            expect.objectContaining({ to: 'founder@revealui.com' }),
          );
        },
        { timeout: 1000 },
      );
    });
  });

  describe('mismatch: test event against live server', () => {
    it('returns 400 and does not process the event', async () => {
      process.env.STRIPE_LIVE_MODE = 'true';
      const event = makeRelevantEvent('evt_lm_test_on_live', false);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error as string).toContain('livemode mismatch');
    });

    it('does not write to the database', async () => {
      process.env.STRIPE_LIVE_MODE = 'true';
      const event = makeRelevantEvent('evt_lm_test_no_db', false);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('matching mode — event processes normally', () => {
    it('test server + test event proceeds past livemode check', async () => {
      process.env.STRIPE_LIVE_MODE = 'false';
      const event = makeRelevantEvent('evt_lm_match_test', false);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).not.toBe(400);
    });

    it('live server + live event proceeds past livemode check', async () => {
      process.env.STRIPE_LIVE_MODE = 'true';
      const event = makeRelevantEvent('evt_lm_match_live', true);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).not.toBe(400);
    });

    it('unset STRIPE_LIVE_MODE (falsy) + test event proceeds normally', async () => {
      delete process.env.STRIPE_LIVE_MODE;
      const event = makeRelevantEvent('evt_lm_unset_test', false);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      const res = await app.request(postStripe(event));

      expect(res.status).not.toBe(400);
    });
  });

  describe('Mode column threading — writer tests (GAP-266 Track B)', () => {
    function makeSubscriptionCreatedEvent(id: string, livemode: boolean) {
      return {
        id,
        type: 'customer.subscription.created',
        created: 1700000000,
        livemode,
        data: {
          object: {
            id: 'sub_mode_test',
            customer: 'cus_mode_test',
            status: 'active',
            metadata: {},
            cancel_at_period_end: false,
            items: { data: [] },
          },
        },
      };
    }

    function makeSelectWithAccount(accountId: string) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ accountId }]),
          }),
        }),
      };
    }

    it('writes mode=live on every insert when event.livemode=true', async () => {
      process.env.STRIPE_LIVE_MODE = 'true';

      // First db.select() is from resolveHostedAccountId — return an account so
      // syncHostedSubscriptionState proceeds to the insert path.
      mockDb.select.mockReturnValueOnce(makeSelectWithAccount('acct_mode_live'));

      const capturedInserts: Record<string, unknown>[] = [];
      mockDbInsertChain.values.mockImplementation((vals: Record<string, unknown>) => {
        capturedInserts.push(vals);
        return Promise.resolve(undefined);
      });

      const event = makeSubscriptionCreatedEvent('evt_mode_live_writer', true);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      const modeInserts = capturedInserts.filter((v) => 'mode' in v);
      expect(modeInserts.length).toBeGreaterThan(0);
      for (const row of modeInserts) {
        expect(row.mode).toBe('live');
      }
    });

    it('writes mode=test on every insert when event.livemode=false', async () => {
      process.env.STRIPE_LIVE_MODE = 'false';

      mockDb.select.mockReturnValueOnce(makeSelectWithAccount('acct_mode_test'));

      const capturedInserts: Record<string, unknown>[] = [];
      mockDbInsertChain.values.mockImplementation((vals: Record<string, unknown>) => {
        capturedInserts.push(vals);
        return Promise.resolve(undefined);
      });

      const event = makeSubscriptionCreatedEvent('evt_mode_test_writer', false);
      mockConstructEvent.mockReturnValueOnce(event);

      const app = createApp();
      await app.request(postStripe(event));

      const modeInserts = capturedInserts.filter((v) => 'mode' in v);
      expect(modeInserts.length).toBeGreaterThan(0);
      for (const row of modeInserts) {
        expect(row.mode).toBe('test');
      }
    });
  });
});
