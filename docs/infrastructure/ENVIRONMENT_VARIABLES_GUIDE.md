# Environment Variables - Complete Guide

**Project**: RevealUI Framework
**Last Updated**: January 2, 2026
**Status**: Configuration Guide (Project Not Yet Production Ready)

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

1. Start ElectricSQL service: `# Note: ElectricSQL service scripts not yet implemented`
2. Verify service is running: `curl http://localhost:5133/health`
3. Generate client types: `# Note: electric:generate script not yet implemented
# Use manual command: pnpm dlx electric-sql generate`

**Troubleshooting**:

- Connection issues: Check service is running and URL is correct
- Sync not working: Verify tables are electrified in PostgreSQL
- Type errors: Run `# Note: electric:generate script not yet implemented
# Use manual command: pnpm dlx electric-sql generate` after service setup

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

## Related Documentation

- [Environment Variables Reference](./ENV_VARIABLES_REFERENCE.md) - Quick reference table
- [Developer Quick Start](../guides/QUICK_START.md) - 5-minute setup guide
- [Fresh Database Setup](../reference/database/FRESH-DATABASE-SETUP.md) - Database setup
- [CI/CD Guide](./CI-CD-GUIDE.md) - Deployment with environment variables
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task
- [Keywords Index](../KEYWORDS.md) - Search by keyword
- [Deployment Runbook](../guides/deployment/DEPLOYMENT-RUNBOOK.md) - Production deployment
- [Neon API Key Setup](../guides/configuration/NEON_API_KEY_SETUP.md) - Neon configuration
- [Supabase IPv4 Explanation](../reference/configuration/SUPABASE_IPV4_EXPLANATION.md) - Networking config
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task

---

**Status**: ✅ **COMPLETE ENVIRONMENT GUIDE**

*Last updated: January 2, 2026*
# Environment File Management Strategy

## Overview

This document outlines the comprehensive strategy for managing environment variables in the RevealUI monorepo, incorporating best practices from NixOS, direnv, and modern Node.js/Next.js workflows.

## File Hierarchy & Precedence

Environment variables are loaded in the following order (later files override earlier ones):

```
1. System environment variables (highest priority)
2. .env.development.local (local dev overrides, ignored by git)
3. .env.local (local overrides, ignored by git)
4. .env.development (shared dev defaults, optional)
5. .env (shared defaults, optional - only if non-sensitive)
```

## File Purposes

### `.env.template` (Committed)
- **Purpose**: Template/documentation file showing all required and optional variables
- **Content**: Placeholder values, comments explaining each variable
- **Status**: ✅ Committed to git
- **Usage**: Copy to `.env.development.local` for local development

### `.env.example` (Alternative to .env.template)
- **Purpose**: Same as `.env.template` - industry standard naming
- **Status**: ✅ Committed to git
- **Note**: We use `.env.template` to match the config loader's expectations

### `.env.development.local` (Ignored)
- **Purpose**: Local developer-specific overrides and secrets
- **Content**: Real credentials, local database URLs, personal API keys
- **Status**: ❌ Ignored by git (in `.gitignore`)
- **Usage**: Primary file for local development

### `.env.local` (Ignored)
- **Purpose**: Alternative local overrides (fallback if `.env.development.local` doesn't exist)
- **Status**: ❌ Ignored by git
- **Usage**: Less common, but supported for compatibility

### `.env` (Conditional)
- **Purpose**: Shared non-sensitive defaults (if any)
- **Content**: Only non-sensitive configuration
- **Status**: ⚠️ Currently contains secrets - should be ignored
- **Future**: Could be committed if cleaned of secrets, but not recommended

### `.env.production` (Optional)
- **Purpose**: Production-specific defaults (non-sensitive only)
- **Status**: ✅ Can be committed if non-sensitive
- **Usage**: Rarely needed - production uses CI/CD injected variables

## Current Issues & Solutions

### Issue 1: Poorly Named Files
- **Problem**: `.env.backup` and `.env.clean` are unclear
- **Solution**: Remove these files or move to `.env.backups/` directory if needed for reference

### Issue 2: Secrets in `.env`
- **Problem**: `.env` contains real secrets but is tracked in git
- **Solution**: 
  - Move all secrets to `.env.development.local`
  - Keep `.env` only for non-sensitive defaults (or remove entirely)
  - Ensure `.env` is in `.gitignore`

### Issue 3: No Template File
- **Problem**: No `.env.template` file for onboarding
- **Solution**: Create comprehensive `.env.template` with all variables documented

## Direnv Integration (Optional)

### What is direnv?
`direnv` automatically loads and unloads environment variables when you `cd` into directories based on `.envrc` files.

### Benefits
- Automatic environment loading when entering project directory
- Per-directory environment isolation
- Can integrate with NixOS dev shells
- Prevents forgetting to load env vars

### Setup (Optional)

1. **Install direnv**:
   ```bash
   # On macOS
   brew install direnv
   
   # On Linux (NixOS)
   # Already available if programs.direnv.enable = true
   
   # Add to shell config (~/.bashrc or ~/.zshrc)
   eval "$(direnv hook bash)"  # or zsh
   ```

2. **Create `.envrc`** in project root:
   ```bash
   # Load .env.development.local if it exists
   dotenv_if_exists .env.development.local
   
   # Or use direnv's built-in dotenv
   dotenv .env.development.local
   
   # For NixOS users (optional)
   # use flake  # if using Nix flakes
   # use nix    # if using shell.nix
   ```

3. **Allow direnv**:
   ```bash
   direnv allow
   ```

### When to Use direnv
- ✅ If you frequently switch between projects
- ✅ If you want automatic env loading
- ✅ If using NixOS dev shells
- ❌ Not necessary if you're fine with manual loading via dotenv-cli

## NixOS Best Practices

### Key Principles
1. **Declarative Configuration**: Define environments in `shell.nix` or `flake.nix`
2. **Secrets at Runtime**: Never bake secrets into Nix store
3. **Use direnv**: Combine with `use nix` or `use flake` for automatic loading
4. **Template Files**: Use `.env.template` for documentation, load secrets via `.env.local`

### Recommended Pattern
```nix
# shell.nix or flake.nix
{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = [ pkgs.nodejs pkgs.pnpm ];
  shellHook = ''
    # Load .env.local if it exists (secrets not in store)
    if [ -f .env.development.local ]; then
      set -a
      source .env.development.local
      set +a
    fi
  '';
}
```

```bash
# .envrc
use nix  # or use flake
dotenv .env.development.local
```

## Config Loader Behavior

The `@revealui/config` package loader (`packages/config/src/loader.ts`) currently:

1. **Looks for `.env.template`** as a marker for project root
2. **Loads in order**:
   - Development: `.env.development.local` → `.env.local` → `.env`
   - Test: `.env.test.local` → `.env.test`
   - Production: Only `process.env` (no file loading)

3. **Merges with precedence**: `process.env` overrides file-loaded variables

## Recommended File Structure

```
revealui/
├── .env.template          # ✅ Committed - template with placeholders
├── .envrc                  # ✅ Committed (optional) - direnv config
├── .env.development.local  # ❌ Ignored - your local secrets
├── .env.local              # ❌ Ignored - fallback local overrides
├── .env                    # ❌ Ignored - contains secrets (should be cleaned)
└── .gitignore              # ✅ Committed - ignores .env*.local, .env
```

## Migration Plan

### Step 1: Create Template
- [x] Create `.env.template` with all variables documented
- [x] Include comments explaining each variable
- [x] Use placeholder values (e.g., `YOUR_SECRET_HERE`)

### Step 2: Clean Up Existing Files
- [x] Remove or archive `.env.backup` → moved to `.env.backups/`
- [x] Remove or archive `.env.clean` → moved to `.env.backups/`
- [ ] Move secrets from `.env` to `.env.development.local` (see ENV_MIGRATION_GUIDE.md)
- [x] Update `.gitignore` to ensure `.env` is ignored

### Step 3: Update Documentation
- [ ] Update README.md with new setup instructions
- [ ] Update CONTRIBUTING.md
- [ ] Update any setup scripts

### Step 4: Optional - Add direnv
- [x] Create `.envrc` file
- [x] Document direnv setup in docs
- [x] Make it optional (not required for development)
- [x] Fix `.envrc` to use `dotenv_if_exists` (not `dotenv`)

## Security Best Practices

1. **Never commit secrets**: All `.env*.local` files must be in `.gitignore`
2. **Use placeholders in templates**: `.env.template` should never have real values
3. **Rotate secrets**: If secrets are ever committed, rotate them immediately
4. **Use secret managers in production**: CI/CD should inject secrets, not files
5. **Review `.gitignore` regularly**: Ensure all sensitive patterns are covered

## Validation

The project includes validation in:
- `packages/config/src/validator.ts` - Runtime validation
- `apps/cms/src/lib/utils/env-validation.ts` - CMS-specific validation
- `scripts/setup/validate-env.ts` - Setup validation script

Run validation:
```bash
pnpm validate:env
```

## Summary

| File | Committed? | Contains Secrets? | Purpose |
|------|-----------|-------------------|---------|
| `.env.template` | ✅ Yes | ❌ No | Template/documentation |
| `.env.example` | ✅ Yes | ❌ No | Alternative template name |
| `.env.development.local` | ❌ No | ✅ Yes | Local dev secrets |
| `.env.local` | ❌ No | ✅ Yes | Local overrides (fallback) |
| `.env` | ❌ No | ⚠️ Currently yes | Should be cleaned or removed |
| `.envrc` | ✅ Yes (optional) | ❌ No | Direnv configuration |

## References

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [direnv Documentation](https://direnv.net/)
- [NixOS Environment Variables](https://nixos.wiki/wiki/Environment_variables)
- [12-Factor App Config](https://12factor.net/config)
