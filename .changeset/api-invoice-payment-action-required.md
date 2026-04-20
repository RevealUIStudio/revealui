---
'api': patch
'@revealui/contracts': patch
---

Add `invoice.payment_action_required` handling for 3DS / SCA authentication flows.

When a customer's bank returns an authentication challenge (3D Secure / Strong Customer Authentication), Stripe sends `invoice.payment_action_required` separately from a payment failure. The customer has **not** failed — they just need to complete authentication on the hosted invoice URL. Prior to this change, the event was acked but skipped, so customers in SCA flows received no notification and could drift toward an actual `invoice.payment_failed` when Stripe's retry schedule eventually gave up.

Adds:

- `invoice.payment_action_required` to the canonical `RELEVANT_STRIPE_WEBHOOK_EVENTS` in `@revealui/contracts` (count 12 → 13). `seed-stripe.ts` will register the event on the next run.
- `sendPaymentActionRequiredEmail()` in `apps/api/src/lib/webhook-emails.ts` — notifies the customer, explains their access is not interrupted, directs them to the billing portal to complete authentication.
- Handler branch in `webhooks.ts` that logs the event, resolves tier + email, sends the notification email, and audit-logs `payment.action_required` at info severity. **Does not modify entitlement state** — a customer in an SCA flow has not failed and should not be downgraded.

Does **not** change the existing `invoice.payment_failed` handler (which already implements grace-period logic per the prior attempt-count-based suspension flow).

Closes the `invoice.payment_action_required` gap from the CR-8 billing audit; issue #393 receives a status comment with the reality-vs-issue-body delta (most of #393's acceptance criteria are already handled by the existing `invoice.payment_failed` branch; remaining items — 7-day-vs-period-end grace duration, reminder-email cadence, nightly downgrade cron — are product-behavior decisions, not bug fixes).
