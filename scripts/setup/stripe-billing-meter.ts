/**
 * Stripe Billing Meter helpers for agent-task overage (Track B).
 *
 * Extracted from seed-stripe.ts so unit tests can exercise meter create /
 * idempotency / dry-run without importing the seeder CLI (dotenv + Stripe
 * require + import.meta main). GAP-212.
 *
 * Runtime attaches a single shared metered price to Pro/Max checkouts via
 * STRIPE_AGENT_OVERAGE_PRICE_ID (Enterprise is unlimited — no overage item).
 * Code-over-docs: that is one SKU, not three per-tier rows.
 */

import type Stripe from 'stripe';

/** Track B meter event name (runtime fallback matches this literal). */
export const AGENT_METER_EVENT_NAME = 'agent_task_overage';
export const AGENT_METER_DISPLAY_NAME = 'Agent task overage';

/** Product + price handles for the shared overage SKU. */
export const AGENT_OVERAGE_PRODUCT_KEY = 'revealui_agent_task_overage';
export const AGENT_OVERAGE_PRICE_KEY = 'revealui_agent_task_overage';
export const AGENT_OVERAGE_PRODUCT_NAME = 'RevealUI agent task overage';
export const AGENT_OVERAGE_ENV_KEY = 'STRIPE_AGENT_OVERAGE_PRICE_ID';

/**
 * Provisional per-task rate in **cents** as a decimal string (Stripe
 * unit_amount_decimal). $0.001/task = 0.1¢, aligned to offerings-canonical
 * Track B Starter credit unit economics until the owner sets a distinct
 * overage ladder. Early-access overage is not yet revenue-active.
 */
export const AGENT_OVERAGE_UNIT_AMOUNT_DECIMAL = '0.1';

/** Stripe Tax: SaaS product class. */
export const PRODUCT_TAX_CODE = 'txcd_10103000';

/** tax_behavior is immutable once set non-unspecified — exclusive = B2B norm. */
export const PRICE_TAX_BEHAVIOR: Stripe.PriceCreateParams.TaxBehavior = 'exclusive';

export interface SeedStripeLog {
  info: (msg: string) => void;
  success: (msg: string) => void;
  warn?: (msg: string) => void;
}

const defaultLog: SeedStripeLog = {
  info: (msg) => console.log(`  i ${msg}`),
  success: (msg) => console.log(`  ✓ ${msg}`),
  warn: (msg) => console.log(`  ! ${msg}`),
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
 * Idempotently ensure the shared metered overage product + price exist and
 * return the active price id for STRIPE_AGENT_OVERAGE_PRICE_ID.
 *
 * Requires a Billing Meter id (from ensureBillingMeter). On dry-run with no
 * existing meter/price, returns null (no write).
 */
export async function ensureAgentOveragePrice(
  stripe: Stripe,
  meterId: string | null,
  dryRun: boolean,
  log: SeedStripeLog = defaultLog,
): Promise<string | null> {
  log.info('');
  log.info(`Overage product key: ${AGENT_OVERAGE_PRODUCT_KEY}`);

  const allProducts = await stripe.products
    .list({ active: true })
    .autoPagingToArray({ limit: 10_000 });
  let product = allProducts.find(
    (p) => p.metadata?.revealui_product_key === AGENT_OVERAGE_PRODUCT_KEY,
  );

  if (!product) {
    if (dryRun) {
      log.info(`Would create product: ${AGENT_OVERAGE_PRODUCT_NAME}`);
      return null;
    }
    product = await stripe.products.create({
      name: AGENT_OVERAGE_PRODUCT_NAME,
      description:
        'Metered agent-task overage for Pro/Max subscriptions (shared SKU). Linked to the agent_task_overage Billing Meter.',
      tax_code: PRODUCT_TAX_CODE,
      // Intentionally no revealui_track / revealui_tier: catalog orphan
      // reconciliation treats those as managed CATALOG products and would
      // archive this shared overage SKU (see isManagedProduct).
      metadata: {
        revealui_product_key: AGENT_OVERAGE_PRODUCT_KEY,
      },
      unit_label: 'task',
    });
    log.success(`Created product: ${product.id}`);
  } else {
    log.success(`Product exists: ${product.id}`);
  }

  const existingPrices = await stripe.prices
    .list({ product: product.id, active: true })
    .autoPagingToArray({ limit: 10_000 });

  const matching = existingPrices.find(
    (p) =>
      (p.lookup_key === AGENT_OVERAGE_PRICE_KEY ||
        p.metadata?.revealui_price_key === AGENT_OVERAGE_PRICE_KEY) &&
      p.recurring?.usage_type === 'metered' &&
      p.unit_amount_decimal === AGENT_OVERAGE_UNIT_AMOUNT_DECIMAL,
  );

  if (matching) {
    log.success(`Overage price exists: ${matching.id}`);
    return matching.id;
  }

  if (!meterId) {
    log.warn?.(
      'No Billing Meter id — cannot create metered overage price (dry-run without meter, or meter create failed)',
    );
    return null;
  }

  if (dryRun) {
    log.info(
      `Would create metered price: ${AGENT_OVERAGE_PRICE_KEY} ($${Number(AGENT_OVERAGE_UNIT_AMOUNT_DECIMAL) / 100}/task, meter ${meterId})`,
    );
    return null;
  }

  // Archive stale handles with different amount so lookup_key can transfer.
  const stale = existingPrices.find(
    (p) =>
      p.lookup_key === AGENT_OVERAGE_PRICE_KEY ||
      p.metadata?.revealui_price_key === AGENT_OVERAGE_PRICE_KEY,
  );
  if (stale) {
    await stripe.prices.update(stale.id, { active: false });
    log.warn?.(`Archived stale overage price: ${stale.id}`);
  }

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    // Sub-cent rate: 0.1¢ = $0.001/task (Track B Starter unit economics).
    unit_amount_decimal: AGENT_OVERAGE_UNIT_AMOUNT_DECIMAL,
    lookup_key: AGENT_OVERAGE_PRICE_KEY,
    transfer_lookup_key: true,
    metadata: { revealui_price_key: AGENT_OVERAGE_PRICE_KEY },
    tax_behavior: PRICE_TAX_BEHAVIOR,
    recurring: {
      interval: 'month',
      usage_type: 'metered',
      meter: meterId,
    },
  });

  log.success(`Created overage price: ${price.id}`);
  return price.id;
}

/**
 * Attach meter event-name (+ optional overage price id) for revvault / Vercel.
 */
export function applyAgentMeterEnv(
  envVars: Record<string, string>,
  overagePriceId?: string | null,
): void {
  envVars.STRIPE_AGENT_METER_EVENT_NAME = AGENT_METER_EVENT_NAME;
  if (overagePriceId) {
    envVars[AGENT_OVERAGE_ENV_KEY] = overagePriceId;
  }
}
