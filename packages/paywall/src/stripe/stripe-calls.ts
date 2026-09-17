import { getMeterEventTimestamp } from './pure.js';
import type { OverageRow, ProtectedStripe, RefundResult, StripeRefundReason } from './types.js';

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
