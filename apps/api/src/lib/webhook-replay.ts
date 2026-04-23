import { createHmac } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import type { getClient } from '@revealui/db';
import { processedWebhookEvents } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';

/** Minimum interface needed to replay events — any `fetch`-callable Hono. */
export interface WebhookFetchable {
  fetch(request: Request): Response | Promise<Response>;
}

type DbClient = ReturnType<typeof getClient>;

export type ReplayOutcome =
  | { kind: 'replayed'; status: number; duplicate?: boolean }
  | { kind: 'event-missing'; detail: string }
  | { kind: 'stripe-error'; detail: string }
  | { kind: 'handler-error'; status: number; body: unknown };

export interface ReplayDeps {
  stripe: Stripe;
  db: DbClient;
  webhookSecret: string;
  /**
   * The mounted webhooks app (exported from `routes/webhooks.ts`). Replay
   * invokes `webhooksApp.fetch(...)` in-process rather than crossing the
   * network — same handler, same DB connection pool, no extra cold start.
   */
  webhooksApp: WebhookFetchable;
}

/**
 * Build a Stripe `Stripe-Signature` header for `payload` using `secret`.
 *
 * Matches the `v1` signing scheme that `stripe.webhooks.constructEventAsync`
 * verifies: `t=<unix-seconds>,v1=<hex-hmac-sha256(secret, "<ts>.<payload>")>`.
 * We do this inline rather than via `webhooks.generateTestHeaderStringAsync`
 * because the SDK's typed signature demands every option as required (including
 * `timestamp`, `scheme`, `signature`, `cryptoProvider`) even though in practice
 * only `payload` + `secret` are needed at runtime. Signing with `crypto`
 * directly keeps the shape documented and untangled from SDK typing drift.
 */
function signStripePayload(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

/**
 * Replay a previously-failed Stripe webhook event through the main handler.
 *
 * Stripe is the source of truth — our `unreconciledWebhooks` row captures
 * only metadata; we never trust it for replay. Steps:
 *
 *   1. Fetch the canonical event from Stripe (`events.retrieve`). If the
 *      event no longer exists (test-mode data deleted, etc.), report
 *      `event-missing`; the caller decides whether that counts as resolved.
 *   2. Delete any stale idempotency marker. The whole reason the row
 *      landed in `unreconciledWebhooks` is that the marker survived a
 *      failed unmark, so the normal handler would short-circuit as
 *      duplicate. Clearing the marker makes the handler run the full
 *      processing path instead.
 *   3. Re-sign the event JSON with the real webhook secret and POST the
 *      signed payload back into the mounted webhooks Hono app. The handler
 *      runs end-to-end: signature verification, idempotency insert (now
 *      succeeds since the marker was cleared), event dispatch.
 */
export async function replayStripeEvent(deps: ReplayDeps, eventId: string): Promise<ReplayOutcome> {
  let event: Stripe.Event;
  try {
    event = (await deps.stripe.events.retrieve(eventId)) as Stripe.Event;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const status =
      typeof (err as { statusCode?: unknown }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : undefined;
    if (status === 404) {
      return { kind: 'event-missing', detail };
    }
    return { kind: 'stripe-error', detail };
  }

  try {
    await deps.db.delete(processedWebhookEvents).where(eq(processedWebhookEvents.id, eventId));
  } catch (err) {
    logger.error('[webhook-replay] failed to clear stale idempotency marker', undefined, {
      eventId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      kind: 'stripe-error',
      detail: 'Failed to clear stale idempotency marker before replay',
    };
  }

  const payload = JSON.stringify(event);
  const signatureHeader = signStripePayload(payload, deps.webhookSecret);

  const req = new Request('http://localhost/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signatureHeader,
    },
    body: payload,
  });

  const res = await deps.webhooksApp.fetch(req);
  const body = await res.json().catch(() => null);

  if (res.status >= 500) {
    return { kind: 'handler-error', status: res.status, body };
  }

  const duplicate =
    typeof body === 'object' &&
    body !== null &&
    'duplicate' in body &&
    (body as { duplicate: unknown }).duplicate === true;

  return { kind: 'replayed', status: res.status, duplicate };
}
