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
RevealUI CMS → Drizzle ORM (Neon HTTP) → Supabase Postgres (Transaction Pooling)
```

### Configuration

**Located in:** `revealui.config.ts`

```typescript
import { universalPostgresAdapter } from "@revealui/core/database"

export default buildConfig({
  db: universalPostgresAdapter({
    connectionString: process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI || "",
  }),
})
```

### Connection String: Transaction Pooling (Recommended)

For Next.js serverless environments, use **Transaction Pooling** (port 6543):

**Why Transaction Pooling?**
- ✅ Ideal for serverless/edge functions (many transient connections)
- ✅ Works automatically with `@neondatabase/serverless` (no prepared statements needed)
- ✅ Prevents connection exhaustion in high-concurrency scenarios
- ✅ Supports both IPv4 and IPv6

### Environment Variables

```env
# Supabase Client (for auth, real-time, storage)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Database Connection - Transaction Pooling (port 6543)
POSTGRES_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:6543/postgres?sslmode=require

# Alternative (using pooler endpoint)
# POSTGRES_URL=postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require

# Legacy fallback
SUPABASE_DATABASE_URI=postgresql://postgres:xxx@db.xxx.supabase.co:6543/postgres
```

**Important Notes:**
- Use port **6543** for transaction pooling (not 5432)
- Get the connection string from Supabase Dashboard → Settings → Database → Connection Pooling → Transaction mode
- The Neon HTTP driver automatically works with transaction pooling (no `prepare: false` needed)

**Reference:** [Supabase Drizzle Connection Guide](https://supabase.com/docs/guides/database/connecting-to-postgres#connecting-with-drizzle)

### Migrating from Vercel Postgres

If you're migrating from the deprecated `@vercel/postgres` adapter, see the [Migration Guide: @vercel/postgres to Direct Supabase Connections](MIGRATE-VERCEL-POSTGRES-TO-SUPABASE.md) for step-by-step instructions.

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
   import { vercelBlobStorage } from '@revealui/core/storage'
   
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
// revealui.config.ts
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

`packages/core/` - Custom UI framework

### Usage in CMS

```typescript
// apps/cms/revealui.config.ts
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

**Located in:** `revealui.config.ts`

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
    "revealui": "operational"
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
await revealui.sendEmail({
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

# ElectricSQL Integration Guide

This document describes how to integrate ElectricSQL into RevealUI for cross-tab/session agent memory sharing.

## Overview

ElectricSQL enables local-first real-time sync for agent context, memories, and conversations. It works alongside Drizzle ORM, providing:

- Cross-tab synchronization
- Cross-session persistence
- Offline-first operation
- Real-time updates
- Type-safe API

## Architecture

```mermaid
graph TB
    subgraph Client[Client Apps]
        CMS[CMS App]
        WEB[Web App]
    end
    
    subgraph ElectricSQL[ElectricSQL Client]
        LocalCache[(Browser Cache<br/>HTTP Sync)]
        SyncEngine[Sync Engine]
    end
    
    subgraph Server[Server Infrastructure]
        ElectricService[ElectricSQL Service]
        PostgresDB[(PostgreSQL<br/>NeonDB)]
    end
    
    CMS --> LocalDB
    WEB --> LocalDB
    LocalDB --> SyncEngine
    SyncEngine <--> ElectricService
    ElectricService <--> PostgresDB
```

## Setup Steps

### 1. Install Dependencies

The `@revealui/sync` package is already set up. Install dependencies:

```bash
pnpm install
```

### 2. Set Up ElectricSQL Service

Deploy and configure ElectricSQL service (self-hosted):

1. Install ElectricSQL service
2. Connect to your PostgreSQL database
3. Configure sync rules for agent tables
4. Start the service

See [ElectricSQL documentation](https://electric-sql.com/docs) for details.

### 3. Configure Environment Variables

Add to `.env`:

```env
# ElectricSQL Service URL (server-side)
ELECTRIC_SERVICE_URL=http://localhost:5133

# ElectricSQL Service URL (client-side)
NEXT_PUBLIC_ELECTRIC_SERVICE_URL=http://localhost:5133

# Optional: Authentication token
ELECTRIC_AUTH_TOKEN=your_token_here
```

### 4. Generate ElectricSQL Schema

After ElectricSQL service is set up and running, generate client types:

```bash
# Generate ElectricSQL client from PostgreSQL schema
# Note: electric:generate script not yet implemented
# Use manual command: pnpm dlx electric-sql generate
# Or manually:
pnpm dlx electric-sql generate
```

This will generate TypeScript types that match your PostgreSQL schema and create the `.electric/` directory.

**Note**: The service must be running and connected to your database before generating the schema.

### 5. Client Code Status

The client code is already implemented and ready to use:

- ✅ `packages/sync/src/client/index.ts` - Client initialization with `createElectricClient()`
- ✅ `packages/sync/src/provider/ElectricProvider.tsx` - React provider component
- ✅ `packages/sync/src/hooks/*.ts` - All hooks use `useLiveQuery` for real-time sync
- ✅ `packages/sync/src/schema.ts` - Automatically uses generated types when available

The implementation automatically detects and uses generated types when available, with graceful fallbacks.

### 6. Integrate Provider

#### CMS App

Add `ElectricProvider` to `apps/cms/src/lib/providers/index.tsx`:

```tsx
import { ElectricProvider } from '@revealui/sync/provider'

export function Providers({ children }) {
  return (
    <ElectricProvider serviceUrl={process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL}>
      {children}
    </ElectricProvider>
  )
}
```

#### Web App

Add `ElectricProvider` to app entry point (e.g., `apps/web/src/main.tsx`):

```tsx
import { ElectricProvider } from '@revealui/sync/provider'

function App() {
  return (
    <ElectricProvider serviceUrl={import.meta.env.VITE_ELECTRIC_SERVICE_URL}>
      <YourApp />
    </ElectricProvider>
  )
}
```

## Usage

### Basic Hook Usage

```tsx
import { useAgentContext } from '@revealui/sync/hooks'

function AgentPanel({ agentId, sessionId }) {
  const { context, updateContext, isLoading } = useAgentContext(agentId, {
    sessionId
  })

  const handleUpdate = async () => {
    await updateContext({
      context: {
        tokensUsed: 150,
        lastUsed: new Date()
      }
    })
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <pre>{JSON.stringify(context, null, 2)}</pre>
      <button onClick={handleUpdate}>Update</button>
    </div>
  )
}
```

### Memory Management

```tsx
import { useAgentMemory } from '@revealui/sync/hooks'

function MemoryList({ agentId, siteId }) {
  const { memories, addMemory, isLoading } = useAgentMemory(agentId, {
    siteId,
    type: 'fact',
    limit: 100
  })

  const handleAdd = async () => {
    await addMemory({
      content: 'User prefers dark mode',
      type: 'preference',
      source: { type: 'user', id: 'user-123' },
      metadata: { importance: 0.8 }
    })
  }

  return (
    <div>
      <button onClick={handleAdd}>Add Memory</button>
      <ul>
        {memories.map(memory => (
          <li key={memory.id}>{memory.content}</li>
        ))}
      </ul>
    </div>
  )
}
```

## Sync Configuration

### Security Filters

Sync shapes filter data by user/agent for security:

```tsx
import { createAgentContextsShape } from '@revealui/sync/sync'

// Only sync contexts for specific agent and session
const shape = createAgentContextsShape('agent-123', 'session-456')
```

### PostgreSQL Sync Rules

Configure sync rules in ElectricSQL service to match these filters:

```sql
-- Example: Sync rule for agent_contexts
CREATE POLICY sync_agent_contexts ON agent_contexts
  FOR SELECT
  USING (agent_id = current_setting('app.agent_id')::text);
```

## Troubleshooting

### Connection Issues

- Verify ElectricSQL service is running: `curl http://localhost:5133/health`
- Check `ELECTRIC_SERVICE_URL` or `NEXT_PUBLIC_ELECTRIC_SERVICE_URL` is correct
- Check network connectivity
- Review service logs: `# Note: ElectricSQL service scripts not yet implemented`

### Sync Not Working

- Ensure tables are electrified: Run `ALTER TABLE <table> ENABLE ELECTRIC;` in PostgreSQL
- Verify sync shapes are configured correctly in client code
- Check that ElectricSQL service can connect to PostgreSQL
- Review ElectricSQL service logs for sync errors
- Verify RLS policies match sync filters (if using RLS)

### Type Errors

- Ensure ElectricSQL schema is generated: `# Note: electric:generate script not yet implemented
# Use manual command: pnpm dlx electric-sql generate`
- Run `pnpm build` in `packages/sync` after generating types
- Check that `.electric/@config.ts` exists (generated file)
- Verify generated types match PostgreSQL schema

### Client Not Initializing

- Check that `ElectricProvider` is wrapping your app
- Verify service URL is provided via props or environment variable
- Check browser console for initialization errors
- Ensure `createElectricClient()` is not throwing errors

## Related Documentation

- [ElectricSQL Documentation](https://electric-sql.com/docs)
- [@revealui/sync README](../../packages/sync/README.md)
- [Agent Schema](../../packages/schema/src/agents/index.ts)
- [Database Schema](../../packages/db/src/core/agents.ts)

## Testing & Validation

- **[ElectricSQL Testing Results](../assessments/TESTING_RESULTS.md)** - Detailed testing results and critical findings
- **[ElectricSQL Testing Summary](../assessments/TESTING_SUMMARY.md)** - Quick summary of testing status and blockers

## Related Documentation

- [ElectricSQL Setup Guide](./electric-setup-guide.md) - Setup instructions
- [ElectricSQL Migrations](../reference/database/electric.migrations.sql) - SQL migrations
- [Drizzle Guide](./DRIZZLE_GUIDE.md) - Drizzle ORM usage
- [Fresh Database Setup](../reference/database/FRESH_DATABASE_SETUP.md) - Database setup
- [Unified Backend Architecture](../architecture/UNIFIED_BACKEND_ARCHITECTURE.md) - System architecture
- [Dual Database Architecture](../architecture/DUAL_DATABASE_ARCHITECTURE.md) - Database architecture
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task

### External Resources

- [ElectricSQL Documentation](https://electric-sql.com/docs) - Official ElectricSQL docs
# ElectricSQL Setup Guide for RevealUI

Complete step-by-step guide to set up ElectricSQL for agent memory sharing.

## Prerequisites

- PostgreSQL database (NeonDB) with agent tables
- Node.js 18+ or 20+
- pnpm installed
- ElectricSQL CLI access

## Step 1: Install ElectricSQL Service

### Option A: Self-Hosted (Recommended)

1. **Install ElectricSQL CLI:**
   ```bash
   npm install -g @electric-sql/cli
   ```

2. **Initialize ElectricSQL in your project:**
   ```bash
   cd /home/joshua-v-dev/projects/RevealUI
   npx @electric-sql/cli init
   ```

3. **Configure ElectricSQL:**
   Create `electric.config.ts` in project root:
   ```typescript
   export default {
     service: {
       host: 'localhost',
       port: 5133,
     },
     proxy: {
       port: 65432,
     },
     database: {
       host: process.env.DATABASE_URL,
     },
   }
   ```

### Option B: Docker (Alternative)

```bash
docker run -d \
  --name electric-sql \
  -p 5133:5133 \
  -e DATABASE_URL=$DATABASE_URL \
  electricsql/electric:latest
```

## Step 2: Configure PostgreSQL for ElectricSQL

ElectricSQL requires specific PostgreSQL setup:

1. **Enable required extensions:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pg_trgm";
   ```

2. **Add ElectricSQL metadata tables:**
   ElectricSQL will create these automatically, but ensure your database user has permissions.

3. **Verify agent tables exist:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('agent_contexts', 'agent_memories', 'conversations');
   ```

## Step 3: Generate ElectricSQL Client

1. **Start the ElectricSQL service first** (see Step 6 below), then run schema generation:
   ```bash
   # Note: electric:generate script not yet implemented
# Use manual command: pnpm dlx electric-sql generate
   # Or manually:
   pnpm dlx electric-sql generate
   ```

   This will:
   - Connect to your PostgreSQL database via ElectricSQL service
   - Read your PostgreSQL schema
   - Generate TypeScript types
   - Create `.electric/` directory with config
   - Generate client code

2. **Verify generated files:**
   ```
   .electric/
   ├── @config.ts          # ElectricSQL configuration (generated)
   ├── client/              # Generated client code
   └── migrations/          # Schema migrations
   ```

   **Note**: The `.electric/` directory is git-ignored. Generated files should not be committed.

## Step 4: Package Implementation

The package implementation is already complete! The following files are ready:

- ✅ `packages/sync/src/client/index.ts` - Client initialization with `createElectricClient()`
- ✅ `packages/sync/src/provider/ElectricProvider.tsx` - React provider component
- ✅ `packages/sync/src/hooks/useAgentContext.ts` - Live query hook for contexts
- ✅ `packages/sync/src/hooks/useAgentMemory.ts` - Live query hook for memories
- ✅ `packages/sync/src/hooks/useConversations.ts` - Live query hook for conversations

The implementation automatically uses generated types when available, and falls back to manual types if not yet generated.

## Step 5: Configure Environment Variables

Add to `.env`:

```env
# ElectricSQL Service
ELECTRIC_SERVICE_URL=http://localhost:5133
NEXT_PUBLIC_ELECTRIC_SERVICE_URL=http://localhost:5133

# PostgreSQL (already configured)
DATABASE_URL=postgresql://...
```

## Step 6: Start ElectricSQL Service

**Option A: Using Docker (Recommended)**

```bash
# Start the service
# Note: ElectricSQL service scripts not yet implemented
# Or manually:
docker-compose -f docker-compose.electric.yml up -d

# View logs
# Note: ElectricSQL service scripts not yet implemented
# Or manually:
docker-compose -f docker-compose.electric.yml logs -f

# Stop the service
# Note: ElectricSQL service scripts not yet implemented
# Or manually:
docker-compose -f docker-compose.electric.yml down
```

**Option B: Self-Hosted**

```bash
# Install CLI globally
npm install -g @electric-sql/cli

# Start the service
npx @electric-sql/cli start
```

**Verify it's running:**
```bash
curl http://localhost:5133/health
```

You should see a successful response indicating the service is healthy.

## Step 7: Electrify Tables

Electrify the agent tables in your PostgreSQL database. This enables them for sync:

```sql
-- Run these SQL commands in your PostgreSQL database
ALTER TABLE agent_contexts ENABLE ELECTRIC;
ALTER TABLE agent_memories ENABLE ELECTRIC;
ALTER TABLE conversations ENABLE ELECTRIC;
ALTER TABLE agent_actions ENABLE ELECTRIC;
```

See `electric.migrations.sql` for the complete migration script and example Row Level Security (RLS) policies.

**Note**: Sync filtering is handled via:
1. **Sync shapes** in the client code (`packages/sync/src/sync/shapes.ts`)
2. **RLS policies** in PostgreSQL (optional, for additional security)
3. **Client-side filtering** in the hooks

## Step 8: Integrate into Apps

### CMS App

Update `apps/cms/src/lib/providers/index.tsx`:

```tsx
import { ElectricProvider } from '@revealui/sync/provider'

export const Providers = ({ children }) => {
  return (
    <ElectricProvider serviceUrl={process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL}>
      <ThemeProvider>
        <HeaderThemeProvider>{children}</HeaderThemeProvider>
      </ThemeProvider>
    </ElectricProvider>
  )
}
```

### Web App

Update app entry point (e.g., `apps/web/src/main.tsx`):

```tsx
import { ElectricProvider } from '@revealui/sync/provider'

function App() {
  return (
    <ElectricProvider serviceUrl={import.meta.env.VITE_ELECTRIC_SERVICE_URL}>
      <YourApp />
    </ElectricProvider>
  )
}
```

## Step 9: Test the Integration

1. **Start ElectricSQL service:**
   ```bash
   npx @electric-sql/cli start
   ```

2. **Start your apps:**
   ```bash
   pnpm dev
   ```

3. **Test cross-tab sync:**
   - Open app in two browser tabs
   - Create agent context in one tab
   - Verify it appears in the other tab

## Troubleshooting

### Service Won't Start

- Check PostgreSQL connection: `psql $DATABASE_URL`
- Verify port 5133 is available: `lsof -i :5133`
- Check ElectricSQL logs

### Schema Generation Fails

- Ensure PostgreSQL user has CREATE privileges
- Verify all agent tables exist
- Check ElectricSQL can connect to database

### Sync Not Working

- Verify ElectricSQL service is running
- Check browser console for errors
- Verify environment variables are set
- Check network tab for sync requests

## Next Steps

After setup is complete:

1. Update hooks to use generated query API
2. Implement real-time queries
3. Add error handling
4. Add loading states
5. Test cross-tab sync thoroughly

## Testing & Validation

- **[ElectricSQL Testing Results](../assessments/TESTING_RESULTS.md)** - Detailed testing results and critical findings
- **[ElectricSQL Testing Summary](../assessments/TESTING_SUMMARY.md)** - Quick summary of testing status and blockers

## Resources

- [ElectricSQL Documentation](https://electric-sql.com/docs)
- [ElectricSQL GitHub](https://github.com/electric-sql/electric)
- [ElectricSQL Discord](https://discord.gg/electric-sql)

---

# ElectricSQL Integration

**Last Updated**: January 2025  
**Status**: ⚠️ **In Development** - Service integration validation in progress

## Overview

ElectricSQL is integrated into RevealUI to enable **real-time synchronization of agent-related data** across browser tabs, sessions, and windows. This provides seamless cross-tab/cross-session agent memory sharing.

**Important**: ElectricSQL is **NOT used for core RevealUI collections**. It is only used for agent-related tables:
- `agent_contexts`
- `agent_memories`
- `agent_conversations`

Core RevealUI collections (users, posts, pages, etc.) use standard Drizzle ORM with PostgreSQL and do NOT sync via ElectricSQL.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    RevealUI Architecture                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  Core Collections │         │ Agent Tables     │     │
│  │  (Posts, Pages,   │         │ (Contexts,       │     │
│  │   Users, etc.)    │         │  Memories)       │     │
│  └──────────────────┘         └──────────────────┘     │
│         │                               │                │
│         │                               │                │
│         ▼                               ▼                │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  Drizzle ORM +   │         │  ElectricSQL +   │     │
│  │  PostgreSQL      │         │  PostgreSQL      │     │
│  │  (Direct)        │         │  (Synced)        │     │
│  └──────────────────┘         └──────────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Key Points

1. **Separate Systems**: Core collections and agent tables use different sync mechanisms
2. **No Conflicts**: ElectricSQL doesn't affect core collection operations
3. **Hybrid Approach**: Agent data uses ElectricSQL for real-time sync; core collections use standard REST APIs

## Package: `@revealui/sync`

The ElectricSQL integration is provided by the `@revealui/sync` package.

**Location**: `packages/sync/`

**Status**: ⚠️ **33/73 tests passing** (tests that don't require services). **40 tests pending** (require CMS/ElectricSQL services running).

### Features

- ✅ Cross-tab synchronization
- ✅ Cross-session persistence
- ✅ Real-time updates via subscriptions
- ✅ Offline-first support
- ✅ TypeScript type safety
- ⚠️ Service integration validation in progress

## Setup

### 1. Prerequisites

1. **PostgreSQL Database**: ElectricSQL syncs from PostgreSQL
2. **ElectricSQL Service**: Running ElectricSQL service (via Docker)
3. **Schema Generation**: ElectricSQL schema must be generated from migrations

### 2. Environment Variables

Add to your `.env` file:

```env
# PostgreSQL connection (shared with ElectricSQL)
POSTGRES_URL=postgresql://user:password@host:5432/database

# ElectricSQL Service URL (server-side)
ELECTRIC_SERVICE_URL=http://localhost:5133

# ElectricSQL Service URL (client-side, Next.js)
NEXT_PUBLIC_ELECTRIC_SERVICE_URL=http://localhost:5133

# Optional: ElectricSQL configuration
ELECTRIC_VERSION=latest
ELECTRIC_SERVICE_PORT=5133
ELECTRIC_PROXY_PORT=65432
ELECTRIC_WRITE_TO_PG_MODE=direct_writes
ELECTRIC_LOG_LEVEL=info
```

### 3. Start ElectricSQL Service

```bash
# Start ElectricSQL service using Docker Compose
# Note: ElectricSQL service scripts not yet implemented

# Or manually
docker compose -f docker-compose.electric.yml up -d

# Check service status
# Note: ElectricSQL service scripts not yet implemented

# Stop service
# Note: ElectricSQL service scripts not yet implemented
```

The ElectricSQL service is configured in `docker-compose.electric.yml`:

- **Port**: `5133` (HTTP API)
- **Proxy Port**: `65432` (WebSocket proxy)
- **Image**: `electricsql/electric:latest` (configurable via `ELECTRIC_VERSION`)
- **Health Check**: `http://localhost:5133/health`

### 4. Generate ElectricSQL Schema

After setting up your PostgreSQL database and running migrations:

```bash
# Generate ElectricSQL schema from PostgreSQL migrations
# Note: electric:generate script not yet implemented
# Use manual command: pnpm dlx electric-sql generate
```

This runs `pnpm dlx electric-sql generate` which:
- Connects to your PostgreSQL database
- Reads the agent table schemas
- Generates TypeScript types for ElectricSQL
- Updates the sync package with generated types

**Note**: The schema must be regenerated whenever agent table migrations change.

### 5. Enable ElectricSQL in App

Wrap your app with `ElectricProvider`:

```tsx
// apps/cms/app/layout.tsx or apps/web/src/app/layout.tsx
import { ElectricProvider } from '@revealui/sync/provider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ElectricProvider serviceUrl={process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL}>
          {children}
        </ElectricProvider>
      </body>
    </html>
  )
}
```

## Usage

### Hooks

#### `useAgentContext(agentId, options?)`

Access agent context in real-time:

```tsx
import { useAgentContext } from '@revealui/sync/hooks'

function AgentComponent({ agentId }) {
  const { context, updateContext, refresh } = useAgentContext(agentId, {
    sessionId: 'session-123',
    enabled: true
  })

  return (
    <div>
      <h2>Agent Context</h2>
      <pre>{JSON.stringify(context, null, 2)}</pre>
      <button onClick={() => updateContext({ key: 'value' })}>
        Update Context
      </button>
    </div>
  )
}
```

#### `useAgentMemory(agentId, options?)`

Access agent memories in real-time:

```tsx
import { useAgentMemory } from '@revealui/sync/hooks'

function MemoryComponent({ agentId }) {
  const { memories, addMemory, refresh } = useAgentMemory(agentId, {
    siteId: 'site-456'
  })

  return (
    <div>
      <h2>Agent Memories</h2>
      <ul>
        {memories?.map((memory) => (
          <li key={memory.id}>{memory.content}</li>
        ))}
      </ul>
      <button onClick={() => addMemory({ content: 'New memory' })}>
        Add Memory
      </button>
    </div>
  )
}
```

### API Routes

ElectricSQL shapes are proxied through authenticated API routes:

#### `/api/shapes/agent-contexts`

Authenticated proxy for `agent_contexts` shape:

```typescript
// Server-side usage
const response = await fetch('/api/shapes/agent-contexts?agent_id=agent-123', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

#### `/api/shapes/conversations`

Authenticated proxy for `agent_conversations` shape:

```typescript
const response = await fetch('/api/shapes/conversations?agent_id=agent-123', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

**Note**: These routes validate sessions and add row-level filtering before forwarding to ElectricSQL.

## Database Tables

ElectricSQL is enabled for these agent-related tables:

```sql
-- Enable ElectricSQL for agent tables
ALTER TABLE agent_contexts ENABLE ELECTRIC;
ALTER TABLE agent_memories ENABLE ELECTRIC;
ALTER TABLE agent_conversations ENABLE ELECTRIC;
```

See `docs/reference/database/electric.migrations.sql` for full migration scripts.

### Table Schemas

**agent_contexts**:
- `id` - UUID primary key
- `agent_id` - Agent identifier
- `session_id` - Session identifier
- `context_data` - JSONB context data
- `created_at`, `updated_at` - Timestamps

**agent_memories**:
- `id` - UUID primary key
- `agent_id` - Agent identifier
- `site_id` - Site identifier
- `memory_type` - Memory type (episodic, semantic, etc.)
- `content` - Text content
- `embedding_metadata` - JSONB embedding metadata
- `created_at`, `updated_at` - Timestamps

**agent_conversations**:
- `id` - UUID primary key
- `agent_id` - Agent identifier
- `user_id` - User identifier
- `messages` - JSONB conversation messages
- `created_at`, `updated_at` - Timestamps

## How It Works

1. **PostgreSQL**: Agent tables stored in PostgreSQL
2. **ElectricSQL Service**: Monitors PostgreSQL for changes via replication
3. **Client Sync**: ElectricSQL client subscribes to shapes (query results)
4. **Real-time Updates**: Changes sync automatically to all connected clients
5. **Offline Support**: Data cached locally, syncs when online

### Shape Subscriptions

ElectricSQL uses "shapes" for efficient data synchronization:

```typescript
// Shape defines what data to sync
const shape = {
  selects: [
    { tablename: 'agent_contexts' },
    { tablename: 'agent_memories' }
  ],
  where: {
    agent_id: 'agent-123'
  }
}

// Subscribe to shape - automatically syncs changes
const { data } = useShape(shape)
```

## Configuration

### Docker Compose

The ElectricSQL service is configured in `docker-compose.electric.yml`:

```yaml
services:
  electric-sql:
    image: electricsql/electric:${ELECTRIC_VERSION:-latest}
    ports:
      - "${ELECTRIC_SERVICE_PORT:-5133}:5133"
      - "${ELECTRIC_PROXY_PORT:-65432}:65432"
    environment:
      - DATABASE_URL=${POSTGRES_URL}
      - ELECTRIC_WRITE_TO_PG_MODE=direct_writes
      - ELECTRIC_LOG_LEVEL=info
      - ELECTRIC_INSECURE=true  # Development only
```

**Important**: Set `ELECTRIC_INSECURE=false` and configure `ELECTRIC_SECRET` for production.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ELECTRIC_SERVICE_URL` | Server-side service URL | `http://localhost:5133` |
| `NEXT_PUBLIC_ELECTRIC_SERVICE_URL` | Client-side service URL | `http://localhost:5133` |
| `ELECTRIC_VERSION` | Docker image version | `latest` |
| `ELECTRIC_SERVICE_PORT` | HTTP API port | `5133` |
| `ELECTRIC_PROXY_PORT` | WebSocket proxy port | `65432` |
| `ELECTRIC_WRITE_TO_PG_MODE` | Write mode | `direct_writes` |
| `ELECTRIC_LOG_LEVEL` | Logging level | `info` |
| `ELECTRIC_INSECURE` | Development mode | `true` |

## Development

### Local Development

1. **Start PostgreSQL**: Ensure PostgreSQL is running
2. **Start ElectricSQL**: `# Note: ElectricSQL service scripts not yet implemented`
3. **Generate Schema**: `# Note: electric:generate script not yet implemented
# Use manual command: pnpm dlx electric-sql generate`
4. **Start App**: `pnpm dev`

### Testing

```bash
# Run ElectricSQL tests (requires service)
pnpm --filter @revealui/sync test

# Test service health
curl http://localhost:5133/health
```

**Note**: Many tests require the ElectricSQL service to be running. See `packages/sync/README.md` for test status.

### Debugging

```bash
# View ElectricSQL logs
# Note: ElectricSQL service scripts not yet implemented

# Check service health
curl http://localhost:5133/health

# View database tables
psql $POSTGRES_URL -c "SELECT * FROM agent_contexts LIMIT 10;"
```

## Production Considerations

### Security

1. **Authentication**: Configure JWT auth for ElectricSQL service
2. **Secrets**: Set `ELECTRIC_SECRET` for production (disable `ELECTRIC_INSECURE`)
3. **TLS**: Use HTTPS for `ELECTRIC_SERVICE_URL` in production
4. **Row-Level Security**: API routes add row-level filtering before ElectricSQL

### Performance

1. **Shape Optimization**: Only sync data that's needed (use where clauses)
2. **Caching**: ElectricSQL caches data locally for offline support
3. **Connection Pooling**: ElectricSQL manages connections to PostgreSQL
4. **Resource Limits**: Configure resource limits in Docker (see `docker-compose.electric.yml`)

### Monitoring

- **Health Endpoint**: `http://localhost:5133/health`
- **Logs**: Use `# Note: ElectricSQL service scripts not yet implemented` or Docker logs
- **Metrics**: Monitor ElectricSQL service resource usage

## Troubleshooting

### Service Not Starting

```bash
# Check Docker is running
docker ps

# Check service logs
# Note: ElectricSQL service scripts not yet implemented

# Verify PostgreSQL connection
echo $POSTGRES_URL
```

### Schema Not Syncing

```bash
# Regenerate schema
# Note: electric:generate script not yet implemented
# Use manual command: pnpm dlx electric-sql generate

# Check agent tables are enabled
psql $POSTGRES_URL -c "SELECT tablename FROM electric.primed_tables;"
```

### Client Not Connecting

```bash
# Verify service URL
echo $NEXT_PUBLIC_ELECTRIC_SERVICE_URL

# Check service health
curl http://localhost:5133/health

# Verify provider is configured
# Check app layout has <ElectricProvider>
```

## References

- **Package**: `packages/sync/` - ElectricSQL integration package
- **Docker Compose**: `docker-compose.electric.yml` - Service configuration
- **Migrations**: `docs/reference/database/electric.migrations.sql` - Database setup
- **API Routes**: `apps/cms/src/app/api/shapes/` - Authenticated proxy routes
- **ElectricSQL Docs**: https://electric-sql.com/docs

## Related Documentation

- [Dual Database Architecture](../architecture/DUAL_DATABASE_ARCHITECTURE.md) - Database architecture overview
- [Database Setup](../setup/DATABASE_SETUP.md) - PostgreSQL setup guide
- [Agent Memory System](../architecture/AGENT_MEMORY_SYSTEM.md) - Agent memory architecture

---

**Status**: ⚠️ **In Development** - Service integration validation in progress. See `packages/sync/README.md` for current test status.



# Stripe Integration Setup Guide

This guide covers the recommended approaches for integrating Stripe with Supabase using official tools and best practices.

## 🎯 Recommended Approach: Stripe Sync Engine

The **Stripe Sync Engine** is Supabase's official integration for Stripe that automatically:
- Creates and maintains Stripe tables in your database
- Handles webhook processing
- Keeps data in sync automatically
- Provides proper RLS policies

### Setup Steps

1. **Enable Stripe Sync Engine** in your Supabase Dashboard:
   - Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/integrations/stripe_sync_engine
   - Click "Enable Stripe Sync Engine"
   - Connect your Stripe account
   - Configure webhook endpoints (handled automatically)

2. **Tables Created Automatically**:
   ```sql
   -- These tables are created and maintained by Stripe Sync Engine:
   - customers (Stripe customer data)
   - products (Stripe product catalog)
   - prices (Stripe pricing information)
   - subscriptions (Stripe subscription data)
   - invoices, payment_intents, etc. (additional Stripe objects)
   ```

3. **Generate Types** using official CLI:
   ```bash
   pnpm generate:supabase-types
   ```

## 🛠️ Alternative Approach: Drizzle ORM

If you prefer more control over your schema, use Drizzle ORM with Supabase:

### Setup Steps

1. **Install Drizzle**:
   ```bash
   pnpm add drizzle-orm postgres
   pnpm add -D drizzle-kit
   ```

2. **Define Schema** (`packages/db/src/types/stripe-schema.ts`):
   ```typescript
   import { pgTable, uuid, text, jsonb, boolean, bigint, pgEnum } from "drizzle-orm/pg-core";

   export const users = pgTable("users", {
     id: uuid("id").primaryKey().references(() => authUsers.id),
     stripeCustomerId: text("stripe_customer_id"),
     // ... other fields
   });
   ```

3. **Run Migrations**:
   ```bash
   pnpm db:push  # Push schema to database
   ```

4. **Generate Types**:
   ```bash
   pnpm generate:supabase-types  # Generate from actual database
   ```

## 📡 Type Generation (Official CLI)

Use the official Supabase CLI for reliable type generation:

### Prerequisites
```bash
# Install Supabase CLI
pnpm dlx supabase@latest

# Login (optional, can use SUPABASE_ACCESS_TOKEN instead)
pnpm dlx supabase login
```

### Generate Types
```bash
# Using npm script (recommended)
pnpm generate:supabase-types

# Or manually
pnpm dlx supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public > types.ts
```

### Environment Variables
```env
SUPABASE_PROJECT_ID=your_project_id
SUPABASE_ACCESS_TOKEN=your_access_token  # Optional but recommended
```

## 🔄 Automation

### Post-Install Hook
Types are automatically regenerated after `pnpm install`.

### Pre-Commit Hook
Types are checked and updated before commits.

### CI/CD Automation
Weekly automated type regeneration via GitHub Actions.

## 📋 Migration from Manual Setup

If you have existing manual tables, here's how to migrate:

1. **Enable Stripe Sync Engine** (recommended)
2. **Or run the Drizzle migration**:
   ```bash
   pnpm db:push
   ```
3. **Regenerate types**:
   ```bash
   pnpm generate:supabase-types
   ```

## 🏗️ Architecture Comparison

| Approach | Sync Engine | Drizzle ORM | Manual SQL |
|----------|-------------|-------------|------------|
| **Maintenance** | Automatic | Manual schema | Manual everything |
| **Type Safety** | High | Very High | Medium |
| **Customization** | Limited | Full control | Full control |
| **Setup Complexity** | Low | Medium | High |
| **Recommended For** | Most projects | Custom schemas | Legacy systems |

## 🎯 Recommendation

For most projects, use **Stripe Sync Engine** + **Official CLI types**. It's the most maintainable and reliable approach.

For projects needing custom schema logic, use **Drizzle ORM** with official types.

Avoid manual SQL table creation unless you have specific requirements not covered by the above approaches.

## 📚 Resources

- [Stripe Sync Engine Docs](https://supabase.com/docs/guides/integrations/stripe)
- [Drizzle ORM with Supabase](https://supabase.com/docs/guides/database/drizzle)
- [TypeScript Types Generation](https://supabase.com/docs/guides/api/rest/generating-types)