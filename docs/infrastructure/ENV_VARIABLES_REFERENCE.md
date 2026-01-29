# Environment Variables Reference

**Last Updated**: January 2026
**Status**: Configuration Reference (Project Not Yet Production Ready)

This document provides a complete reference for all environment variables used in the RevealUI Framework, categorized by requirement level and purpose.

---

## Quick Reference

### Required Variables (8)

These variables **must** be set for the application to function:

| Variable | Purpose | Security Level |
|----------|---------|----------------|
| `REVEALUI_SECRET` | JWT token encryption | 🔴 HIGH (Server-only) |
| `REVEALUI_PUBLIC_SERVER_URL` | RevealUI CMS server URL | 🟢 LOW (Client-safe) |
| `NEXT_PUBLIC_SERVER_URL` | Next.js server URL | 🟢 LOW (Client-safe) |
| `POSTGRES_URL` | PostgreSQL connection string | 🔴 HIGH (Server-only) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Storage token | 🔴 HIGH (Server-only) |
| `STRIPE_SECRET_KEY` | Stripe API secret key | 🔴 HIGH (Server-only) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature | 🔴 HIGH (Server-only) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | 🟢 LOW (Client-safe) |

### Optional Variables (15+)

These variables enhance functionality but are not required:

| Category | Variables | Purpose |
|----------|-----------|---------|
| **Admin** | `REVEALUI_ADMIN_EMAIL`, `REVEALUI_ADMIN_PASSWORD` | Initial admin user creation |
| **CORS** | `REVEALUI_CORS_ORIGINS` | Cross-origin resource sharing |
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_DATABASE_URI` | Supabase client integration |
| **Electric** | `NEXT_PUBLIC_ELECTRIC_SERVICE_URL`, `ELECTRIC_SERVICE_URL` | Real-time sync |
| **Sentry** | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Error monitoring |
| **Dev Tools** | `NEON_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_PROXY`, `SKIP_ONINIT` | Development & MCP tools |

---

## Required Variables (Detailed)

### 1. REVEALUI_SECRET

**Type**: Required  
**Security**: 🔴 HIGH - Server-side only  
**Format**: 32+ character random string  
**Purpose**: Encrypts JWT tokens and session data

**Generate**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example**:
```env
REVEALUI_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**Validation**: Must be at least 32 characters

---

### 2. REVEALUI_PUBLIC_SERVER_URL

**Type**: Required  
**Security**: 🟢 LOW - Safe for client-side  
**Format**: Full URL with protocol  
**Purpose**: Base URL for RevealUI CMS API endpoints

**Development**:
```env
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
```

**Production**:
```env
REVEALUI_PUBLIC_SERVER_URL=https://cms.your-domain.com
```

**Validation**: Must start with `http://` or `https://` (HTTPS required in production)

---

### 3. NEXT_PUBLIC_SERVER_URL

**Type**: Required  
**Security**: 🟢 LOW - Safe for client-side  
**Format**: Full URL with protocol  
**Purpose**: Base URL for Next.js API routes

**Should match** `REVEALUI_PUBLIC_SERVER_URL`

**Development**:
```env
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
```

**Production**:
```env
NEXT_PUBLIC_SERVER_URL=https://cms.your-domain.com
```

---

### 4. POSTGRES_URL

**Type**: Required  
**Security**: 🔴 HIGH - Server-side only  
**Format**: PostgreSQL connection string  
**Purpose**: Database connection for NeonDB, Supabase, or other Postgres providers

**Format**:
```
postgresql://user:password@host:port/database?sslmode=require
```

**Example (NeonDB)**:
```env
POSTGRES_URL=postgresql://neondb_owner:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**Example (Supabase)**:
```env
POSTGRES_URL=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**Note**: `DATABASE_URL` is supported as a fallback for compatibility, but `POSTGRES_URL` is the standard.

**Get from**:
- NeonDB: https://neon.tech → Dashboard → Connection String
- Supabase: https://supabase.com → Project Settings → Database → Connection String

---

### 5. BLOB_READ_WRITE_TOKEN

**Type**: Required  
**Security**: 🔴 HIGH - Server-side only  
**Format**: `vercel_blob_rw_...`  
**Purpose**: Vercel Blob Storage access token for media uploads

**⚠️ CRITICAL**: Without this, media uploads will **FAIL** in production!

**Get from**: https://vercel.com/dashboard → Storage → Blob → Create Token

**Example**:
```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk
```

---

### 6. STRIPE_SECRET_KEY

**Type**: Required  
**Security**: 🔴 HIGH - Server-side only  
**Format**: `sk_test_...` (dev) or `sk_live_...` (prod)  
**Purpose**: Stripe API secret key for payment processing

**Development** (use test keys):
```env
STRIPE_SECRET_KEY=sk_test_51XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Production** (use live keys):
```env
STRIPE_SECRET_KEY=sk_live_51XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Get from**: https://dashboard.stripe.com → Developers → API Keys

**Validation**: 
- Development: Should contain `test`
- Production: Should contain `live`

---

### 7. STRIPE_WEBHOOK_SECRET

**Type**: Required  
**Security**: 🔴 HIGH - Server-side only  
**Format**: `whsec_...`  
**Purpose**: Stripe webhook signature verification

**Local Development**:
```bash
# Run Stripe CLI
stripe listen --forward-to localhost:4000/api/webhooks/stripe
# Copy the webhook secret from output
```

**Production**:
1. Go to https://dashboard.stripe.com → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Copy webhook signing secret

**Example**:
```env
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

### 8. NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

**Type**: Required  
**Security**: 🟢 LOW - Safe for client-side  
**Format**: `pk_test_...` (dev) or `pk_live_...` (prod)  
**Purpose**: Stripe publishable key for client-side payment forms

**Development**:
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Production**:
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Get from**: https://dashboard.stripe.com → Developers → API Keys

---

## Optional Variables (Detailed)

### Admin User Creation

#### REVEALUI_ADMIN_EMAIL

**Type**: Optional  
**Security**: 🟢 LOW - Public information  
**Purpose**: Email for initial admin user (only used if no users exist)

```env
REVEALUI_ADMIN_EMAIL=admin@example.com
```

#### REVEALUI_ADMIN_PASSWORD

**Type**: Optional  
**Security**: 🔴 HIGH - Server-side only  
**Purpose**: Password for initial admin user (only used if no users exist)

**Validation**: Must be at least 12 characters

```env
REVEALUI_ADMIN_PASSWORD=your-secure-password-here
```

---

### CORS & Security

#### REVEALUI_CORS_ORIGINS

**Type**: Optional  
**Security**: 🟢 LOW - Public configuration  
**Purpose**: Comma-separated list of allowed CORS origins

**Format**: `https://domain1.com,https://domain2.com`

```env
REVEALUI_CORS_ORIGINS=https://your-frontend.com,https://your-staging.com
```

**Deprecated**: `REVEALUI_WHITELISTORIGINS` (use `REVEALUI_CORS_ORIGINS` instead)

---

### Supabase Integration

#### NEXT_PUBLIC_SUPABASE_URL

**Type**: Optional  
**Security**: 🟢 LOW - Safe for client-side  
**Purpose**: Supabase project URL for client features

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

#### NEXT_PUBLIC_SUPABASE_ANON_KEY

**Type**: Optional  
**Security**: 🟢 LOW - Safe for client-side  
**Purpose**: Supabase anonymous key for client features

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### SUPABASE_DATABASE_URI

**Type**: Optional  
**Security**: 🔴 HIGH - Server-side only  
**Purpose**: Alternative to `POSTGRES_URL` for Supabase connections

```env
SUPABASE_DATABASE_URI=postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

---

### Electric Sync

#### NEXT_PUBLIC_ELECTRIC_SERVICE_URL

**Type**: Optional  
**Security**: 🟢 LOW - Safe for client-side  
**Purpose**: Electric service URL for real-time sync (client-side)

```env
NEXT_PUBLIC_ELECTRIC_SERVICE_URL=ws://localhost:5133
```

#### ELECTRIC_SERVICE_URL

**Type**: Optional  
**Security**: 🟢 LOW - Server-side configuration  
**Purpose**: Electric service URL for real-time sync (server-side)

```env
ELECTRIC_SERVICE_URL=ws://localhost:5133
```

---

### Error Monitoring (Sentry)

#### NEXT_PUBLIC_SENTRY_DSN

**Type**: Optional  
**Security**: 🟢 LOW - Safe for client-side  
**Purpose**: Sentry DSN for error tracking

```env
NEXT_PUBLIC_SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@o1234567.ingest.sentry.io/1234567
```

#### SENTRY_AUTH_TOKEN

**Type**: Optional  
**Security**: 🔴 HIGH - Server-side only, CI/CD only  
**Purpose**: Sentry auth token for automated source map uploads

```env
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### SENTRY_ORG

**Type**: Optional  
**Security**: 🟢 LOW - Public configuration  
**Purpose**: Sentry organization slug

```env
SENTRY_ORG=your-org-slug
```

#### SENTRY_PROJECT

**Type**: Optional  
**Security**: 🟢 LOW - Public configuration  
**Purpose**: Sentry project slug

```env
SENTRY_PROJECT=your-project-slug
```

---

### Development Tools

#### NEON_API_KEY

**Type**: Optional  
**Security**: 🔴 HIGH - Server-side only  
**Purpose**: Neon API key for MCP server integration

```env
NEON_API_KEY=neon_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### SUPABASE_SERVICE_ROLE_KEY

**Type**: Optional  
**Security**: 🔴 HIGH - Server-side only, has admin access  
**Purpose**: Supabase service role key for MCP server integration

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### STRIPE_PROXY

**Type**: Optional  
**Security**: 🟢 LOW - Development only  
**Purpose**: Enable Stripe proxy logging (set to `1`)

```env
STRIPE_PROXY=0
```

#### SKIP_ONINIT

**Type**: Optional  
**Security**: N/A - Testing only  
**Purpose**: Skip onInit hook in test environment (set to `true`)

```env
SKIP_ONINIT=false
```

---

## Naming Conventions

### Standard Prefixes

1. **`REVEALUI_*`** - RevealUI-specific server-side variables
   - Example: `REVEALUI_SECRET`, `REVEALUI_PUBLIC_SERVER_URL`

2. **`NEXT_PUBLIC_*`** - Next.js client-side variables (exposed to browser)
   - Example: `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

3. **Third-party prefixes** - Standard prefixes for external services
   - `STRIPE_*` - Stripe integration
   - `BLOB_*` - Vercel Blob Storage
   - `SENTRY_*` - Sentry error monitoring
   - `SUPABASE_*` - Supabase integration
   - `NEON_*` - NeonDB integration
   - `ELECTRIC_*` - Electric sync

### Security Guidelines

- **🔴 HIGH Security** (Server-only): Never expose to client
  - Secrets, tokens, API keys, database URLs
  - Examples: `REVEALUI_SECRET`, `STRIPE_SECRET_KEY`, `POSTGRES_URL`

- **🟢 LOW Security** (Client-safe): Safe to expose to browser
  - Public URLs, publishable keys, DSNs
  - Must use `NEXT_PUBLIC_*` or `REVEALUI_PUBLIC_*` prefix
  - Examples: `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

## Environment-Specific Values

### Development

```env
NODE_ENV=development
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
STRIPE_SECRET_KEY=sk_test_...  # Use test keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Use test keys
```

### Production

```env
NODE_ENV=production
REVEALUI_PUBLIC_SERVER_URL=https://cms.your-domain.com  # Must be HTTPS
NEXT_PUBLIC_SERVER_URL=https://cms.your-domain.com  # Must be HTTPS
STRIPE_SECRET_KEY=sk_live_...  # Use live keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Use live keys
```

---

## Validation

### Manual Validation

Run the validation script:

```bash
pnpm validate:env
```

### CI/CD Validation

Environment variable validation runs automatically in CI/CD pipeline:
- Checks `.env.template` exists
- Validates required variables are documented
- Verifies naming conventions

---

## Migration Guide

### From DATABASE_URL to POSTGRES_URL

If you're using `DATABASE_URL`, migrate to `POSTGRES_URL`:

```bash
# Old
DATABASE_URL=postgresql://...

# New (preferred)
POSTGRES_URL=postgresql://...
```

**Note**: `DATABASE_URL` is still supported as a fallback, but `POSTGRES_URL` is the standard.

### From REVEALUI_WHITELISTORIGINS to REVEALUI_CORS_ORIGINS

```bash
# Old (deprecated)
REVEALUI_WHITELISTORIGINS=https://domain.com

# New (preferred)
REVEALUI_CORS_ORIGINS=https://domain.com
```

---

## Troubleshooting

### Missing Required Variables

If you see errors about missing variables:

1. Copy `.env.template` to `.env.development.local`
2. Fill in all required values
3. Run `pnpm validate:env` to verify

### Invalid Format Warnings

- **REVEALUI_SECRET too short**: Must be 32+ characters
- **URL missing protocol**: Must start with `http://` or `https://`
- **Production URL not HTTPS**: Production URLs must use HTTPS
- **Stripe key mismatch**: Development should use `test` keys, production should use `live` keys

### Naming Convention Warnings

If you see warnings about non-standard variable names:
- Use `REVEALUI_*` prefix for RevealUI-specific variables
- Use `NEXT_PUBLIC_*` prefix for client-side variables
- Follow standard third-party prefixes (`STRIPE_*`, `BLOB_*`, etc.)

---

## See Also

- [Environment Variables Guide](./ENVIRONMENT_VARIABLES_GUIDE.md) - Complete setup guide
- `.env.template` - Template file with all variables documented
- `scripts/validate-env.js` - Validation script source
