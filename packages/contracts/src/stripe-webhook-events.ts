/**
 * Canonical list of Stripe webhook events the RevealUI platform handles.
 *
 * This list is the single source of truth for BOTH sides of the webhook
 * contract:
 *   1. `apps/server/src/routes/webhooks.ts` — handler's `relevantEvents` Set,
 *      which determines which events the handler processes (anything not
 *      listed is acked but skipped).
 *   2. `scripts/setup/seed-stripe.ts` — the webhook endpoint provisioning
 *      script, which configures Stripe's dashboard to send these events.
 *
 * If these two sides drift, the handler either (a) receives events it
 * doesn't handle (wasted webhook deliveries + alert noise) or (b) fails to
 * receive events it needs (silent billing gaps — e.g. missed dispute or
 * refund notifications). Both have real operational cost.
 *
 * **To add a new event:**
 *   1. Add the event name to this array (keep alphabetical within groups
 *      for diff-friendliness).
 *   2. Implement the handler branch in `apps/server/src/routes/webhooks.ts`.
 *   3. Re-run `pnpm stripe:seed` against the live Stripe account to
 *      register the new event on the existing webhook endpoint.
 *
 * **To remove an event:**
 *   1. Remove the handler branch.
 *   2. Remove from this array.
 *   3. Re-run `pnpm stripe:seed` (the seed script should detect removed
 *      events and unsubscribe them — tracked separately; as of 2026-04-19
 *      the script does not prune removed events).
 *
 * Tracked by: MASTER_PLAN §CR-8 audit finding revealui#406 (2026-04-18).
 */
export const RELEVANT_STRIPE_WEBHOOK_EVENTS = [
  // Checkout completion
  'checkout.session.completed',

  // Customer lifecycle
  'customer.deleted',

  // Subscription lifecycle
  'customer.subscription.created',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'customer.subscription.updated',

  // Invoice / payment lifecycle
  'invoice.payment_action_required',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
  'payment_intent.payment_failed',
  'payment_intent.requires_action',

  // Dispute + refund (customer-initiated reversals)
  'charge.dispute.closed',
  'charge.dispute.created',
  'charge.refunded',
] as const;

/**
 * Type-safe union of the canonical webhook events.
 * Narrower than Stripe's global `Event.Type` — only the events RevealUI
 * actually handles.
 */
export type RelevantStripeWebhookEvent = (typeof RELEVANT_STRIPE_WEBHOOK_EVENTS)[number];

/**
 * Expected event count — acts as a coarse drift detector for reviewers.
 * If you're adjusting the array above, update this too.
 */
export const RELEVANT_STRIPE_WEBHOOK_EVENT_COUNT = 14;
