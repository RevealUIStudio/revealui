---
title: "@revealui/services"
description: "External service integrations for RevealUI - Stripe (billing + circuit breaker) and Gmail API (transactional email)."
visibility: public
status: verified
audience: user
---

# @revealui/services

> **Commercial package**  -  requires a [RevealUI Pro license](https://revealui.com/pro). Free to install and evaluate; a license key is required for production use.


External service integrations for RevealUI  -  Stripe (billing + circuit breaker) and Gmail API (transactional email).

## Features

- **Stripe Integration**: Payment processing and billing operations with circuit breaker
- **Email**: Transactional email helpers
- **Type-safe**: Full TypeScript support
- **Server & Client**: Separate exports for server-side and client-side usage

## Installation

This package is private and only used within the RevealUI monorepo via `workspace:*` references.

## Usage

### Server-side

```typescript
import { protectedStripe } from '@revealui/services/server'

// Use Stripe (circuit breaker + retry protected)
const customer = await protectedStripe.customers.create({
  email: 'customer@example.com',
  name: 'Customer Name'
})
```

## Available Exports

Server-side integrations (Node.js / Hono routes):

- Root (`@revealui/services`), re-exports Stripe + email
- Server alias (`./server`), same as root
- Email helpers (`./email`)
- Stripe mode coherence check (`./stripe/mode`)
- Stripe payment intents (`./stripe/payment-intent`)
- Stripe client module (`./stripe/stripeClient`), exports `getStripe`/`protectedStripe`, not a symbol named `stripeClient`

## Stripe Integration

```typescript
import { protectedStripe, getStripe } from '@revealui/services/server'

// Create customer (circuit breaker + retry protected)
const customer = await protectedStripe.customers.create({
  email: 'user@example.com'
})

// Create payment intent
const paymentIntent = await protectedStripe.paymentIntents.create({
  amount: 2000,
  currency: 'usd',
  customer: customer.id
})

// Create subscription
const subscription = await protectedStripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: 'price_xxxxx' }]
})

// Raw Stripe SDK instance (no resilience wrapping)
const stripe = getStripe()
```


## Environment Variables

Required environment variables:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
```

## Development

```bash
# Build package
pnpm --filter @revealui/services build

# Run tests
pnpm --filter @revealui/services test

# Watch mode
pnpm --filter @revealui/services dev

# Type check
pnpm --filter @revealui/services typecheck
```

## Testing

```bash
# Run all tests
pnpm --filter @revealui/services test

# Run tests in watch mode
pnpm --filter @revealui/services test:watch

# Run with coverage
pnpm --filter @revealui/services test:coverage
```

## Related Documentation

- [Environment Variables Guide](../../docs/ENVIRONMENT_VARIABLES_GUIDE.md) - Service API keys setup
- [Architecture](../../docs/ARCHITECTURE.md) - Service integration patterns

## License

FSL-1.1-MIT (Fair Source, converts to MIT after 2 years). See [LICENSE](../../LICENSE).
