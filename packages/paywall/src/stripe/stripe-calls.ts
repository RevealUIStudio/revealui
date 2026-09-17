import { getMeterEventTimestamp } from './pure.js';
import {
  type IncompleteSubscriptionIntent,
  type OverageRow,
  PaywallBillingError,
  type ProtectedStripe,
  type RefundResult,
  type StripeRefundReason,
} from './types.js';

/**
 * Issue a Stripe refund. Caller supplies the circuit-broken client.
 *
 * @example
 * ```ts
 * import { issueRefund } from '@revealui/paywall/stripe';
 * const result = await issueRefund(stripe, { paymentIntentId, amount });
 * ```
 */
export async function issueRefund(
  stripe: ProtectedStripe,
  params: {
    paymentIntentId?: string;
    chargeId?: string;
    amount?: number;
    reason?: StripeRefundReason;
  },
): Promise<RefundResult> {
  const { paymentIntentId, chargeId, amount, reason } = params;
  const refund = await stripe.refunds.create(
    {
      ...(paymentIntentId ? { payment_intent: paymentIntentId } : {}),
      ...(chargeId ? { charge: chargeId } : {}),
      ...(amount ? { amount } : {}),
      ...(reason ? { reason } : {}),
    },
    {
      idempotencyKey: `refund-${chargeId ?? paymentIntentId}-${amount ?? 'full'}`,
    },
  );
  return {
    refundId: refund.id,
    status: refund.status ?? 'pending',
    amount: refund.amount,
    currency: refund.currency,
  };
}

/**
 * Report agent-task overage rows to Stripe Billing Meters.
 *
 * @example
 * ```ts
 * import { reportAgentOverage } from '@revealui/paywall/stripe';
 * const { reported, skipped } = await reportAgentOverage(stripe, rows);
 * ```
 */
export async function reportAgentOverage(
  stripe: ProtectedStripe,
  overageRows: OverageRow[],
  options: {
    meterEventName?: string;
    cycleStart?: Date;
    onError?: (row: OverageRow, err: unknown) => void;
  } = {},
): Promise<{ reported: number; skipped: number }> {
  const meterEventName = options.meterEventName ?? 'agent_task_overage';
  const cycleStart =
    options.cycleStart ??
    (() => {
      const now = new Date();
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    })();
  const timestamp = getMeterEventTimestamp(cycleStart);

  let reported = 0;
  let skipped = 0;
  for (const row of overageRows) {
    if (!row.stripeCustomerId) {
      skipped++;
      continue;
    }
    try {
      await stripe.billing.meterEvents.create(
        {
          event_name: meterEventName,
          payload: {
            stripe_customer_id: row.stripeCustomerId,
            value: String(row.overage),
          },
          timestamp,
        },
        { idempotencyKey: `overage-${row.userId}-${cycleStart}` },
      );
      reported++;
    } catch (err) {
      options.onError?.(row, err);
      skipped++;
    }
  }
  return { reported, skipped };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function invoiceClientSecret(latestInvoice: unknown): string | null {
  if (!isRecord(latestInvoice)) return null;
  const intent = latestInvoice.payment_intent;
  if (!isRecord(intent)) return null;
  return typeof intent.client_secret === 'string' ? intent.client_secret : null;
}

/**
 * Create a subscription that stays `incomplete` until the client confirms
 * the first invoice PaymentIntent (Payment Element / 3DS).
 *
 * @example
 * ```ts
 * import { createSubscriptionWithIncompleteIntent } from '@revealui/paywall/stripe';
 * const { clientSecret } = await createSubscriptionWithIncompleteIntent(stripe, {
 *   customerId: 'cus_1',
 *   priceId: 'price_1',
 * });
 * ```
 */
export async function createSubscriptionWithIncompleteIntent(
  stripe: ProtectedStripe,
  params: {
    customerId: string;
    priceId: string;
    metadata?: Record<string, string>;
  },
): Promise<IncompleteSubscriptionIntent> {
  const subscription = await stripe.subscriptions.create(
    {
      customer: params.customerId,
      items: [{ price: params.priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      ...(params.metadata ? { metadata: params.metadata } : {}),
    },
    {
      idempotencyKey: `incomplete-sub-${params.customerId}-${params.priceId}`,
    },
  );
  const clientSecret = invoiceClientSecret(subscription.latest_invoice);
  if (!clientSecret) {
    throw new PaywallBillingError(
      500,
      'Stripe did not return a PaymentIntent client_secret for the incomplete subscription',
    );
  }
  return {
    subscriptionId: subscription.id,
    clientSecret,
    status: subscription.status,
  };
}
