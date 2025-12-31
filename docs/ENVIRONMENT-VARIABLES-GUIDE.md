# 🔐 ENVIRONMENT VARIABLES - COMPLETE GUIDE

**Project**: RevealUI Framework  
**Last Updated**: January 16, 2025  
**Status**: Complete reference for all environment variables

---

## 📋 QUICK START

### 1. Copy Template File (30 seconds)

```bash
# From project root
cp .env.template .env.development.local
```

### 2. Get Required Credentials (15 minutes)

You need accounts on:

1. **Vercel** (database + storage) - https://vercel.com
2. **Stripe** (payments) - https://stripe.com
3. **Supabase** (optional database alternative) - https://supabase.com
4. **Sentry** (optional error monitoring) - https://sentry.io

### 3. Configure Minimum Required (5 minutes)

Edit `.env.development.local`:

```env
# Generate a random 32-character secret
PAYLOAD_SECRET=YOUR_GENERATED_SECRET_HERE

# Your local development URLs
PAYLOAD_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
PAYLOAD_WHITELISTORIGINS=http://localhost:3000,http://localhost:4000

# Database (choose ONE)
POSTGRES_URL=your_vercel_postgres_url
# OR
SUPABASE_DATABASE_URI=your_supabase_uri

# Storage (REQUIRED for media uploads)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXXX

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_XXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXX
```

---

## 🚨 CRITICAL VARIABLES (Must Have)

### 1. PAYLOAD_SECRET

**Purpose**: Encrypts JWT tokens and sessions  
**Format**: 32+ character random string  
**Security**: HIGH - Never expose to client

**Generate**:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example**:

```env
PAYLOAD_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

---

### 2. BLOB_READ_WRITE_TOKEN

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

### 3. Database Connection

**Choose ONE**:

#### Option A: Vercel Postgres (Recommended)

**Purpose**: Serverless-optimized PostgreSQL  
**Format**: `postgres://...`  
**Security**: HIGH

**Get Connection String**:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to: Storage → Postgres
3. Create Postgres database (or use existing)
4. Copy "POSTGRES_URL" from connection details

**Example**:

```env
POSTGRES_URL=postgres://default:password@host.postgres.vercel-storage.com:5432/verceldb?sslmode=require
```

#### Option B: Supabase Database

**Purpose**: Alternative PostgreSQL provider  
**Format**: `postgres://...`

**Get Connection String**:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to: Settings → Database
4. Copy "Connection string" (ensure it's in direct connection format)

**Example**:

```env
SUPABASE_DATABASE_URI=postgres://postgres.xxxxx:password@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

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

# Test mode indicator
PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY=1
```

**For Webhooks**:

1. In Stripe Dashboard: Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`
4. Copy webhook signing secret

---

### 5. Server URLs

**Purpose**: Frontend-backend communication  
**Format**: Full URL with protocol

**Development**:

```env
PAYLOAD_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
PAYLOAD_WHITELISTORIGINS=http://localhost:3000,http://localhost:4000
```

**Production**:

```env
PAYLOAD_PUBLIC_SERVER_URL=https://cms.your-domain.com
NEXT_PUBLIC_SERVER_URL=https://cms.your-domain.com
PAYLOAD_WHITELISTORIGINS=https://your-domain.com,https://cms.your-domain.com
```

---

## 📦 OPTIONAL VARIABLES

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

**Enable in code**: See `apps/cms/src/lib/config/sentry.ts`

---

### Supabase Additional (if using)

**Purpose**: Supabase client SDK and SSR  
**When to use**: If using Supabase as primary database

**Variables**:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx
```

**Get From**: Supabase Dashboard → Settings → API

---

### Stripe Development Tools

**Purpose**: Local webhook testing

**Variables**:

```env
# Enable detailed logging in development
STRIPE_PROXY=1
```

**For local webhook testing**:

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:4000/api/webhooks/stripe

# Copy webhook secret from output to .env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

---

### OpenAI / ChatGPT (if using)

**Purpose**: AI features in your app  
**When to use**: If implementing ChatGPT integration

**Variables**:

```env
OPENAI_API_KEY=sk-xxxxx
OPENAI_ORG_ID=org-xxxxx
```

**Get From**: [OpenAI Platform](https://platform.openai.com/api-keys)

---

## 🔒 SECURITY BEST PRACTICES

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
- `PAYLOAD_PUBLIC_*`

**Secret** (server-only):

- `PAYLOAD_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SENTRY_AUTH_TOKEN`

**⚠️ NEVER use secret variables in client components!**

---

### 3. Environment-Specific Values

| Environment | PAYLOAD_PUBLIC_SERVER_URL         | NODE_ENV      |
| ----------- | --------------------------------- | ------------- |
| Local Dev   | `http://localhost:4000`           | `development` |
| Staging     | `https://staging.your-domain.com` | `production`  |
| Production  | `https://your-domain.com`         | `production`  |

---

### 4. Rotating Secrets

**Rotate regularly** (every 90 days):

- `PAYLOAD_SECRET`
- `STRIPE_WEBHOOK_SECRET`
- `SENTRY_AUTH_TOKEN`

**After rotation**:

1. Update in `.env.development.local`
2. Update in Vercel Dashboard
3. Redeploy applications

---

## 🎯 VALIDATION CHECKLIST

Before starting development:

- [ ] Copied `.env.template` to `.env.development.local`
- [ ] Generated `PAYLOAD_SECRET` (32+ chars)
- [ ] Set up Vercel Blob Storage and got token
- [ ] Configured database (Vercel Postgres OR Supabase)
- [ ] Set up Stripe test keys
- [ ] Set correct URLs for local development
- [ ] Verified `.env.development.local` is in `.gitignore`

---

## 🚀 PRODUCTION SETUP

### Vercel Dashboard Configuration

1. Go to your project in Vercel
2. Navigate to: Settings → Environment Variables
3. Add ALL variables from your `.env.production`
4. Set correct environment:
   - **Production**: Production values
   - **Preview**: Staging values
   - **Development**: Local values (optional)

### Important Production Variables

```env
# MUST be HTTPS in production
PAYLOAD_PUBLIC_SERVER_URL=https://cms.your-domain.com
NEXT_PUBLIC_SERVER_URL=https://cms.your-domain.com

# MUST include production domain
PAYLOAD_WHITELISTORIGINS=https://your-domain.com,https://cms.your-domain.com

# MUST use production Stripe keys
STRIPE_SECRET_KEY=sk_live_XXXXX
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_XXXXX
PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY=0

# Environment
NODE_ENV=production
```

---

## 🧪 TESTING YOUR CONFIGURATION

### 1. Verify PayloadCMS Connection

```bash
cd apps/cms
pnpm dev
```

Visit `http://localhost:4000/admin` - should load without errors

---

### 2. Test Database Connection

Check console for:

```
✓ Connected to database
```

If you see connection errors, verify:

- `POSTGRES_URL` or `SUPABASE_DATABASE_URI` is correct
- Database is accessible
- SSL mode is correct (`?sslmode=require`)

---

### 3. Test Blob Storage

1. Go to `http://localhost:4000/admin/collections/media`
2. Upload a test image
3. Check Vercel Dashboard → Storage → Blob
4. Image should appear there

If upload fails:

- Verify `BLOB_READ_WRITE_TOKEN` is correct
- Check token has "Read & Write" permissions

---

### 4. Test Stripe Integration

```bash
# In one terminal
cd apps/cms
pnpm dev

# In another terminal
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

Copy the webhook secret to your `.env.development.local`

---

## 📚 VARIABLE REFERENCE

### Complete List by Category

#### PayloadCMS (6 required, 2 optional)

- ✅ `PAYLOAD_PUBLIC_SERVER_URL` (required)
- ✅ `PAYLOAD_SECRET` (required)
- ✅ `PAYLOAD_WHITELISTORIGINS` (required)
- ⚠️ `PAYLOAD_PUBLIC_DRAFT_SECRET` (optional - for preview)
- ⚠️ `PAYLOAD_REVALIDATION_KEY` (optional - for ISR)

#### Next.js (1 required)

- ✅ `NEXT_PUBLIC_SERVER_URL` (required)

#### Database (1 required - choose one)

- ✅ `POSTGRES_URL` (Vercel Postgres - recommended)
- ✅ `SUPABASE_DATABASE_URI` (Supabase - alternative)

#### Storage (1 required)

- ✅ `BLOB_READ_WRITE_TOKEN` (Vercel Blob - required)

#### Stripe (4 required)

- ✅ `STRIPE_SECRET_KEY` (required)
- ✅ `STRIPE_WEBHOOK_SECRET` (required)
- ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (required)
- ✅ `PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY` (required - set to 0 in prod)

#### Supabase Optional (3 optional)

- ⚠️ `SUPABASE_URL` (if using Supabase client)
- ⚠️ `SUPABASE_ANON_KEY` (if using Supabase client)
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY` (admin operations)

#### Sentry Optional (4 optional)

- ⚠️ `NEXT_PUBLIC_SENTRY_DSN` (error tracking)
- ⚠️ `SENTRY_AUTH_TOKEN` (CI/CD only)
- ⚠️ `SENTRY_ORG` (deployments)
- ⚠️ `SENTRY_PROJECT` (deployments)

---

## 🎯 MINIMUM VIABLE CONFIGURATION

For **local development** only:

```env
# Core (3 variables)
PAYLOAD_SECRET=generate_random_32_char_string
PAYLOAD_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000

# Database (1 variable - choose one)
POSTGRES_URL=postgres://localhost/revealui
# OR
SUPABASE_DATABASE_URI=postgres://...

# Storage (1 variable)
BLOB_READ_WRITE_TOKEN=get_from_vercel

# CORS (1 variable)
PAYLOAD_WHITELISTORIGINS=http://localhost:3000,http://localhost:4000

# Stripe (3 variables - use test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Total**: 9 variables minimum for local dev

---

## ⚠️ COMMON ISSUES & SOLUTIONS

### Issue: "Invalid PAYLOAD_SECRET"

**Solution**: Ensure it's 32+ characters

```bash
# Generate new secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Issue: "Database connection failed"

**Solution**: Check connection string format

```env
# Correct format:
POSTGRES_URL=postgres://user:password@host:5432/database?sslmode=require

# Common mistake: missing sslmode
```

### Issue: "Media upload failed"

**Solution**: Verify Blob token

1. Check token is correct
2. Verify token has Read & Write permissions
3. Ensure token is not expired

### Issue: "CORS error"

**Solution**: Check whitelisted origins

```env
# Must include ALL origins that will access the API
PAYLOAD_WHITELISTORIGINS=http://localhost:3000,http://localhost:4000,https://your-domain.com
```

### Issue: "Stripe webhook signature verification failed"

**Solution**:

1. For local: Use `stripe listen` to get webhook secret
2. For production: Create webhook in Stripe Dashboard

---

## 📖 REFERENCES

- [PayloadCMS Environment Variables](https://payloadcms.com/docs/configuration/overview#environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)

---

## ✅ VALIDATION SCRIPT

Save as `scripts/validate-env.js`:

```javascript
// Validate required environment variables
const required = [
  "PAYLOAD_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "PAYLOAD_PUBLIC_SERVER_URL",
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
if (!process.env.POSTGRES_URL && !process.env.SUPABASE_DATABASE_URI) {
  console.error(
    "❌ Missing database connection (need POSTGRES_URL or SUPABASE_DATABASE_URI)"
  )
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

_Last updated: January 16, 2025_  
_See: .env.template for full variable list_
