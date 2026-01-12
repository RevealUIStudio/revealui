# Environment Variables - Complete Guide

**Project**: RevealUI Framework  
**Last Updated**: January 2, 2026  
**Status**: Production Ready

---

## Quick Start

### 1. Copy Template File (30 seconds)

```bash
# From project root
cp .env.template .env.development.local
```

### 2. Get Required Credentials (15 minutes)

You need accounts on:

1. **NeonDB** (database) - https://neon.tech
2. **Vercel** (deployment + storage) - https://vercel.com
3. **Stripe** (payments) - https://stripe.com
4. **Supabase** (optional client features) - https://supabase.com

### 3. Configure Minimum Required (5 minutes)

Edit `.env.development.local`:

```env
# Generate a random 32-character secret
REVEALUI_SECRET=YOUR_GENERATED_SECRET_HERE

# Your local development URLs
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000

# Database (NeonDB Postgres)
POSTGRES_URL=postgresql://user:password@host/database?sslmode=require

# Storage (REQUIRED for media uploads)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXX

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_XXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXX
```

---

## Critical Variables (Must Have)

### 1. REVEALUI_SECRET

**Purpose**: Encrypts JWT tokens and sessions  
**Format**: 32+ character random string  
**Security**: HIGH - Never expose to client

**Generate**:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example**:

```env
REVEALUI_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

---

### 2. POSTGRES_URL

**Purpose**: NeonDB Postgres connection  
**Format**: `postgresql://...`  
**Security**: HIGH - Server-side only

**Get Connection String**:

1. Go to [NeonDB Console](https://console.neon.tech)
2. Select your project
3. Copy the connection string

**Example**:

```env
POSTGRES_URL=postgresql://neondb_owner:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

---

### 3. BLOB_READ_WRITE_TOKEN

**Purpose**: Vercel Blob Storage access for media uploads  
**Format**: `vercel_blob_rw_XXXXX`  
**Security**: HIGH - Server-side only

**Get Token**:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to: Storage → Blob
3. Create a Blob Store (or use existing)
4. Click "Create Token"
5. Select "Read & Write" permissions
6. Copy the token

**Example**:

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk
```

**⚠️ WARNING**: Without this, media uploads will FAIL in production!

---

### 4. Stripe Keys

**Purpose**: Payment processing  
**Security**: HIGH (secret key), LOW (publishable key)

**Get Keys**:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to: Developers → API Keys
3. Copy both Test keys for development

**Required Variables**:

```env
# Secret Key (server-side only)
STRIPE_SECRET_KEY=sk_test_51XXXXX

# Publishable Key (client-side safe)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXX

# Webhook Secret (for webhook verification)
# Get from: Developers → Webhooks → Add endpoint
STRIPE_WEBHOOK_SECRET=whsec_XXXXX
```

---

### 5. Server URLs

**Purpose**: Frontend-backend communication  
**Format**: Full URL with protocol

**Development**:

```env
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
```

**Production**:

```env
REVEALUI_PUBLIC_SERVER_URL=https://cms.your-domain.com
NEXT_PUBLIC_SERVER_URL=https://cms.your-domain.com
```

---

## Optional Variables

### Supabase Client (if using)

**Purpose**: Supabase client SDK for additional features  
**When to use**: If using Supabase for real-time features, auth, etc.

**Variables**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx
```

**Get From**: Supabase Dashboard → Settings → API

---

### Sentry (Error Monitoring)

**Purpose**: Production error tracking and performance monitoring  
**When to use**: Recommended for production

**Setup**:

1. Create account at [Sentry.io](https://sentry.io)
2. Create a new project (React)
3. Copy DSN from Settings → Client Keys

**Variables**:

```env
# Public DSN (embedded in client)
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# Auth Token (for source map uploads in CI/CD)
SENTRY_AUTH_TOKEN=sntrys_xxxxx

# Organization & Project (for deployments)
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

---

### ElectricSQL (Optional)

**Purpose**: Real-time sync service for agent memory sharing  
**When to use**: If implementing cross-tab/session agent memory sync  
**Security**: MEDIUM - Service URL is public, auth token is secret

**Variables**:

```env
# ElectricSQL Service URL (server-side)
ELECTRIC_SERVICE_URL=http://localhost:5133

# ElectricSQL Service URL (client-side, Next.js)
NEXT_PUBLIC_ELECTRIC_SERVICE_URL=http://localhost:5133

# Authentication token (optional, if using auth)
ELECTRIC_AUTH_TOKEN=your_token_here

# Service configuration (optional)
ELECTRIC_SERVICE_HOST=localhost
ELECTRIC_SERVICE_PORT=5133
ELECTRIC_PROXY_PORT=65432
```

**Setup**:

1. Start ElectricSQL service: `pnpm electric:service:start`
2. Verify service is running: `curl http://localhost:5133/health`
3. Generate client types: `pnpm electric:generate`

**Troubleshooting**:

- Connection issues: Check service is running and URL is correct
- Sync not working: Verify tables are electrified in PostgreSQL
- Type errors: Run `pnpm electric:generate` after service setup

See `docs/electric-setup-guide.md` for complete setup instructions.

---

### Stripe Development Tools

**Purpose**: Local webhook testing

For local webhook testing:

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:4000/api/webhooks/stripe

# Copy webhook secret from output to .env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

---

### OpenAI / ChatGPT (if using)

**Purpose**: AI features in your app  
**When to use**: If implementing AI integration

**Variables**:

```env
OPENAI_API_KEY=sk-xxxxx
OPENAI_ORG_ID=org-xxxxx
```

**Get From**: [OpenAI Platform](https://platform.openai.com/api-keys)

---

## Security Best Practices

### 1. Never Commit .env Files

**.gitignore** should include:

```
.env
.env.local
.env.development.local
.env.production.local
.env*.local
```

✅ Already configured in your project

---

### 2. Separate Public vs Secret Variables

**Public** (safe for client/browser):

- `NEXT_PUBLIC_*`
- `REVEALUI_PUBLIC_*`

**Secret** (server-only):

- `REVEALUI_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `POSTGRES_URL`
- `SENTRY_AUTH_TOKEN`
- `ELECTRIC_SERVICE_URL` (if not using public URL)
- `ELECTRIC_AUTH_TOKEN` (if using authentication)

**⚠️ NEVER use secret variables in client components!**

---

### 3. Environment-Specific Values

| Environment | REVEALUI_PUBLIC_SERVER_URL    | NODE_ENV      |
| ----------- | ----------------------------- | ------------- |
| Local Dev   | `http://localhost:4000`       | `development` |
| Staging     | `https://staging.domain.com`  | `production`  |
| Production  | `https://your-domain.com`     | `production`  |

---

### 4. Rotating Secrets

**Rotate regularly** (every 90 days):

- `REVEALUI_SECRET`
- `STRIPE_WEBHOOK_SECRET`
- `SENTRY_AUTH_TOKEN`

**After rotation**:

1. Update in `.env.development.local`
2. Update in Vercel Dashboard
3. Redeploy applications

---

## Validation Checklist

Before starting development:

- [ ] Copied `.env.template` to `.env.development.local`
- [ ] Generated `REVEALUI_SECRET` (32+ chars)
- [ ] Set up NeonDB and got `POSTGRES_URL`
- [ ] Set up Vercel Blob Storage and got token
- [ ] Set up Stripe test keys
- [ ] Set correct URLs for local development
- [ ] Verified `.env.development.local` is in `.gitignore`

---

## Production Setup

### Vercel Dashboard Configuration

1. Go to your project in Vercel
2. Navigate to: Settings → Environment Variables
3. Add ALL variables
4. Set correct environment:
   - **Production**: Production values
   - **Preview**: Staging values
   - **Development**: Local values (optional)

### Important Production Variables

```env
# MUST be HTTPS in production
REVEALUI_PUBLIC_SERVER_URL=https://cms.your-domain.com
NEXT_PUBLIC_SERVER_URL=https://cms.your-domain.com

# MUST use production Stripe keys
STRIPE_SECRET_KEY=sk_live_XXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_XXXXX

# Environment
NODE_ENV=production
```

---

## Testing Your Configuration

### 1. Verify Database Connection

```bash
cd apps/cms
pnpm dev
```

Check console for:
```
✓ Connected to database
```

If you see connection errors, verify:
- `POSTGRES_URL` is correct
- Database is accessible
- SSL mode is correct (`?sslmode=require`)

---

### 2. Test Blob Storage

1. Go to `http://localhost:4000/admin/collections/media`
2. Upload a test image
3. Check Vercel Dashboard → Storage → Blob
4. Image should appear there

If upload fails:
- Verify `BLOB_READ_WRITE_TOKEN` is correct
- Check token has "Read & Write" permissions

---

### 3. Test Stripe Integration

```bash
# In one terminal
cd apps/cms
pnpm dev

# In another terminal
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

Copy the webhook secret to your `.env.development.local`

---

## Variable Reference

### Complete List by Category

#### RevealUI Core (3 required)

- ✅ `REVEALUI_SECRET` (required)
- ✅ `REVEALUI_PUBLIC_SERVER_URL` (required)
- ✅ `NEXT_PUBLIC_SERVER_URL` (required)

#### Database (1 required)

- ✅ `POSTGRES_URL` (NeonDB - required)

#### Storage (1 required)

- ✅ `BLOB_READ_WRITE_TOKEN` (Vercel Blob - required)

#### Stripe (3 required)

- ✅ `STRIPE_SECRET_KEY` (required)
- ✅ `STRIPE_WEBHOOK_SECRET` (required)
- ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (required)

#### Supabase Client (optional)

- ⚠️ `NEXT_PUBLIC_SUPABASE_URL` (optional)
- ⚠️ `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional)

#### Sentry (optional)

- ⚠️ `NEXT_PUBLIC_SENTRY_DSN` (error tracking)
- ⚠️ `SENTRY_AUTH_TOKEN` (CI/CD only)
- ⚠️ `SENTRY_ORG` (deployments)
- ⚠️ `SENTRY_PROJECT` (deployments)

---

## Minimum Viable Configuration

For **local development** only:

```env
# Core (3 variables)
REVEALUI_SECRET=generate_random_32_char_string
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000

# Database (1 variable)
POSTGRES_URL=postgresql://user:password@host/db?sslmode=require

# Storage (1 variable)
BLOB_READ_WRITE_TOKEN=get_from_vercel

# Stripe (3 variables - use test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Total**: 8 variables minimum for local dev

---

## Common Issues & Solutions

### Issue: "Invalid REVEALUI_SECRET"

**Solution**: Ensure it's 32+ characters

```bash
# Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Issue: "Database connection failed"

**Solution**: Check connection string format

```env
# Correct format:
POSTGRES_URL=postgresql://user:password@host:5432/database?sslmode=require

# Common mistake: missing sslmode
```

### Issue: "Media upload failed"

**Solution**: Verify Blob token

1. Check token is correct
2. Verify token has Read & Write permissions
3. Ensure token is not expired

### Issue: "Stripe webhook signature verification failed"

**Solution**:

1. For local: Use `stripe listen` to get webhook secret
2. For production: Create webhook in Stripe Dashboard

---

## Validation Script

Save as `scripts/validate-env.js`:

```javascript
// Validate required environment variables
const required = [
  "REVEALUI_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "REVEALUI_PUBLIC_SERVER_URL",
  "NEXT_PUBLIC_SERVER_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
]

const missing = required.filter((key) => !process.env[key])

if (missing.length > 0) {
  console.error("❌ Missing required environment variables:")
  missing.forEach((key) => console.error(`   - ${key}`))
  process.exit(1)
}

// Check database
if (!process.env.POSTGRES_URL) {
  console.error("❌ Missing database connection (need POSTGRES_URL)")
  process.exit(1)
}

console.log("✅ All required environment variables are set!")
```

**Run**:

```bash
node scripts/validate-env.js
```

---

**Status**: ✅ **COMPLETE ENVIRONMENT GUIDE**

*Last updated: January 2, 2026*
