/**
 * Synthetic `unreconciled_webhooks.event_id` prefixes.
 *
 * Several crons record ops-visible alerts by writing a row into
 * `unreconciled_webhooks` with a MADE-UP `event_id` (so re-runs collide and the
 * alert is idempotent). Those ids are not Stripe events and can never be
 * replayed.
 *
 * This matters because `drain-unreconciled` selects EVERY unresolved row and
 * hands `event_id` to `stripe.events.retrieve()`. Stripe 404s on a synthetic id,
 * the drainer classifies it `event-missing`, and **marks the row resolved**.
 *
 * The consequence, found in review of GAP-356 PR-2: the drainer runs every 15
 * minutes (the GAP-142 external scheduler) while the reconcilers run once a day
 * (Vercel Hobby allows one cron). So a synthetic alert is auto-closed long
 * before the cron that raised it looks again, and because the raising crons
 * check "does a row with this event_id exist" WITHOUT filtering on
 * `resolved_at`, they then never raise it again. The alert channel silently
 * closes itself after the first firing.
 *
 * Fix: the drainer skips synthetic ids entirely (they stay unresolved until a
 * human or the raising cron resolves them), and the raising crons scope their
 * existence check to unresolved rows.
 */

/** Every synthetic `event_id` prefix in use. Add new ones here, not inline. */
export const SYNTHETIC_EVENT_ID_PREFIXES = [
  /** reconcile-entitlements — entitlement drift (GAP-356 F4) */
  'cron-entitlement-drift:',
  /** reconcile-stripe-subscriptions — a live Stripe sub with no local row */
  'cron-sub-orphan:',
  /** reconcile-customers — a Stripe customer with no local user */
  'cron-orphan:',
  /** webhooks.ts — entitlement tier unresolvable (GAP-356 F3) */
  'entitlement-unresolved-tier:',
] as const;

/**
 * True when `eventId` is a cron-authored alert marker rather than a real Stripe
 * event id. Substring check only — no regex (fleet no-regex posture).
 */
export function isSyntheticEventId(eventId: string): boolean {
  for (const prefix of SYNTHETIC_EVENT_ID_PREFIXES) {
    if (eventId.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}
