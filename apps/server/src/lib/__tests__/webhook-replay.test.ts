import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/db/schema', () => ({
  processedWebhookEvents: { id: Symbol('id') },
}));

import { replayStripeEvent } from '../webhook-replay.js';

type StripeLike = {
  events: { retrieve: ReturnType<typeof vi.fn> };
  webhooks: { generateTestHeaderStringAsync: ReturnType<typeof vi.fn> };
};

function makeDb() {
  const whereMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockReturnValue({ where: whereMock });
  return {
    db: { delete: deleteMock } as unknown as Parameters<typeof replayStripeEvent>[0]['db'],
    deleteMock,
    whereMock,
  };
}

function makeWebhooksApp(handler: (req: Request) => Promise<Response> | Response): Hono {
  const app = new Hono();
  app.post('/stripe', (c) => handler(c.req.raw));
  return app;
}

function makeStripe(overrides: Partial<StripeLike> = {}): StripeLike {
  return {
    events: {
      retrieve: vi.fn().mockResolvedValue({
        id: 'evt_test_1',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_1' } },
      }),
    },
    webhooks: {
      generateTestHeaderStringAsync: vi.fn().mockResolvedValue('t=123,v1=sig'),
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('replayStripeEvent', () => {
  it('fetches the event from Stripe and posts a signed payload to the webhooks app', async () => {
    const stripe = makeStripe();
    const { db, deleteMock } = makeDb();
    const handler = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ received: true }), { status: 200 }));
    const webhooksApp = makeWebhooksApp(handler);

    const outcome = await replayStripeEvent(
      { stripe: stripe as never, db, webhookSecret: 'whsec_abc', webhooksApp },
      'evt_test_1',
    );

    expect(outcome).toEqual({ kind: 'replayed', status: 200, duplicate: false });
    expect(stripe.events.retrieve).toHaveBeenCalledWith('evt_test_1');
    expect(deleteMock).toHaveBeenCalled(); // cleared stale marker
    expect(handler).toHaveBeenCalledOnce();
    const replayedReq = handler.mock.calls[0]![0] as Request;
    // Signature has the Stripe v1 shape `t=<unix-seconds>,v1=<hex>` and uses
    // a non-empty 64-char hex HMAC so constructEventAsync will accept it.
    const sig = replayedReq.headers.get('stripe-signature') ?? '';
    expect(sig).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
  });

  it('reports event-missing when Stripe returns 404', async () => {
    const stripe = makeStripe();
    const err = new Error('No such event') as Error & { statusCode: number };
    err.statusCode = 404;
    stripe.events.retrieve.mockRejectedValueOnce(err);
    const { db } = makeDb();
    const webhooksApp = makeWebhooksApp(() => new Response(null, { status: 200 }));

    const outcome = await replayStripeEvent(
      { stripe: stripe as never, db, webhookSecret: 'whsec_abc', webhooksApp },
      'evt_gone',
    );

    expect(outcome.kind).toBe('event-missing');
  });

  it('reports stripe-error for other Stripe failures', async () => {
    const stripe = makeStripe();
    stripe.events.retrieve.mockRejectedValueOnce(new Error('network flake'));
    const { db } = makeDb();
    const webhooksApp = makeWebhooksApp(() => new Response(null, { status: 200 }));

    const outcome = await replayStripeEvent(
      { stripe: stripe as never, db, webhookSecret: 'whsec_abc', webhooksApp },
      'evt_flake',
    );

    expect(outcome).toEqual({ kind: 'stripe-error', detail: 'network flake' });
  });

  it('reports handler-error when the webhooks app returns 5xx', async () => {
    const stripe = makeStripe();
    const { db } = makeDb();
    const webhooksApp = makeWebhooksApp(
      () => new Response(JSON.stringify({ error: 'boom' }), { status: 500 }),
    );

    const outcome = await replayStripeEvent(
      { stripe: stripe as never, db, webhookSecret: 'whsec_abc', webhooksApp },
      'evt_test_1',
    );

    expect(outcome.kind).toBe('handler-error');
    if (outcome.kind === 'handler-error') {
      expect(outcome.status).toBe(500);
    }
  });

  it('returns duplicate=true when the handler reports duplicate', async () => {
    const stripe = makeStripe();
    const { db } = makeDb();
    const webhooksApp = makeWebhooksApp(
      () =>
        new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
        }),
    );

    const outcome = await replayStripeEvent(
      { stripe: stripe as never, db, webhookSecret: 'whsec_abc', webhooksApp },
      'evt_test_1',
    );

    expect(outcome).toEqual({ kind: 'replayed', status: 200, duplicate: true });
  });

  it('aborts the replay if clearing the stale marker throws', async () => {
    const stripe = makeStripe();
    const db = {
      delete: () => ({
        where: () => Promise.reject(new Error('db down')),
      }),
    } as unknown as Parameters<typeof replayStripeEvent>[0]['db'];
    const handler = vi.fn();
    const webhooksApp = makeWebhooksApp(handler);

    const outcome = await replayStripeEvent(
      { stripe: stripe as never, db, webhookSecret: 'whsec_abc', webhooksApp },
      'evt_test_1',
    );

    expect(outcome.kind).toBe('stripe-error');
    expect(handler).not.toHaveBeenCalled();
  });
});
