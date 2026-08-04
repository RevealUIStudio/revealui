/**
 * Stripe Billing Meter helpers for agent-task overage (Track B).
 *
 * Extracted from seed-stripe.ts so unit tests can exercise meter create /
 * idempotency / dry-run without importing the seeder CLI (dotenv + Stripe
 * require + import.meta main). GAP-212.
 */

import type Stripe from 'stripe';

/** Track B meter event name (runtime fallback matches this literal). */
export const AGENT_METER_EVENT_NAME = 'agent_task_overage';
export const AGENT_METER_DISPLAY_NAME = 'Agent task overage';

/** Stripe Tax: SaaS product class. */
export const PRODUCT_TAX_CODE = 'txcd_10103000';

/** tax_behavior is immutable once set non-unspecified — exclusive = B2B norm. */
export const PRICE_TAX_BEHAVIOR: Stripe.PriceCreateParams.TaxBehavior = 'exclusive';

export interface SeedStripeLog {
  info: (msg: string) => void;
  success: (msg: string) => void;
}

const defaultLog: SeedStripeLog = {
  info: (msg) => console.log(`  i ${msg}`),
  success: (msg) => console.log(`  ✓ ${msg}`),
};

/**
 * Idempotently ensure the agent-task overage Billing Meter exists.
 */
export async function ensureBillingMeter(
  stripe: Stripe,
  dryRun: boolean,
  log: SeedStripeLog = defaultLog,
): Promise<Stripe.Billing.Meter | null> {
  log.info('');
  log.info(`Meter event name: ${AGENT_METER_EVENT_NAME}`);

  const allMeters = await stripe.billing.meters
    .list({ status: 'active' })
    .autoPagingToArray({ limit: 10_000 });
  const match = allMeters.find((m) => m.event_name === AGENT_METER_EVENT_NAME);

  if (match) {
    log.success(`Meter exists: ${match.id} (${match.event_name})`);
    return match;
  }

  if (dryRun) {
    log.info(`Would create meter: ${AGENT_METER_EVENT_NAME} (${AGENT_METER_DISPLAY_NAME})`);
    return null;
  }

  const meter = await stripe.billing.meters.create({
    display_name: AGENT_METER_DISPLAY_NAME,
    event_name: AGENT_METER_EVENT_NAME,
    default_aggregation: { formula: 'sum' },
    customer_mapping: {
      type: 'by_id',
      event_payload_key: 'stripe_customer_id',
    },
    value_settings: { event_payload_key: 'value' },
  });

  log.success(`Created meter: ${meter.id} (${meter.event_name})`);
  return meter;
}

/**
 * Attach the meter event-name env var that runtime + revvault manifests expect.
 * Always applied after catalog sync so --sync-revvault / --sync-vercel pick it up
 * (GAP-212 step 2).
 */
export function applyAgentMeterEnv(envVars: Record<string, string>): void {
  envVars.STRIPE_AGENT_METER_EVENT_NAME = AGENT_METER_EVENT_NAME;
}
