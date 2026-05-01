import type { Command } from '../../schemas/command.js';

export const stripeBestPracticesCommand: Command = {
  id: 'stripe-best-practices',
  tier: 'pro',
  name: 'Stripe Best Practices',
  description:
    'Apply when working on Stripe billing, payments, webhooks, subscriptions, or checkout flows (apps/server/src/routes/billing.ts, packages/services).',
  disableModelInvocation: false,
  content: `Apply Stripe best practices when implementing or reviewing payment code in this project:

## Webhook Handling
- Always verify webhook signatures using \`stripe.webhooks.constructEvent()\` with the raw request body (never parsed JSON)
- Use idempotency keys for all mutating API calls (charges, subscriptions, refunds)
- Return 200 immediately after signature verification; process asynchronously if needed
- Handle all relevant events: \`checkout.session.completed\`, \`customer.subscription.deleted\`, \`customer.subscription.updated\`, \`invoice.payment_failed\`

## Subscription Management
- Store \`customer.id\`, \`subscription.id\`, and \`subscription.status\` in your DB  -  not just price/product IDs
- Use \`subscription.status\` to gate access: only \`active\` and \`trialing\` grant access
- Handle \`past_due\` gracefully  -  show dunning UI, don't immediately revoke access
- Use \`cancel_at_period_end: true\` for user-initiated cancellations (preserves access until period end)

## Checkout & Billing Portal
- Use \`metadata\` on checkout sessions to pass internal IDs (userId, planId) through to webhooks
- Always set \`client_reference_id\` to your internal user ID
- Use Stripe Billing Portal for plan changes and cancellations  -  don't build your own

## Security
- Never log full Stripe objects  -  they may contain PII
- Never expose secret keys client-side; all Stripe API calls must be server-side
- Use restricted API keys scoped to minimum permissions for each service
- Validate that webhook events reference resources owned by your users before acting

## Error Handling
- Retry on \`rate_limit_error\` and network errors with exponential backoff
- On \`card_error\` and \`invalid_request_error\`, surface Stripe's \`message\` to the user (it's user-safe)
- Log \`stripe_error\` codes for debugging; never expose raw error objects to clients

## RevealUI-Specific
- Webhook endpoint: \`apps/admin\` at \`/api/webhooks/stripe\` (NOT the API endpoint)
- Stripe service: \`packages/services/src/stripe/\`
- Billing routes: \`apps/server/src/routes/billing.ts\`
- Price IDs are managed via \`pnpm stripe:seed\`  -  see \`scripts/setup/seed-stripe.ts\``,
};
