---
alwaysApply: true
---

# Custom Integrations Documentation

## Overview

RevealUI Framework integrates with several third-party services to provide complete CMS, payment, and storage functionality.

---

## Stripe Payment Integration

### Architecture

```
Frontend → CMS API → Stripe API
    ↓
Stripe Webhooks → CMS Webhook Handler → Database
```

### Components

**Located in:** `packages/services/src/`

1. **Stripe Client** (`stripe/stripeClient.ts`)
   - Configured Stripe SDK instance
   - Uses `STRIPE_SECRET_KEY` from environment

2. **Webhook Handler** (`api/webhooks/index.ts`)
   - Receives Stripe webhook events
   - Verifies webhook signatures
   - Processes relevant events

3. **Payment Utilities** (`api/utils.ts`)
   - `createPaymentIntent` - Creates Stripe payment intents
   - `createCheckoutSession` - Creates checkout sessions
   - `manageSubscriptionStatusChange` - Updates subscription status
   - `upsertProductRecord` - Syncs products from Stripe
   - `upsertPriceRecord` - Syncs prices from Stripe

### Supported Events

```typescript
const relevantEvents = new Set([
  "product.created",
  "product.updated",
  "price.created",
  "price.updated",
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
])
```

### Configuration

**Environment Variables:**
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_IS_TEST_KEY=true
```

**RevealUI CMS Collections:**
- `Products` - Synced with Stripe products
- `Prices` - Synced with Stripe prices
- `Orders` - Customer orders
- `Subscriptions` - Customer subscriptions

### Usage Example

```typescript
// Create checkout session
const response = await fetch('/api/create-checkout-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    price: { id: 'price_xxx' },
    quantity: 1,
    metadata: { customField: 'value' }
  })
})

const { sessionId } = await response.json()

// Redirect to Stripe Checkout
const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY)
await stripe.redirectToCheckout({ sessionId })
```

### Security Considerations

- ✅ Webhook signatures verified
- ✅ Prices fetched from Stripe API (not client-provided)
- ✅ Customer IDs validated
- ⚠️ Ensure webhook secret properly configured

---

## Supabase Database Integration

### Architecture

```
RevealUI CMS → Drizzle ORM → Postgres Adapter → Supabase Postgres
```

### Configuration

**Located in:** `payload.config.ts`

```typescript
import { postgresAdapter } from "@revealui/cms/database"

export default buildConfig({
  db: postgresAdapter({
    connectionString: process.env.SUPABASE_DATABASE_URI || "",
  }),
})
```

### Environment Variables

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
SUPABASE_DATABASE_URI=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres
```

### Database Schema

RevealUI CMS automatically creates and manages database schema:
- Tables for each collection
- Indexes on queried fields
- Relationship foreign keys
- Version history tables (for drafts)

### Client Usage

**Server-side Supabase Client:**
```typescript
// packages/services/src/supabase/utils/server.ts
import { createServerClient } from '@supabase/ssr'

const supabase = createServerClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { cookies: /* cookie handling */ }
)
```

---

## Cloud Storage Integration

### Current Setup

**Cloudinary** for media storage:
- Configured in CSP (`apps/cms/csp.js`)
- Image domains in `next.config.mjs`

### RevealUI CMS Media Collection

**Located in:** `apps/cms/src/lib/collections/Media/index.ts`

```typescript
export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    // Upload configuration
    staticURL: '/media',
    mimeTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
  },
  fields: [
    // Media fields
  ],
}
```

### Vercel Blob Storage (Alternative)

To switch to Vercel Blob Storage:

1. Configure in `revealui.config.ts`:
   ```typescript
   import { vercelBlobStorage } from '@revealui/cms/storage'
   
   plugins: [
     vercelBlobStorage({
       collections: {
         media: true,
       },
       token: process.env.BLOB_READ_WRITE_TOKEN || '',
     }),
   ]
   ```

3. Add environment variable:
   ```env
   BLOB_READ_WRITE_TOKEN=vercel_blob_xxx
   ```

---

## Email Integration (SMTP)

### Configuration

**Environment Variables:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### RevealUI CMS Email Setup

```typescript
// payload.config.ts
export default buildConfig({
  email: {
    transportOptions: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
    fromName: 'RevealUI CMS',
    fromAddress: process.env.SMTP_USER,
  },
})
```

### Email Templates

Use in collections for:
- User verification
- Password reset
- Order confirmations
- Subscription notifications

---

## YouTube API Integration

### Purpose

Fetch YouTube video data for content.

### Configuration

```env
YOUTUBE_API_KEY=AIzaSyXxx...
YOUTUBE_BASE_URL=https://www.googleapis.com/youtube/v3
```

### Usage

```typescript
const response = await fetch(
  `${process.env.YOUTUBE_BASE_URL}/videos?id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`
)
const data = await response.json()
```

---

## Reveal UI Framework Integration

### Package Location

`packages/reveal/` - Custom UI framework

### Usage in CMS

```typescript
// apps/cms/payload.config.ts
import { ChatGPTAssistant } from "reveal"

export default buildConfig({
  // ... config with Reveal components
})
```

### Features

- Custom UI components
- Admin panel customizations
- Blocks and fields
- Presentation framework integration

---

## RevealUI CMS Plugins

### 1. Form Builder Plugin

**Located in:** `payload.config.ts`

```typescript
formBuilderPlugin({
  fields: {
    payment: false,  // Disable payment field
  },
  formOverrides: {
    // Custom field overrides
  },
})
```

**Features:**
- Create custom forms in admin
- Form submissions collection
- Email notifications
- Custom confirmation messages

### 2. Nested Docs Plugin

```typescript
nestedDocsPlugin({
  collections: ["categories"],
})
```

**Features:**
- Hierarchical categories
- Breadcrumb generation
- Parent-child relationships

### 3. Redirects Plugin

```typescript
redirectsPlugin({
  collections: ["pages", "posts"],
  overrides: {
    hooks: {
      afterChange: [revalidateRedirects],
    },
  },
})
```

**Features:**
- 301/302 redirects
- Old URL → New URL mapping
- SEO-friendly redirects

---

## Localization

### Supported Locales

```typescript
localization: {
  locales: ["en", "es", "de"],
  defaultLocale: "en",
  fallback: true,
}
```

### Usage

All collections and globals support localization:
- Content translated per locale
- Locale-specific URLs
- Fallback to default locale

---

## Custom Hooks

### RevealUI CMS Hooks

**Located in:** `apps/cms/src/lib/hooks/`

1. **loginAfterCreate** - Auto-login after user creation
2. **recordLastLoggedInTenant** - Track tenant context
3. **revalidatePage** - Clear Next.js cache on page update
4. **revalidateRedirects** - Update redirects after change
5. **populatePublishedAt** - Set publish timestamp

### Usage

```typescript
// In collection config
hooks: {
  afterChange: [revalidatePage],
  beforeChange: [populatePublishedAt],
  afterLogin: [recordLastLoggedInTenant],
}
```

---

## Content Security Policy (CSP)

### Configuration

**Located in:** `apps/cms/csp.js`

**Allowed Sources:**
- Scripts: Stripe, Google Maps, Cloudinary
- Styles: Google Fonts
- Images: Cloudinary, Stripe, Gravatar
- Frames: Stripe Checkout
- Connections: Stripe API, local development

### Modifying CSP

Add new domains to appropriate directives:

```javascript
const policies = {
  "script-src": [
    "'self'",
    "'unsafe-inline'",  // Required for RevealUI CMS admin
    "https://new-domain.com",  // Add new domain
  ],
  // ... other directives
}
```

**Note**: `'unsafe-inline'` and `'unsafe-eval'` are required for RevealUI CMS admin panel.

---

## Vercel Deployment Integration

### Configuration

**Located in:** `vercel.json`

```json
{
  "builds": [
    { "src": "apps/web/package.json", "use": "@vercel/static-build" },
    { "src": "apps/cms/package.json", "use": "@vercel/next" }
  ],
  "rewrites": [
    { "source": "/admin/:path*", "destination": "/apps/cms/admin/:path*" },
    { "source": "/api/:path*", "destination": "/apps/cms/api/:path*" }
  ]
}
```

### Environment Variables

Set in Vercel dashboard:
- Production environment
- Preview environment (for cursor branch)
- Development environment

### Deployment Triggers

- Push to `main` → Production
- Push to `cursor` → Staging Preview
- Pull requests → PR Preview

---

## Monitoring & Logging

### Sentry Error Tracking

**Configuration:** `apps/cms/src/lib/config/sentry.ts`

**Setup Steps:**
1. Create Sentry project
2. Get DSN
3. Add to environment:
   ```env
   NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
   ```

4. Install SDK:
   ```bash
   pnpm add @sentry/nextjs --filter cms
   ```

### Health Checks

**Endpoint:** `/api/health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-16T...",
  "service": "RevealUI CMS",
  "checks": {
    "database": "connected",
    "payload": "operational"
  },
  "metrics": {
    "responseTimeMs": 45
  }
}
```

---

## API Documentation

### Auto-Generated REST API

RevealUI CMS automatically generates REST API for all collections:

```
GET    /api/:collection              # List
GET    /api/:collection/:id          # Read
POST   /api/:collection              # Create
PATCH  /api/:collection/:id          # Update
DELETE /api/:collection/:id          # Delete
```

### Authentication

```bash
# Login
POST /api/users/login
Body: { "email": "user@example.com", "password": "xxx" }
Response: { "token": "JWT...", "user": {...} }

# Use token in requests
GET /api/pages
Headers: { "Authorization": "JWT <token>" }
```

---

## Integration Testing

### Test Stripe Integration

```bash
# Use Stripe CLI to trigger test events
stripe trigger payment_intent.succeeded

# Or send test webhook
curl -X POST http://localhost:4000/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: xxx" \
  -d @test-fixtures/payment-success.json
```

### Test Database Connection

```bash
# Via RevealUI CMS
curl http://localhost:4000/api/users
```

### Test Email Sending

```typescript
// In RevealUI CMS hook or endpoint
await payload.sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  html: '<p>Testing email integration</p>',
})
```

---

## Troubleshooting Integrations

### Stripe Issues

**Problem**: Webhooks not received
- **Check**: Stripe CLI is running
- **Check**: Webhook endpoint accessible
- **Solution**: Verify `STRIPE_WEBHOOK_SECRET` matches

**Problem**: Payment fails
- **Check**: Using test mode keys
- **Check**: Test card numbers
- **Solution**: Review Stripe dashboard logs

### Database Issues

**Problem**: Connection timeout
- **Check**: Supabase project active
- **Check**: Connection string format
- **Solution**: Verify network access to Supabase

**Problem**: Migration fails
- **Check**: Database permissions
- **Check**: Schema conflicts
- **Solution**: Review RevealUI CMS migration logs

### Email Issues

**Problem**: Emails not sending
- **Check**: SMTP credentials
- **Check**: Port and host correct
- **Solution**: Use app-specific password for Gmail

---

## Adding New Integrations

### Steps to Add Integration

1. **Install SDK**
   ```bash
   pnpm add new-service-sdk --filter cms
   ```

2. **Add Environment Variables**
   ```env
   # .env.template
   NEW_SERVICE_API_KEY=your-api-key
   ```

3. **Create Service Client**
   ```typescript
   // apps/cms/src/lib/integrations/new-service.ts
   import NewServiceSDK from 'new-service-sdk'
   
   export const newServiceClient = new NewServiceSDK({
     apiKey: process.env.NEW_SERVICE_API_KEY,
   })
   ```

4. **Add to CSP** (if needed)
   ```javascript
   // apps/cms/csp.js
   "connect-src": [
     // ... existing
     "https://api.newservice.com",
   ],
   ```

5. **Create Tests**
   ```typescript
   // apps/cms/src/__tests__/integrations/new-service.test.ts
   import { describe, it, expect } from 'vitest'
   
   describe('New Service Integration', () => {
     it('should connect successfully', async () => {
       // Test implementation
     })
   })
   ```

6. **Document Integration**
   - Update this file
   - Add usage examples
   - Document environment variables

---

## Integration Checklist

Before deploying new integration:

- [ ] Environment variables documented in `.env.template`
- [ ] API keys secured (not hardcoded)
- [ ] Error handling implemented
- [ ] Rate limiting considered
- [ ] Tests written and passing
- [ ] CSP updated if needed
- [ ] Documentation complete
- [ ] Tested in staging environment

---

## Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Supabase Documentation](https://supabase.com/docs)
- [RevealUI CMS Hooks](https://revealui.com/docs/hooks)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

**Last Updated**: January 16, 2025  
**Maintainer**: Development Team

