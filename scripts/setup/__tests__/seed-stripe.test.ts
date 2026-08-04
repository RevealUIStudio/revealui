/**
 * GAP-212 — seed-stripe unit coverage: meter creation, meter env, tax constants,
 * idempotency, and dry-run zero-writes. Stripe SDK is fully mocked.
 *
 * Imports stripe-billing-meter (not the CLI seeder) so tests need no dotenv /
 * Stripe package resolution from packages/services.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AGENT_METER_DISPLAY_NAME,
  AGENT_METER_EVENT_NAME,
  applyAgentMeterEnv,
  ensureBillingMeter,
  PRICE_TAX_BEHAVIOR,
  PRODUCT_TAX_CODE,
} from '../stripe-billing-meter.js';

type MeterListResult = {
  autoPagingToArray: (opts: { limit: number }) => Promise<Stripe.Billing.Meter[]>;
};

function mockStripe(meters: Stripe.Billing.Meter[] = []) {
  const list = vi.fn(
    (): MeterListResult => ({
      autoPagingToArray: vi.fn(async () => meters),
    }),
  );
  const create = vi.fn(async (params: Stripe.Billing.MeterCreateParams) => ({
    id: 'mtr_created',
    object: 'billing.meter',
    event_name: params.event_name,
    display_name: params.display_name,
    status: 'active',
  }));

  return {
    stripe: {
      billing: {
        meters: { list, create },
      },
    } as unknown as Stripe,
    list,
    create,
  };
}

const silentLog = {
  info: () => {},
  success: () => {},
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
});

describe('applyAgentMeterEnv (GAP-212 step 2)', () => {
  it('always sets STRIPE_AGENT_METER_EVENT_NAME for revvault / Vercel sync', () => {
    const envVars: Record<string, string> = { STRIPE_PRICE_PRO_MONTHLY: 'price_x' };
    applyAgentMeterEnv(envVars);
    expect(envVars.STRIPE_AGENT_METER_EVENT_NAME).toBe(AGENT_METER_EVENT_NAME);
  });

  it('is mapped in revvault-vercel.toml so --sync-revvault can publish it', async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifest = await readFile(resolve(here, '../../sync/revvault-vercel.toml'), 'utf8');
    expect(manifest.includes('STRIPE_AGENT_METER_EVENT_NAME')).toBe(true);
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
    const { stripe, list, create } = mockStripe([existing]);

    const result = await ensureBillingMeter(stripe, false, silentLog);

    expect(result).toEqual(existing);
    expect(create).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledWith({ status: 'active' });
  });

  it('creates the meter when missing (live path)', async () => {
    const { stripe, create } = mockStripe([]);

    const result = await ensureBillingMeter(stripe, false, silentLog);

    expect(result).toMatchObject({
      id: 'mtr_created',
      event_name: AGENT_METER_EVENT_NAME,
    });
    expect(create).toHaveBeenCalledOnce();
    const params = create.mock.calls[0][0] as Stripe.Billing.MeterCreateParams;
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
    const { stripe, list, create } = mockStripe([]);

    const result = await ensureBillingMeter(stripe, true, silentLog);

    expect(result).toBeNull();
    expect(list).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
  });

  it('dry-run: returns existing meter without create', async () => {
    const existing = {
      id: 'mtr_dry',
      event_name: AGENT_METER_EVENT_NAME,
      status: 'active',
    } as Stripe.Billing.Meter;
    const { stripe, create } = mockStripe([existing]);

    const result = await ensureBillingMeter(stripe, true, silentLog);

    expect(result?.id).toBe('mtr_dry');
    expect(create).not.toHaveBeenCalled();
  });
});

describe('seed-stripe.ts wiring (source lock)', () => {
  it('wires meter helpers, tax fields, direct-run guard, and applyAgentMeterEnv', async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const content = await readFile(resolve(here, '..', 'seed-stripe.ts'), 'utf8');
    expect(content.includes('tax_behavior: PRICE_TAX_BEHAVIOR')).toBe(true);
    expect(content.includes('tax_code: PRODUCT_TAX_CODE')).toBe(true);
    expect(content.includes('applyAgentMeterEnv(envVars)')).toBe(true);
    expect(content.includes("from './stripe-billing-meter.js'")).toBe(true);
    expect(content.includes('pathToFileURL')).toBe(true);
    expect(content.includes('isDirectRun')).toBe(true);
  });
});
