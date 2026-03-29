/**
 * Stripe Billing Meter Utilities
 *
 * Reusable helpers for reporting usage to Stripe Billing Meters.
 * Replaces the deprecated `subscriptionItems.createUsageRecord()` API with
 * `billing.meterEvents.create()`.
 *
 * ## Prerequisites (Stripe Dashboard)
 *
 * Before this module can send meter events, the account owner must:
 *
 * 1. Create a **Billing Meter** in Stripe Dashboard -> Billing -> Meters.
 *    Set the `event_name` to a descriptive slug (e.g. `agent_task_overage`).
 *    Configure `customer_mapping.event_payload_key` = `stripe_customer_id`
 *    and `value_settings.event_payload_key` = `value`.
 *
 * 2. Create a **metered Price** linked to the Meter. Attach the Price to
 *    subscription line items for customers who should be billed for overages.
 *
 * 3. Set the `STRIPE_AGENT_METER_EVENT_NAME` environment variable to the
 *    `event_name` configured in step 1. If the variable is missing, all
 *    reporting functions return early without error (graceful degradation).
 */

import { createLogger } from '@revealui/core/observability/logger';
import type Stripe from 'stripe';

const logger = createLogger({ service: 'StripeBilling' });

// ---------------------------------------------------------------------------
// Configuration (parameterized per .claude/rules/parameterization.md)
// ---------------------------------------------------------------------------

/** Configuration for the Stripe Billing Meter reporter. */
export interface MeterReporterConfig {
  /**
   * The Stripe meter event name (must match the Meter created in the Stripe Dashboard).
   * When `undefined`, all reporting is silently skipped (owner setup not complete).
   */
  meterEventName: string | undefined;
}

/**
 * Explicit override (set via `configureMeterReporter`).
 * When `null`, the meter event name is resolved lazily from
 * `process.env.STRIPE_AGENT_METER_EVENT_NAME` on every call so that tests
 * manipulating the env var between cases work without resetting module state.
 */
let overrideConfig: MeterReporterConfig | null = null;

/** Resolve the effective configuration (explicit override or env-based default). */
function resolveConfig(): MeterReporterConfig {
  if (overrideConfig) return overrideConfig;
  return { meterEventName: process.env.STRIPE_AGENT_METER_EVENT_NAME };
}

/**
 * Override the default meter reporter configuration.
 * Useful for tests or multi-tenant setups with different meter names.
 */
export function configureMeterReporter(overrides: Partial<MeterReporterConfig>): void {
  overrideConfig = { meterEventName: process.env.STRIPE_AGENT_METER_EVENT_NAME, ...overrides };
}

/**
 * Reset the meter reporter configuration to lazy env-based defaults.
 * Primarily for testing.
 */
export function resetMeterReporterConfig(): void {
  overrideConfig = null;
}

// ---------------------------------------------------------------------------
// Timestamp helper
// ---------------------------------------------------------------------------

/**
 * Computes a Stripe meter event timestamp for the last second of a billing cycle.
 *
 * Stripe Billing Meters require event timestamps to fall within the billing period
 * they are associated with. Since overage is reported for the *previous* calendar
 * month, the timestamp must be within that month -- not the current month when the
 * cron runs.
 *
 * Takes the cycle start (1st of the previous month at 00:00 UTC), adds ~30 days
 * (one calendar-month approximation), then subtracts 1 second to land on the last
 * second of that cycle. Stripe only checks that the timestamp falls within the
 * subscription's billing interval.
 *
 * @param cycleStart - The first day of the billing cycle (UTC midnight)
 * @returns Unix timestamp (seconds) for the last second of the approximate cycle
 */
export function getMeterEventTimestamp(cycleStart: Date): number {
  const SecondsIn30Days = 30 * 24 * 60 * 60;
  return Math.floor(cycleStart.getTime() / 1000 + SecondsIn30Days - 1);
}

// ---------------------------------------------------------------------------
// Core reporting function
// ---------------------------------------------------------------------------

/** Result of a single meter event report attempt. */
export interface MeterEventResult {
  /** Whether the event was successfully sent to Stripe. */
  success: boolean;
  /** Error message if the event failed (undefined on success). */
  error?: string;
}

/**
 * Report a single meter event to a Stripe Billing Meter.
 *
 * Uses `stripe.billing.meterEvents.create()` (the replacement for the
 * deprecated `subscriptionItems.createUsageRecord()` API).
 *
 * @param stripe - A Stripe client instance (raw or protected)
 * @param params - The meter event parameters
 * @returns Result indicating success or failure
 */
export async function reportMeterEvent(
  stripe: Pick<Stripe, 'billing'>,
  params: {
    /** Stripe customer ID to attribute the usage to. */
    stripeCustomerId: string;
    /** Usage value (quantity). Will be stringified for the Stripe payload. */
    value: number;
    /**
     * Optional Unix timestamp (seconds) for the event.
     * Defaults to current time if not provided.
     * Use `getMeterEventTimestamp()` for retroactive billing cycle events.
     */
    timestamp?: number;
    /**
     * Optional idempotency identifier for the event.
     * Stripe enforces uniqueness within a rolling 24-hour period.
     */
    identifier?: string;
  },
): Promise<MeterEventResult> {
  const eventName = resolveConfig().meterEventName;

  if (!eventName) {
    logger.debug('Meter event skipped: STRIPE_AGENT_METER_EVENT_NAME not configured');
    return { success: false, error: 'meter_not_configured' };
  }

  const meterParams: Stripe.Billing.MeterEventCreateParams = {
    event_name: eventName,
    payload: {
      stripe_customer_id: params.stripeCustomerId,
      value: String(params.value),
    },
  };

  if (params.timestamp !== undefined) {
    meterParams.timestamp = params.timestamp;
  }

  if (params.identifier !== undefined) {
    meterParams.identifier = params.identifier;
  }

  try {
    await stripe.billing.meterEvents.create(meterParams);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to create Stripe meter event', err instanceof Error ? err : undefined, {
      event_name: eventName,
      stripe_customer_id: params.stripeCustomerId,
      value: params.value,
    });
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Batch reporting
// ---------------------------------------------------------------------------

/** Summary returned by `reportMeterEventBatch`. */
export interface MeterEventBatchResult {
  /** Number of events successfully sent. */
  reported: number;
  /** Number of events that were skipped or failed. */
  skipped: number;
}

/** A single overage row to be reported. */
export interface OverageRow {
  /** Stripe customer ID (null/undefined = skip). */
  stripeCustomerId: string | null | undefined;
  /** Overage quantity to report. */
  overage: number;
}

/**
 * Report a batch of overage meter events to Stripe.
 *
 * Iterates over `rows`, skipping any without a `stripeCustomerId`, and
 * calls `reportMeterEvent` for each valid row. Failures are counted as
 * skipped (non-throwing).
 *
 * @param stripe - A Stripe client instance (raw or protected)
 * @param rows - Overage rows to report
 * @param cycleStart - The billing cycle start date (used for timestamp attribution)
 * @returns Batch summary with reported/skipped counts
 */
export async function reportMeterEventBatch(
  stripe: Pick<Stripe, 'billing'>,
  rows: ReadonlyArray<OverageRow>,
  cycleStart: Date,
): Promise<MeterEventBatchResult> {
  if (!resolveConfig().meterEventName) {
    return { reported: 0, skipped: 0 };
  }

  const timestamp = getMeterEventTimestamp(cycleStart);
  let reported = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.stripeCustomerId) {
      skipped++;
      continue;
    }

    const result = await reportMeterEvent(stripe, {
      stripeCustomerId: row.stripeCustomerId,
      value: row.overage,
      timestamp,
    });

    if (result.success) {
      reported++;
    } else {
      skipped++;
    }
  }

  return { reported, skipped };
}
