/**
 * GAP-212 — seed-stripe unit coverage: meter creation, overage price, meter env,
 * tax constants, idempotency, and dry-run zero-writes. Stripe SDK is fully mocked.
 *
 * Imports stripe-billing-meter (not the CLI seeder) so tests need no dotenv /
 * or live Stripe seed. Stripe resolves via the root install graph when the
 * seeder itself runs.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AGENT_METER_DISPLAY_NAME,
  AGENT_METER_EVENT_NAME,
  AGENT_OVERAGE_ENV_KEY,
  AGENT_OVERAGE_PRICE_KEY,
  AGENT_OVERAGE_PRODUCT_KEY,
  AGENT_OVERAGE_UNIT_AMOUNT_DECIMAL,
  applyAgentMeterEnv,
  ensureAgentOveragePrice,
  ensureBillingMeter,
  PRICE_TAX_BEHAVIOR,
  PRODUCT_TAX_CODE,
} from '../stripe-billing-meter.js';

type AutoPageList<T> = {
  autoPagingToArray: (opts: { limit: number }) => Promise<T[]>;
};

function mockStripe(
  opts: {
    meters?: Stripe.Billing.Meter[];
    products?: Stripe.Product[];
    prices?: Stripe.Price[];
  } = {},
) {
  const meters = opts.meters ?? [];
  const products = opts.products ?? [];
  const prices = opts.prices ?? [];

  const metersList = vi.fn(
    (): AutoPageList<Stripe.Billing.Meter> => ({
      autoPagingToArray: vi.fn(async () => meters),
    }),
  );
  const metersCreate = vi.fn(async (params: Stripe.Billing.MeterCreateParams) => ({
    id: 'mtr_created',
    object: 'billing.meter',
    event_name: params.event_name,
    display_name: params.display_name,
    status: 'active',
  }));

  const productsList = vi.fn(
    (): AutoPageList<Stripe.Product> => ({
      autoPagingToArray: vi.fn(async () => products),
    }),
  );
  const productsCreate = vi.fn(async (params: Stripe.ProductCreateParams) => ({
    id: 'prod_overage',
    object: 'product',
    name: params.name,
    metadata: params.metadata ?? {},
    active: true,
  }));
  const productsUpdate = vi.fn();

  const pricesList = vi.fn(
    (): AutoPageList<Stripe.Price> => ({
      autoPagingToArray: vi.fn(async () => prices),
    }),
  );
  const pricesCreate = vi.fn(async (params: Stripe.PriceCreateParams) => ({
    id: 'price_overage_new',
    object: 'price',
    lookup_key: params.lookup_key ?? null,
    unit_amount_decimal: params.unit_amount_decimal ?? null,
    recurring: params.recurring
      ? {
          interval: params.recurring.interval,
          usage_type: params.recurring.usage_type ?? 'licensed',
          meter: params.recurring.meter ?? null,
        }
      : null,
    metadata: params.metadata ?? {},
    active: true,
  }));
  const pricesUpdate = vi.fn();

  return {
    stripe: {
      billing: { meters: { list: metersList, create: metersCreate } },
      products: { list: productsList, create: productsCreate, update: productsUpdate },
      prices: { list: pricesList, create: pricesCreate, update: pricesUpdate },
    } as unknown as Stripe,
    metersList,
    metersCreate,
    productsList,
    productsCreate,
    pricesList,
    pricesCreate,
    pricesUpdate,
  };
}

const silentLog = {
  info: () => {},
  success: () => {},
  warn: () => {},
};

describe('tax + meter constants (GAP-212)', () => {
  it('uses SaaS tax code and exclusive tax_behavior', () => {
    expect(PRODUCT_TAX_CODE).toBe('txcd_10103000');
    expect(PRICE_TAX_BEHAVIOR).toBe('exclusive');
  });

  it('locks the agent meter event name the runtime emits', () => {
    expect(AGENT_METER_EVENT_NAME).toBe('agent_task_overage');
    expect(AGENT_METER_DISPLAY_NAME).toBe('Agent task overage');
  });

  it('locks provisional overage rate to Track B Starter unit economics ($0.001/task)', () => {
    // unit_amount_decimal is in cents: 0.1¢ = $0.001
    expect(AGENT_OVERAGE_UNIT_AMOUNT_DECIMAL).toBe('0.1');
    expect(AGENT_OVERAGE_PRICE_KEY).toBe('revealui_agent_task_overage');
    expect(AGENT_OVERAGE_ENV_KEY).toBe('STRIPE_AGENT_OVERAGE_PRICE_ID');
  });
});

describe('applyAgentMeterEnv (GAP-212 step 2)', () => {
  it('always sets STRIPE_AGENT_METER_EVENT_NAME for revvault / Vercel sync', () => {
    const envVars: Record<string, string> = { STRIPE_PRICE_PRO_MONTHLY: 'price_x' };
    applyAgentMeterEnv(envVars);
    expect(envVars.STRIPE_AGENT_METER_EVENT_NAME).toBe(AGENT_METER_EVENT_NAME);
    expect(envVars[AGENT_OVERAGE_ENV_KEY]).toBeUndefined();
  });

  it('sets STRIPE_AGENT_OVERAGE_PRICE_ID when an overage price id is provided', () => {
    const envVars: Record<string, string> = {};
    applyAgentMeterEnv(envVars, 'price_overage_live');
    expect(envVars[AGENT_OVERAGE_ENV_KEY]).toBe('price_overage_live');
  });

  it('maps overage + meter env keys in the private vercel sync manifest', async () => {
    const { resolveManifestPath } = await import('../../sync/resolve-manifest-dir.js');
    const manifestPath = resolveManifestPath('vercel');
    if (!manifestPath) return;
    const manifest = await readFile(manifestPath, 'utf8');
    expect(manifest.includes('STRIPE_AGENT_METER_EVENT_NAME')).toBe(true);
    expect(manifest.includes('STRIPE_AGENT_OVERAGE_PRICE_ID')).toBe(true);
  });
});

describe('ensureBillingMeter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns existing meter without create (idempotent)', async () => {
    const existing = {
      id: 'mtr_existing',
      event_name: AGENT_METER_EVENT_NAME,
      display_name: AGENT_METER_DISPLAY_NAME,
      status: 'active',
    } as Stripe.Billing.Meter;
    const { stripe, metersList, metersCreate } = mockStripe({ meters: [existing] });

    const result = await ensureBillingMeter(stripe, false, silentLog);

    expect(result).toEqual(existing);
    expect(metersCreate).not.toHaveBeenCalled();
    expect(metersList).toHaveBeenCalledWith({ status: 'active' });
  });

  it('creates the meter when missing (live path)', async () => {
    const { stripe, metersCreate } = mockStripe({ meters: [] });

    const result = await ensureBillingMeter(stripe, false, silentLog);

    expect(result).toMatchObject({
      id: 'mtr_created',
      event_name: AGENT_METER_EVENT_NAME,
    });
    expect(metersCreate).toHaveBeenCalledOnce();
    const params = metersCreate.mock.calls[0][0] as Stripe.Billing.MeterCreateParams;
    expect(params.event_name).toBe(AGENT_METER_EVENT_NAME);
    expect(params.display_name).toBe(AGENT_METER_DISPLAY_NAME);
    expect(params.default_aggregation).toEqual({ formula: 'sum' });
    expect(params.customer_mapping).toEqual({
      type: 'by_id',
      event_payload_key: 'stripe_customer_id',
    });
    expect(params.value_settings).toEqual({ event_payload_key: 'value' });
  });

  it('dry-run: lists but never creates when meter is missing', async () => {
    const { stripe, metersList, metersCreate } = mockStripe({ meters: [] });

    const result = await ensureBillingMeter(stripe, true, silentLog);

    expect(result).toBeNull();
    expect(metersList).toHaveBeenCalledOnce();
    expect(metersCreate).not.toHaveBeenCalled();
  });
});

describe('ensureAgentOveragePrice (GAP-212 step 1, shared SKU)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns existing metered price without create (idempotent)', async () => {
    const product = {
      id: 'prod_exist',
      metadata: { revealui_product_key: AGENT_OVERAGE_PRODUCT_KEY },
      active: true,
    } as unknown as Stripe.Product;
    const price = {
      id: 'price_exist',
      lookup_key: AGENT_OVERAGE_PRICE_KEY,
      unit_amount_decimal: AGENT_OVERAGE_UNIT_AMOUNT_DECIMAL,
      recurring: { usage_type: 'metered', interval: 'month', meter: 'mtr_x' },
      metadata: { revealui_price_key: AGENT_OVERAGE_PRICE_KEY },
      active: true,
    } as unknown as Stripe.Price;
    const { stripe, productsCreate, pricesCreate } = mockStripe({
      products: [product],
      prices: [price],
    });

    const id = await ensureAgentOveragePrice(stripe, 'mtr_x', false, silentLog);

    expect(id).toBe('price_exist');
    expect(productsCreate).not.toHaveBeenCalled();
    expect(pricesCreate).not.toHaveBeenCalled();
  });

  it('creates product + metered price linked to the meter', async () => {
    const { stripe, productsCreate, pricesCreate } = mockStripe({ products: [], prices: [] });

    const id = await ensureAgentOveragePrice(stripe, 'mtr_live', false, silentLog);

    expect(id).toBe('price_overage_new');
    expect(productsCreate).toHaveBeenCalledOnce();
    expect(pricesCreate).toHaveBeenCalledOnce();
    const priceParams = pricesCreate.mock.calls[0][0] as Stripe.PriceCreateParams;
    expect(priceParams.lookup_key).toBe(AGENT_OVERAGE_PRICE_KEY);
    expect(priceParams.unit_amount_decimal).toBe(AGENT_OVERAGE_UNIT_AMOUNT_DECIMAL);
    expect(priceParams.tax_behavior).toBe(PRICE_TAX_BEHAVIOR);
    expect(priceParams.recurring).toEqual({
      interval: 'month',
      usage_type: 'metered',
      meter: 'mtr_live',
    });
  });

  it('dry-run: zero price creates when product missing', async () => {
    const { stripe, productsCreate, pricesCreate } = mockStripe({ products: [], prices: [] });

    const id = await ensureAgentOveragePrice(stripe, 'mtr_x', true, silentLog);

    expect(id).toBeNull();
    expect(productsCreate).not.toHaveBeenCalled();
    expect(pricesCreate).not.toHaveBeenCalled();
  });

  it('dry-run with existing product: would create price only (no write)', async () => {
    const product = {
      id: 'prod_exist',
      metadata: { revealui_product_key: AGENT_OVERAGE_PRODUCT_KEY },
      active: true,
    } as unknown as Stripe.Product;
    const { stripe, pricesCreate } = mockStripe({ products: [product], prices: [] });

    const id = await ensureAgentOveragePrice(stripe, 'mtr_x', true, silentLog);

    expect(id).toBeNull();
    expect(pricesCreate).not.toHaveBeenCalled();
  });

  it('skips price create when meter id is missing', async () => {
    const product = {
      id: 'prod_exist',
      metadata: { revealui_product_key: AGENT_OVERAGE_PRODUCT_KEY },
      active: true,
    } as unknown as Stripe.Product;
    const { stripe, pricesCreate } = mockStripe({ products: [product], prices: [] });

    const id = await ensureAgentOveragePrice(stripe, null, false, silentLog);

    expect(id).toBeNull();
    expect(pricesCreate).not.toHaveBeenCalled();
  });
});

describe('seed-stripe.ts wiring (source lock)', () => {
  it('wires meter + overage helpers, tax fields, and direct-run guard', async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const content = await readFile(resolve(here, '..', 'seed-stripe.ts'), 'utf8');
    expect(content.includes('tax_behavior: PRICE_TAX_BEHAVIOR')).toBe(true);
    expect(content.includes('tax_code: PRODUCT_TAX_CODE')).toBe(true);
    expect(content.includes('applyAgentMeterEnv(envVars, overagePriceId)')).toBe(true);
    expect(content.includes('ensureAgentOveragePrice')).toBe(true);
    expect(content.includes("from './stripe-billing-meter.js'")).toBe(true);
    expect(content.includes("from './stripe-connection-probe.js'")).toBe(true);
    expect(content.includes('pathToFileURL')).toBe(true);
    expect(content.includes('isDirectRun')).toBe(true);
    expect(content.includes('shouldPauseForLiveKeyAbort')).toBe(true);
    expect(content.includes('probeStripeConnection')).toBe(true);
    expect(content.includes('LIVE_KEY_ABORT_DELAY_MS')).toBe(true);
  });
});

describe('probeStripeConnection (check-mode catalog probe)', () => {
  it('uses products.list in --check mode and never calls balance.retrieve', async () => {
    const { probeStripeConnection } = await import('../stripe-connection-probe.js');
    const productsList = vi.fn(async () => ({ data: [] }));
    const balanceRetrieve = vi.fn(async () => {
      throw new Error('balance_read must not be required in check mode');
    });
    await probeStripeConnection(
      {
        products: { list: productsList },
        balance: { retrieve: balanceRetrieve },
      },
      true,
    );
    expect(productsList).toHaveBeenCalledWith({ active: true, limit: 1 });
    expect(balanceRetrieve).not.toHaveBeenCalled();
  });

  it('uses balance.retrieve for mutating seed runs', async () => {
    const { probeStripeConnection } = await import('../stripe-connection-probe.js');
    const productsList = vi.fn(async () => ({ data: [] }));
    const balanceRetrieve = vi.fn(async () => ({ object: 'balance' }));
    await probeStripeConnection(
      {
        products: { list: productsList },
        balance: { retrieve: balanceRetrieve },
      },
      false,
    );
    expect(balanceRetrieve).toHaveBeenCalledOnce();
    expect(productsList).not.toHaveBeenCalled();
  });
});
