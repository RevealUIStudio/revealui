---
title: "Environment Variables"
description: "Complete reference for all environment variables across apps and packages"
category: reference
audience: developer
---

# Environment Variables - Complete Guide

**Project**: RevealUI Framework
**Last Updated**: March 2026
**Status**: Configuration Guide (Production)

This document provides both quick reference tables and comprehensive guidance for all environment variables used in the RevealUI Framework.

Commercially, these variables support two distinct models:

- hosted account or workspace subscriptions plus metered agent or commerce usage
- deployment-level products such as Forge, which remain license-scoped

---

**For initial setup**, see [QUICK_START.md](./QUICK_START.md) first. This guide provides detailed environment variable configuration.

---

## Quick Reference Tables

### Required Variables (8)

These variables **must** be set for the application to function:

| Variable                             | Purpose                      | Security Level        |
| ------------------------------------ | ---------------------------- | --------------------- |
| `REVEALUI_SECRET`                    | Application secret (session signing, CSRF, HMAC operations) | 🔴 HIGH (Server-only) |
| `REVEALUI_PUBLIC_SERVER_URL`         | RevealUI admin server URL      | 🟢 LOW (Client-safe)  |
| `NEXT_PUBLIC_SERVER_URL`             | Next.js server URL           | 🟢 LOW (Client-safe)  |
| `POSTGRES_URL`                       | PostgreSQL connection string | 🔴 HIGH (Server-only) |
| `BLOB_READ_WRITE_TOKEN`              | Vercel Blob Storage token    | 🔴 HIGH (Server-only) |
| `STRIPE_SECRET_KEY`                  | Stripe API secret key        | 🔴 HIGH (Server-only) |
| `STRIPE_WEBHOOK_SECRET`              | Stripe webhook signature     | 🔴 HIGH (Server-only) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key       | 🟢 LOW (Client-safe)  |

### Optional Variables (15+)

These variables enhance functionality but are not required:

| Category      | Variables                                                                            | Purpose                       |
| ------------- | ------------------------------------------------------------------------------------ | ----------------------------- |
| **Admin**     | `REVEALUI_ADMIN_EMAIL`, `REVEALUI_ADMIN_PASSWORD`                                    | Initial admin user creation   |
| **CORS**      | `REVEALUI_CORS_ORIGINS`                                                              | Cross-origin resource sharing |
| **Supabase**  | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_DATABASE_URI` | Supabase client integration   |
| **Electric**  | `NEXT_PUBLIC_ELECTRIC_SERVICE_URL`, `ELECTRIC_SERVICE_URL`                           | Real-time sync                |
| **Sentry**    | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`        | Error monitoring              |
| **Dev Tools** | `NEON_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_PROXY`, `SKIP_ONINIT`           | Development & MCP tools       |

### Naming Conventions

#### Standard Prefixes

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

#### Security Guidelines

- **🔴 HIGH Security** (Server-only): Never expose to client
  - Secrets, tokens, API keys, database URLs
  - Examples: `REVEALUI_SECRET`, `STRIPE_SECRET_KEY`, `POSTGRES_URL`

- **🟢 LOW Security** (Client-safe): Safe to expose to browser
  - Public URLs, publishable keys, DSNs
  - Must use `NEXT_PUBLIC_*` or `REVEALUI_PUBLIC_*` prefix
  - Examples: `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

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

**Commercial note**: Stripe configuration should back an account-level billing owner and a server-owned catalog. Long-term pricing should rely on subscriptions, usage meters, and commerce-linked fees rather than a pure per-user license model.

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
REVEALUI_PUBLIC_SERVER_URL=https://admin.your-domain.com
NEXT_PUBLIC_SERVER_URL=https://admin.your-domain.com
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

### Open-Model Inference

**Purpose**: AI agent inference configuration
**When to use**: If using AI features (Pro tier and above)

All inference runs on open models only. No proprietary providers (OpenAI, Anthropic, Groq).

**Variables**:

```env
# Ubuntu Inference Snaps (Canonical)
INFERENCE_SNAPS_BASE_URL=http://localhost:8080/v1

# Ollama (any open source GGUF model)
OLLAMA_BASE_URL=http://localhost:11434/v1

# HuggingFace Inference API (open models)
HUGGINGFACE_API_KEY=hf_xxxxx

# Vultr GPU Cloud (open models, serverless inference)
VULTR_API_KEY=VXUUC6WSXXXXXXXXXXXXXXXXXXXXXXXXXX
VULTR_BASE_URL=https://api.vultrinference.com/v1

# Force a specific inference provider (overrides auto-detection)
# Valid values: ollama, huggingface, vultr, inference-snaps
LLM_PROVIDER=ollama
```

**Setup**: See [AI Stack Architecture](./architecture/ai-stack.md) for inference path details

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

| Environment | REVEALUI_PUBLIC_SERVER_URL   | NODE_ENV      |
| ----------- | ---------------------------- | ------------- |
| Local Dev   | `http://localhost:4000`      | `development` |
| Staging     | `https://staging.domain.com` | `production`  |
| Production  | `https://your-domain.com`    | `production`  |

#### Development Configuration

```env
NODE_ENV=development
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
STRIPE_SECRET_KEY=sk_test_...  # Use test keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Use test keys
```

#### Production Configuration

```env
NODE_ENV=production
REVEALUI_PUBLIC_SERVER_URL=https://admin.your-domain.com  # Must be HTTPS
NEXT_PUBLIC_SERVER_URL=https://admin.your-domain.com  # Must be HTTPS
STRIPE_SECRET_KEY=sk_live_...  # Use live keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Use live keys
```

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
REVEALUI_PUBLIC_SERVER_URL=https://admin.your-domain.com
NEXT_PUBLIC_SERVER_URL=https://admin.your-domain.com

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
cd apps/admin
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
cd apps/admin
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

## Migration Guides

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
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("❌ Missing required environment variables:");
  missing.forEach((key) => console.error(`   - ${key}`));
  process.exit(1);
}

// Check database
if (!process.env.POSTGRES_URL) {
  console.error("❌ Missing database connection (need POSTGRES_URL)");
  process.exit(1);
}

console.log("✅ All required environment variables are set!");
```

**Run**:

```bash
node scripts/validate-env.js
```

## Related Documentation

- [Developer Quick Start](./QUICK_START.md) - 5-minute setup guide
- [Database Guide](./DATABASE.md) - Complete database setup and management
- [CI/CD Guide](./CI_CD_GUIDE.md) - Deployment with environment variables
- [Master Index](./INDEX.md) - Complete documentation index

---

**Status**: ✅ **COMPLETE ENVIRONMENT GUIDE** (Consolidated from ENV_VARIABLES_REFERENCE.md)

_Last updated: January 31, 2026_

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
- `apps/admin/src/lib/utils/env-validation.ts` - Admin-specific validation
- `scripts/setup/validate-env.ts` - Setup validation script

Run validation:

```bash
pnpm validate:env
```

## Summary

| File                     | Committed?        | Contains Secrets? | Purpose                      |
| ------------------------ | ----------------- | ----------------- | ---------------------------- |
| `.env.template`          | ✅ Yes            | ❌ No             | Template/documentation       |
| `.env.development.local` | ❌ No             | ✅ Yes            | Local dev secrets            |
| `.env.local`             | ❌ No             | ✅ Yes            | Local overrides (fallback)   |
| `.env`                   | ❌ No             | ⚠️ Currently yes  | Should be cleaned or removed |
| `.envrc`                 | ✅ Yes (optional) | ❌ No             | Direnv configuration         |

## References

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [direnv Documentation](https://direnv.net/)
- [NixOS Environment Variables](https://nixos.wiki/wiki/Environment_variables)
- [12-Factor App Config](https://12factor.net/config)
