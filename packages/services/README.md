# @revealui/services

> **Commercial package** — requires a [RevealUI Pro license](https://revealui.com/pro). Free to install and evaluate; a license key is required for production use.


External service integrations for RevealUI — Stripe, Supabase, and Vercel.

## Features

- **Stripe Integration**: Payment processing and billing operations
- **Supabase Integration**: Database and auth client utilities
- **Vercel Integration**: Blob storage and deployment management
- **Type-safe**: Full TypeScript support
- **Server & Client**: Separate exports for server-side and client-side usage

## Installation

This package is private and only used within the RevealUI monorepo via `workspace:*` references.

## Usage

### Server-side

```typescript
import { stripeClient } from '@revealui/services/server'

// Use Stripe
const customer = await stripeClient.customers.create({
  email: 'customer@example.com',
  name: 'Customer Name'
})
```

### Client-side

```typescript
import { createSupabaseClient } from '@revealui/services/client'

const supabase = createSupabaseClient()

// Query data
const { data, error } = await supabase
  .from('posts')
  .select('*')
  .eq('published', true)
```

## Available Exports

### `@revealui/services/server`

Server-side integrations (Node.js/Next.js API routes only):

- Stripe client
- Supabase admin client
- Vercel API client

### `@revealui/services/client`

Client-side integrations (browser-safe):

- Supabase client factory
- Browser-compatible utilities

## Stripe Integration

```typescript
import { stripeClient } from '@revealui/services/server'

// Create customer
const customer = await stripeClient.customers.create({
  email: 'user@example.com'
})

// Create payment intent
const paymentIntent = await stripeClient.paymentIntents.create({
  amount: 2000,
  currency: 'usd',
  customer: customer.id
})

// Create subscription
const subscription = await stripeClient.subscriptions.create({
  customer: customer.id,
  items: [{ price: 'price_xxxxx' }]
})
```

## Supabase Integration

```typescript
import { createSupabaseClient } from '@revealui/services/client'

const supabase = createSupabaseClient()

// Query data
const { data: posts } = await supabase
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })

// Insert data
const { data: newPost } = await supabase
  .from('posts')
  .insert({ title: 'New Post', content: 'Content here' })
  .select()
  .single()

// Real-time subscription
const channel = supabase
  .channel('posts-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'posts'
  }, (payload) => {
    console.log('Change detected:', payload)
  })
  .subscribe()
```

## Environment Variables

Required environment variables:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Supabase
SUPABASE_URL=https://....supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Vercel
VERCEL_API_KEY=vercel_...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
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

Commercial — see [LICENSE.commercial](../../LICENSE.commercial)
