---
title: "Environment Variables Guide"
description: "Complete reference for all environment variables: required vs optional, per-environment configuration, secret management, and troubleshooting"
last-updated: 2026-04-12
status: production
category: reference
audience: developer
---

# Environment Variables Guide

This guide is the single reference for every environment variable used across the RevealUI monorepo. It covers setup, validation, secret management, and per-environment configuration.

For initial project setup, see [Quick Start](./QUICK_START.md). For deployment pipelines, see [CI/CD Guide](./CI_CD_GUIDE.md).

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Variable Reference](#variable-reference)
   - [Core](#core)
   - [Database](#database)
   - [Storage](#storage)
   - [Auth and Session](#auth-and-session)
   - [Stripe Payments](#stripe-payments)
   - [AI and Inference](#ai-and-inference)
   - [ElectricSQL Sync](#electricsql-sync)
   - [Supabase](#supabase)
   - [Branding and White-Label](#branding-and-white-label)
   - [Signup Control](#signup-control)
   - [License](#license)
   - [x402 Native Payments](#x402-native-payments)
   - [Perpetual License Provisioning](#perpetual-license-provisioning)
   - [Forge Self-Hosted](#forge-self-hosted)
   - [MCP Marketplace](#mcp-marketplace)
   - [MCP Servers](#mcp-servers)
   - [Error Monitoring (Sentry)](#error-monitoring-sentry)
   - [Feature Flags and Dev Tools](#feature-flags-and-dev-tools)
   - [App-Specific](#app-specific)
3. [Environment-Specific Configuration](#environment-specific-configuration)
4. [Env File Loading Order](#env-file-loading-order)
5. [Secret Management (RevVault)](#secret-management-revvault)
6. [Vercel Environment Configuration](#vercel-environment-configuration)
7. [Adding New Environment Variables](#adding-new-environment-variables)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

The fastest path to a running local dev environment requires **5 variables**. Stripe, Blob storage, and other services are optional for initial development.

### Step 1: Copy the Template

```bash
cp .env.template .env.development.local
```

### Step 2: Set the Required Variables

Open `.env.development.local` and fill in:

```env
# Generate a 32+ character random secret
REVEALUI_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Server URLs (defaults work for local dev)
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000

# Database: get a connection string from NeonDB, Supabase, or local Postgres
POSTGRES_URL=postgresql://user:password@host:5432/database?sslmode=require
```

### Step 3: Start Development

```bash
pnpm dev
```

### What Is Truly Required vs What Can Wait

| Priority | Variables | When You Need Them |
|----------|-----------|-------------------|
| **Must have** | `REVEALUI_SECRET`, `REVEALUI_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_SERVER_URL`, `POSTGRES_URL` | Always, for any local dev |
| **For payments** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | When testing checkout, subscriptions, or billing |
| **For uploads** | `BLOB_READ_WRITE_TOKEN` | When testing media uploads |
| **For AI** | `LLM_PROVIDER`, `OLLAMA_BASE_URL` or `INFERENCE_SNAPS_BASE_URL` | When testing AI agent features |
| **For email** | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | When testing password reset or waitlist emails |
| **For sync** | `NEXT_PUBLIC_ELECTRIC_SERVICE_URL`, `ELECTRIC_SERVICE_URL` | When testing real-time sync features |
| **For monitoring** | `NEXT_PUBLIC_SENTRY_DSN` | Recommended for staging and production |

### Validation

The `@revealui/config` package validates all env vars at runtime using Zod schemas. If a required variable is missing or malformed, you get a clear error message on startup.

```bash
# Run manual validation
pnpm validate:env
```

During Next.js builds, set `SKIP_ENV_VALIDATION=true` to defer validation to runtime. This flag is only accepted during build phases (`NEXT_PHASE` set) or in test environments (`NODE_ENV=test`). Using it in any other context throws a security error.

---

## Variable Reference

### Naming Conventions

| Prefix | Meaning | Client-Safe? |
|--------|---------|-------------|
| `REVEALUI_*` | RevealUI-specific server-side variables | No |
| `REVEALUI_PUBLIC_*` | RevealUI public configuration | Yes |
| `NEXT_PUBLIC_*` | Next.js client-side variables (bundled into browser JS) | Yes |
| `VITE_*` | Vite client-side variables (docs app) | Yes |
| `STRIPE_*` | Stripe server-side keys | No |
| `NEXT_PUBLIC_STRIPE_*` | Stripe client-side keys | Yes |

**Rule**: Any variable without `NEXT_PUBLIC_` or `REVEALUI_PUBLIC_` prefix is server-only. Never import server-only variables in client components.

---

### Core

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `REVEALUI_SECRET` | Yes | None | Application secret for session signing, CSRF tokens, and HMAC operations. Must be 32+ characters. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. | HIGH (server-only) | admin, api |
| `REVEALUI_PUBLIC_SERVER_URL` | Yes | None | Public URL of the admin server. `http://localhost:4000` for local dev, `https://admin.yourdomain.com` for production. | LOW (client-safe) | admin, marketing |
| `NEXT_PUBLIC_SERVER_URL` | Yes | None | Same as `REVEALUI_PUBLIC_SERVER_URL`. Must match exactly; validation warns if they differ. | LOW (client-safe) | admin |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3004` | Public URL of the Hono API server. | LOW (client-safe) | marketing, docs |
| `SESSION_COOKIE_DOMAIN` | Prod only | None | Root domain with leading dot (e.g., `.example.com`) to share auth cookies across subdomains. Required in production. | MEDIUM | admin |
| `NODE_ENV` | No | `development` | Set automatically by Next.js and Vercel. Values: `development`, `production`, `test`. | LOW | all |
| `NODE_OPTIONS` | No | None | Node.js runtime flags. Common: `--no-deprecation`. | LOW | all |

---

### Database

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `POSTGRES_URL` | Yes | None | PostgreSQL connection string for the primary database (NeonDB recommended). Format: `postgresql://user:password@host:port/database?sslmode=require`. | HIGH (server-only) | admin, api |
| `DATABASE_URL` | No | None | Fallback for `POSTGRES_URL`. If `POSTGRES_URL` is not set, this value is used automatically. A deprecation warning is logged. | HIGH (server-only) | admin, api |
| `SUPABASE_DATABASE_URL` | No | None | Supabase PostgreSQL connection for the vector database (pgvector). Used for AI memory embeddings, agent tasks, and semantic search. | HIGH (server-only) | ai, api |
| `SUPABASE_DATABASE_URI` | No | None | Alternative naming for the Supabase connection. Accepted as a fallback in the database config module. | HIGH (server-only) | admin, api |
| `DB_POOL_MAX` | No | `10` | Maximum connections in the pg pool. | LOW | admin, api |
| `DB_POOL_IDLE_TIMEOUT` | No | `30000` | Idle connection timeout in milliseconds. | LOW | admin, api |

---

### Storage

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `BLOB_READ_WRITE_TOKEN` | For uploads | None | Vercel Blob Storage read/write token. Required for media uploads in production. Get from Vercel Dashboard, Storage, Blob, Create Token. | HIGH (server-only) | admin |

---

### Auth and Session

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `REVEALUI_ADMIN_EMAIL` | No | None | Email for the initial admin user. Only used during first-run bootstrap when no users exist. | LOW | admin |
| `REVEALUI_ADMIN_PASSWORD` | No | None | Password for the initial admin user. Must be 12+ characters. Only used during first-run bootstrap. | HIGH (server-only) | admin |
| `GOOGLE_CLIENT_ID` | No | None | Google OAuth 2.0 client ID for admin SSO. | HIGH (server-only) | admin |
| `GOOGLE_CLIENT_SECRET` | No | None | Google OAuth 2.0 client secret. | HIGH (server-only) | admin |
| `GITHUB_CLIENT_ID` | No | None | GitHub OAuth App client ID for admin SSO. | HIGH (server-only) | admin |
| `GITHUB_CLIENT_SECRET` | No | None | GitHub OAuth App client secret. | HIGH (server-only) | admin |
| `VERCEL_CLIENT_ID` | No | None | Vercel OAuth App client ID for admin SSO. | HIGH (server-only) | admin |
| `VERCEL_CLIENT_SECRET` | No | None | Vercel OAuth App client secret. | HIGH (server-only) | admin |
| `OAUTH_ADMIN_EMAILS` | No | None | Comma-separated email allowlist for OAuth admin access. Leave empty to allow any authenticated OAuth account. | MEDIUM | admin |
| `NEXT_PUBLIC_APP_URL` | No | `NEXT_PUBLIC_SERVER_URL` | Base URL for constructing OAuth redirect URIs. | LOW (client-safe) | admin |
| `RESEND_API_KEY` | No | None | Resend API key for transactional emails (password reset, waitlist notifications). | HIGH (server-only) | admin, api |
| `RESEND_FROM_EMAIL` | No | None | Sender address for transactional emails. | LOW | admin, api |
| `REVEALUI_WAITLIST_NOTIFY_EMAIL` | No | None | Email address to notify on waitlist signups. Silently skipped if unset. | LOW | marketing |
| `REVEALUI_SUPPORT_EMAIL` | No | `support@revealui.com` | Support contact shown in transactional emails sent to customers. | LOW | admin, api |

---

### Stripe Payments

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `STRIPE_SECRET_KEY` | For payments | None | Stripe API secret key. Use `sk_test_...` in development, `sk_live_...` in production. Validation enforces correct prefix per environment. | HIGH (server-only) | admin, api |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | For payments | None | Stripe publishable key. Use `pk_test_...` in development, `pk_live_...` in production. | LOW (client-safe) | admin |
| `STRIPE_WEBHOOK_SECRET` | For payments | None | Webhook signing secret for verifying Stripe event signatures. For local dev, run `stripe listen --forward-to localhost:4000/api/webhooks/stripe` and use the printed secret. | HIGH (server-only) | admin, api |
| `STRIPE_WEBHOOK_SECRET_LIVE` | No | None | Separate webhook secret for live mode (if using distinct endpoints). | HIGH (server-only) | admin, api |
| `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` | No | None | Stripe Price ID for Pro tier. Created by `pnpm stripe:seed`. | LOW (client-safe) | admin |
| `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID` | No | None | Stripe Price ID for Max tier. | LOW (client-safe) | admin |
| `NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID` | No | None | Stripe Price ID for Enterprise/Forge tier. | LOW (client-safe) | admin |
| `STRIPE_RENEWAL_PRO_PRICE_ID` | No | None | Annual support renewal price for perpetual Pro licenses. | HIGH (server-only) | api |
| `STRIPE_RENEWAL_MAX_PRICE_ID` | No | None | Annual support renewal price for perpetual Max licenses. | HIGH (server-only) | api |
| `STRIPE_RENEWAL_ENTERPRISE_PRICE_ID` | No | None | Annual support renewal price for perpetual Enterprise licenses. | HIGH (server-only) | api |
| `STRIPE_AGENT_METER_EVENT_NAME` | No | `agent_task_overage` | Stripe Billing Meter event name for agent task usage reporting. Create a Meter in Stripe Dashboard matching this value. | HIGH (server-only) | api |
| `REVEALUI_EARLY_ADOPTER_END` | No | None | ISO date when early adopter promotion ends (e.g., `2026-06-01`). | LOW | api |
| `REVEALUI_EARLY_ADOPTER_COUPON_PRO` | No | None | Stripe coupon ID for early adopter Pro discount. | HIGH (server-only) | api |
| `REVEALUI_EARLY_ADOPTER_COUPON_MAX` | No | None | Stripe coupon ID for early adopter Max discount. | HIGH (server-only) | api |
| `REVEALUI_LICENSE_PRIVATE_KEY` | No | None | RSA-2048 PEM private key for signing license keys. Generated by `pnpm stripe:keys`. | HIGH (server-only) | api |
| `REVEALUI_LICENSE_PUBLIC_KEY` | No | None | RSA-2048 PEM public key for verifying license keys. | MEDIUM | admin, api |
| `STRIPE_PROXY` | No | `0` | Set to `1` to enable Stripe proxy logging. Development only. | LOW | admin |

---

### AI and Inference

RevealUI supports open models for AI features. No proprietary cloud APIs are required.

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `LLM_PROVIDER` | No | `openai` | LLM provider selection. Options: `openai`, `anthropic`, `vultr`, `ollama`, `inference-snaps`. | LOW | ai, api |
| `LLM_MODEL` | No | None | Provider-specific model name (e.g., `gemma4:e2b`, `qwen/qwen3-32b`). | LOW | ai, api |
| `OPENAI_API_KEY` | No | None | OpenAI API key. Only needed if using the OpenAI provider. | HIGH (server-only) | ai |
| `ANTHROPIC_API_KEY` | No | None | Anthropic API key. Only needed if using the Anthropic provider. | HIGH (server-only) | ai |
| `VULTR_API_KEY` | No | None | Vultr AI API key. Only needed if using the Vultr provider. | HIGH (server-only) | ai |
| `VULTR_BASE_URL` | No | `https://api.vultrinference.com/v1` | Vultr inference endpoint URL. | LOW | ai |
| `INFERENCE_SNAPS_BASE_URL` | No | `http://localhost:9090/v1` | Ubuntu Inference Snaps endpoint (Canonical). Recommended for self-hosted inference. | LOW | ai |
| `OLLAMA_BASE_URL` | No | `http://localhost:11434` | Ollama endpoint for running local GGUF models. | LOW | ai |
| `TAVILY_API_KEY` | No | None | Tavily API key for AI agent web search tools. | HIGH (server-only) | ai |
| `LLM_ENABLE_CACHE` | No | `true` | Enable Anthropic prompt caching (90% cost savings on repeated context, 5-min TTL). Works with Anthropic Claude only. | LOW | ai |
| `LLM_ENABLE_RESPONSE_CACHE` | No | `true` | Enable response caching (100% cost savings on duplicate requests, 5-min TTL). Works with all providers. | LOW | ai |
| `LLM_ENABLE_SEMANTIC_CACHE` | No | `true` | Enable semantic caching (matches similar queries using vector embeddings, 1-hour TTL, 0.95 similarity threshold). Requires `POSTGRES_URL` with pgvector. | LOW | ai |
| `ENABLE_VECTOR_MEMORY` | No | `false` | Enable semantic search for conversation context. Requires `POSTGRES_URL` with pgvector. | LOW | ai |

---

### ElectricSQL Sync

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `NEXT_PUBLIC_ELECTRIC_SERVICE_URL` | No | None | ElectricSQL service URL for client-side real-time sync (e.g., `ws://localhost:5133`). | LOW (client-safe) | admin |
| `ELECTRIC_SERVICE_URL` | No | None | ElectricSQL service URL for server-side use. | LOW | api |
| `ELECTRIC_DATABASE_URL` | No | None | ElectricSQL database connection string. | HIGH (server-only) | api |
| `ELECTRIC_API_KEY` | No | None | ElectricSQL API key for authenticated connections. | HIGH (server-only) | api |

---

### Supabase

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | No | None | Supabase project URL. Only needed if using Supabase client features (real-time, auth). | LOW (client-safe) | admin |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | None | Supabase anonymous key for client-side access. | LOW (client-safe) | admin |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | No | None | Legacy naming for `NEXT_PUBLIC_SUPABASE_ANON_KEY`. | LOW (client-safe) | admin |
| `SUPABASE_SECRET_KEY` | No | None | Supabase service role key. Has admin access to all tables. | HIGH (server-only) | api |
| `SUPABASE_SERVICE_ROLE_KEY` | No | None | Alternative naming for `SUPABASE_SECRET_KEY`. Used in MCP server integration. | HIGH (server-only) | mcp |

---

### Branding and White-Label

Enterprise tier feature. Controls the look and feel of admin UI and transactional emails.

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `REVEALUI_BRAND_NAME` | No | `RevealUI` | Display name shown in admin UI and emails. | LOW | admin |
| `REVEALUI_BRAND_LOGO_URL` | No | None (bundled RevealUI logo) | URL to a custom logo image. | LOW | admin |
| `REVEALUI_BRAND_PRIMARY_COLOR` | No | None (RevealUI palette) | Primary brand color as hex (e.g., `#6366f1`). Validated: must match `#[0-9a-fA-F]{3,8}`. | LOW | admin |
| `REVEALUI_SHOW_POWERED_BY` | No | `true` | Show "Built with RevealUI" footer badge. Set to `false` to hide (requires Pro license). | LOW | admin |

---

### Signup Control

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `REVEALUI_SIGNUP_OPEN` | No | `true` (dev), `false` (prod) | Allow open self-registration. Set to `false` to restrict signups to the whitelist. | LOW | admin |
| `REVEALUI_SIGNUP_WHITELIST` | No | None | Comma-separated list of emails or domains allowed to sign up. Only used when `REVEALUI_SIGNUP_OPEN=false`. Format: `alice@example.com,@example.com`. | LOW | admin |

---

### License

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `REVEALUI_LICENSE_KEY` | No | None | RevealUI Pro/Enterprise license key. Unlocks commercial features. Format: `rui_live_...`. | MEDIUM | admin, api |
| `REVEALUI_LICENSE_ENCRYPTION_KEY` | No | None | AES-256-GCM encryption key for license keys at rest. 32-byte hex (64 chars). Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. | HIGH (server-only) | api |
| `LICENSE_CACHE_TTL_MS` | No | `15000` | License cache TTL in milliseconds. Lower values detect revocations faster; higher values reduce DB pressure. | LOW | api |

---

### Encryption

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `REVEALUI_KEK` | No | None | Key Encryption Key for field-level encryption. Must be exactly 64 hex characters (32 bytes / 256 bits). Validated with regex `^[0-9a-f]{64}$`. | HIGH (server-only) | admin, api |

---

### CORS and Security

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `REVEALUI_CORS_ORIGINS` | No | None | Comma-separated list of allowed CORS origins for the admin app. Example: `https://app.example.com,https://staging.example.com`. | LOW | admin |
| `CORS_ORIGIN` | No | None | Comma-separated allowed origins for the API. Required in production if the API is accessed cross-origin. | LOW | api |
| `REVEALUI_WHITELISTORIGINS` | No | None | **Deprecated**. Use `REVEALUI_CORS_ORIGINS` instead. A warning is logged if this is set without `REVEALUI_CORS_ORIGINS`. | LOW | admin |

---

### x402 Native Payments

Phase 5.2. Enables per-task USDC micropayments when agent task quota is exceeded.

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `X402_ENABLED` | No | `false` | Set to `true` to enable x402 payment path on quota exhaustion. | LOW | api |
| `X402_RECEIVING_ADDRESS` | When x402 enabled | None | Your USDC wallet address on Base that receives micropayments. | MEDIUM | api |
| `X402_NETWORK` | No | `evm:base` | Base network: `evm:base` (mainnet) or `evm:base-sepolia` (testnet). | LOW | api |
| `X402_PRICE_PER_TASK` | No | `0.001` | USDC price per agent task (human-readable, e.g., `0.001` = $0.001). | LOW | api |
| `X402_FACILITATOR_URL` | No | `https://x402.org/facilitator` | Coinbase x402 facilitator URL. | LOW | api |

---

### Perpetual License Provisioning

Phase 5.3 Track C. Required for perpetual license GitHub team provisioning and support renewal cron.

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `REVEALUI_GITHUB_TOKEN` | No | None | Fine-grained GitHub PAT with `org:write:members` scope. Adds perpetual license buyers to the GitHub team. | HIGH (server-only) | api |
| `REVEALUI_CRON_SECRET` | No | None | Shared secret for authenticating POST to `/api/billing/support-renewal-check`. Must be 32+ characters. Generate with `openssl rand -hex 32`. | HIGH (server-only) | api |

---

### Forge Self-Hosted

Phase 5.4, enterprise tier. Only required when running RevealUI Forge on your own infrastructure.

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `FORGE_LICENSE_KEY` | For Forge | None | Enterprise license key issued at checkout. | HIGH (server-only) | forge |
| `FORGE_LICENSED_DOMAIN` | For Forge | None | Domain this Forge instance is licensed to serve (e.g., `admin.acme.com`). Requests from other hosts receive HTTP 403. | MEDIUM | forge |

---

### MCP Marketplace

Phase 5.5. Required only when operating the RevealUI MCP marketplace.

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `MARKETPLACE_CONNECT_RETURN_URL` | No | `ADMIN_URL/account/marketplace/connect/return` | Redirect URL after Stripe Connect onboarding completes. | LOW | admin |

---

### MCP Servers

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `MCP_PERSISTENCE_DRIVER` | No | `pglite` | MCP data persistence driver. Options: `pglite`, `postgres`. | LOW | mcp |
| `MCP_METRICS_MODE` | No | `logs` | MCP metrics output mode. Options: `logs`, `prometheus`, `otel`. | LOW | mcp |
| `MCP_API_KEY` | No | None | Authentication key for MCP server integrations. | HIGH (server-only) | mcp |
| `PGVECTOR_ENABLED` | No | `false` | Enable pgvector in MCP for vector search. | LOW | mcp |

---

### Error Monitoring (Sentry)

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | No | None | Sentry DSN for error tracking. Recommended for staging and production. | LOW (client-safe) | admin |
| `SENTRY_AUTH_TOKEN` | No | None | Sentry auth token for source map uploads in CI/CD. | HIGH (server-only) | CI |
| `SENTRY_ORG` | No | None | Sentry organization slug. | LOW | CI |
| `SENTRY_PROJECT` | No | None | Sentry project slug. | LOW | CI |
| `REVEALUI_ERROR_TOKEN` | No | None | Token for internal error reporting endpoint. | HIGH (server-only) | api |
| `REVEALUI_LOG_TOKEN` | No | None | Token for internal logging endpoint. | HIGH (server-only) | api |

---

### Feature Flags and Dev Tools

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `SKIP_ENV_VALIDATION` | No | `false` | Skip env validation during builds. Only valid when `NEXT_PHASE` is set or `NODE_ENV=test`. Using it at runtime throws a security error. | LOW | build |
| `SKIP_ONINIT` | No | `false` | Skip onInit hook. Testing only. | LOW | test |
| `STRIPE_PROXY` | No | `0` | Enable Stripe proxy logging in development. Set to `1`. | LOW | admin |
| `NEON_API_KEY` | No | None | Neon API key for MCP server and database management tools. | HIGH (server-only) | mcp |
| `API_PORT` | No | `3004` | Port for the Hono API server. | LOW | api |
| `PLAYWRIGHT_BASE_URL` | No | `http://localhost:4000` | Base URL for Playwright E2E tests. | LOW | test |
| `VERCEL_API_KEY` | No | None | Vercel API key for deployment automation. | HIGH (server-only) | CI |

---

### App-Specific

| Variable | Required | Default | Description | Security | Used By |
|----------|----------|---------|-------------|----------|---------|
| `NEXT_PUBLIC_ADMIN_URL` | No | `http://localhost:4000` | Admin dashboard URL for client-side navigation. | LOW (client-safe) | marketing |
| `VITE_ADMIN_URL` | No | `http://localhost:4000` | Admin URL for Vite-based apps (docs). | LOW (client-safe) | docs |
| `VITE_REVEALUI_PUBLIC_SERVER_URL` | No | `http://localhost:4000` | Public server URL for Vite-based apps. | LOW (client-safe) | docs |
| `ADMIN_ADMIN_EMAIL` | No | None | E2E test credentials for Playwright. | LOW | test |
| `ADMIN_ADMIN_PASSWORD` | No | None | E2E test credentials for Playwright. | HIGH (server-only) | test |
| `ADMIN_NAME` | No | None | Display name for the initial admin user. | LOW | admin |

---

## Environment-Specific Configuration

The `@revealui/config` package applies additional validation rules depending on `NODE_ENV`.

### Development

```env
NODE_ENV=development
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Validation enforces:
- Stripe keys must use `sk_test_` / `pk_test_` prefixes.
- HTTP URLs are allowed.

### Test

```env
NODE_ENV=test
REVEALUI_SECRET=test-secret-that-is-at-least-32-characters-long-for-testing-purposes
REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000
NEXT_PUBLIC_SERVER_URL=http://localhost:4000
POSTGRES_URL=postgresql://test:test@localhost:5432/test_revealui
DATABASE_URL=postgresql://test:test@localhost:5432/test_revealui
BLOB_READ_WRITE_TOKEN=test-blob-token
STRIPE_SECRET_KEY=sk_test_your_test_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_test_secret_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key_here
```

These values are committed in `.env.test` (safe placeholder credentials, no real services). For tests that hit live services, use `.env.test.local` (gitignored).

### Staging (Vercel Preview)

```env
NODE_ENV=production
REVEALUI_PUBLIC_SERVER_URL=https://staging.yourdomain.com
NEXT_PUBLIC_SERVER_URL=https://staging.yourdomain.com
STRIPE_SECRET_KEY=sk_test_...   # Still test keys in staging
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Note: Staging runs with `NODE_ENV=production` to match production behavior. Use Stripe test keys to avoid real charges.

### Production

```env
NODE_ENV=production
REVEALUI_PUBLIC_SERVER_URL=https://admin.yourdomain.com
NEXT_PUBLIC_SERVER_URL=https://admin.yourdomain.com
SESSION_COOKIE_DOMAIN=.yourdomain.com
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Validation enforces:
- `REVEALUI_PUBLIC_SERVER_URL` and `NEXT_PUBLIC_SERVER_URL` must use HTTPS.
- Stripe keys must use `sk_live_` / `pk_live_` prefixes.
- `SESSION_COOKIE_DOMAIN` should be set for cross-subdomain auth.

---

## Env File Loading Order

The `@revealui/config` loader (`packages/config/src/loader.ts`) determines which files to read based on `NODE_ENV`.

### Development (`NODE_ENV=development` or unset)

Files are tried in this order. The first file found is loaded; the rest are skipped:

1. `.env.development.local` (recommended: put your secrets here)
2. `.env.local`
3. `.env`

### Test (`NODE_ENV=test`)

1. `.env.test.local` (gitignored, for live-service tests)
2. `.env.test` (committed, safe placeholder values)

### Production (`NODE_ENV=production`)

No files are loaded. All variables must come from `process.env` (injected by Vercel, Docker, or your hosting platform).

### Precedence

`process.env` always wins over file-loaded values. This means environment variables set in your shell, CI, or hosting platform override anything in `.env` files.

### Project Root Detection

The loader finds the monorepo root by walking up from its own directory, looking for `.env.template` as a marker file. This works correctly even when commands are run from an app subdirectory.

---

## Secret Management (RevVault)

RevVault is the RevealUI Studio secret manager. It centralizes credentials and exports them as environment variables.

### Exporting Secrets to Your Shell

```bash
# Export all secrets for the current project
revvault export-env

# Export and immediately source into your shell
eval "$(revvault export-env)"
```

### Integration with direnv

The monorepo includes an `.envrc` file for automatic env loading via direnv:

```bash
# .envrc (committed)
dotenv_if_exists .env.development.local
```

If you use RevVault with direnv, add a `revvault export-env` call to your `.envrc`:

```bash
# .envrc
eval "$(revvault export-env)"
dotenv_if_exists .env.development.local
```

### Secret Rotation

Rotate these secrets every 90 days:

| Secret | Rotation Steps |
|--------|---------------|
| `REVEALUI_SECRET` | Generate new value, update `.env.development.local`, update Vercel, redeploy. Active sessions will be invalidated. |
| `STRIPE_WEBHOOK_SECRET` | Create new webhook endpoint in Stripe Dashboard, update the secret, delete the old endpoint. |
| `REVEALUI_KEK` | Re-encrypt all field-level encrypted data before rotating. Coordinate with a maintenance window. |
| `SENTRY_AUTH_TOKEN` | Regenerate in Sentry Dashboard, update CI secrets. |

### Security Classification

| Level | Meaning | Examples |
|-------|---------|---------|
| HIGH | Server-only. Never expose to client bundles. Never commit to git. | `REVEALUI_SECRET`, `STRIPE_SECRET_KEY`, `POSTGRES_URL` |
| MEDIUM | Keep out of client bundles but less catastrophic if leaked. | `REVEALUI_LICENSE_KEY`, `SESSION_COOKIE_DOMAIN` |
| LOW | Safe for client-side. May be bundled into browser JS. | `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |

---

## Vercel Environment Configuration

### Setting Variables in Vercel Dashboard

1. Go to your project in Vercel Dashboard.
2. Navigate to Settings, then Environment Variables.
3. For each variable, select which environments it applies to:
   - **Production**: Live site values (HTTPS URLs, live Stripe keys).
   - **Preview**: Staging/PR preview values (can use test Stripe keys).
   - **Development**: Values pulled by `vercel env pull` for local dev (optional).

### Pulling Variables Locally

```bash
# Pull Vercel env vars into .env.local
vercel env pull .env.local
```

### Variables Vercel Sets Automatically

Vercel injects several variables automatically. Do not set these manually:

- `VERCEL` (always `"1"` on Vercel)
- `VERCEL_ENV` (`production`, `preview`, or `development`)
- `VERCEL_URL` (deployment URL without protocol)
- `VERCEL_BRANCH_URL` (branch-specific URL)
- `VERCEL_PROJECT_PRODUCTION_URL` (production domain)

### NEXT_PUBLIC_ Variables on Vercel

Variables prefixed with `NEXT_PUBLIC_` are inlined at build time. If you change a `NEXT_PUBLIC_` variable, you must redeploy for the change to take effect. Runtime changes to these variables have no effect on already-built bundles.

### Sensitive Variables

Mark sensitive variables (database URLs, API keys) as "Sensitive" in the Vercel dashboard. This hides the value in the UI and logs after creation.

---

## Adding New Environment Variables

Follow this process when adding a new env var to the codebase.

### Step 1: Add to `.env.template`

Add the variable with a placeholder value and documentation comment:

```env
# Purpose of the variable
# Format: describe expected format
# Security: HIGH/MEDIUM/LOW
# Optional - only needed when [condition]
NEW_VARIABLE_NAME=placeholder_value
```

### Step 2: Add to the Zod Schema

Update `packages/config/src/schema.ts`. Add to `requiredSchema` or `optionalSchema`:

```typescript
// In optionalSchema (most new vars are optional)
NEW_VARIABLE_NAME: z.string().min(1, 'Description of validation').optional(),
```

### Step 3: Add to the Config Module

If the variable belongs to an existing config group, add it to the appropriate module in `packages/config/src/modules/`. If it's a new category, create a new module file and register it in `packages/config/src/index.ts`.

### Step 4: Add to `.env.test`

If tests need this variable, add a safe placeholder value to `.env.test`:

```env
NEW_VARIABLE_NAME=test-placeholder-value
```

### Step 5: Add Build-Time Fallback (if required)

If the variable is required and used in Next.js builds, add a build-time fallback in `createConfig()` in `packages/config/src/index.ts`:

```typescript
const partialEnv = {
  // ... existing fallbacks
  NEW_VARIABLE_NAME: envVars.NEW_VARIABLE_NAME || 'build-placeholder',
  ...envVars,
} as EnvConfig;
```

### Step 6: Update This Guide

Add the variable to the appropriate table in this document.

### Step 7: Set in Vercel

Add the variable in the Vercel Dashboard for all applicable environments.

### Checklist

- [ ] Added to `.env.template` with documentation comment
- [ ] Added to Zod schema in `packages/config/src/schema.ts`
- [ ] Added to config module in `packages/config/src/modules/`
- [ ] Added test placeholder to `.env.test` (if needed)
- [ ] Added build-time fallback in `index.ts` (if required variable)
- [ ] Updated this guide
- [ ] Set in Vercel Dashboard for production, preview, and development

---

## Troubleshooting

### "ConfigValidationError: REVEALUI_SECRET is required but not set"

You are missing required environment variables. Copy the template and fill in values:

```bash
cp .env.template .env.development.local
# Edit .env.development.local with your actual values
```

### "Secret must be at least 32 characters"

Your `REVEALUI_SECRET` is too short. Generate a proper secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### "Must be a PostgreSQL connection string"

`POSTGRES_URL` must start with `postgresql://` or `postgres://`. Verify your connection string format:

```
postgresql://user:password@host:5432/database?sslmode=require
```

Common mistakes:
- Missing `?sslmode=require` (required for NeonDB and Supabase).
- Using `mysql://` or other protocols.
- Copying the string with trailing whitespace.

### "REVEALUI_PUBLIC_SERVER_URL must use HTTPS in production"

In production (`NODE_ENV=production`), server URLs must use HTTPS. Update your Vercel environment variables to use `https://` URLs.

### "STRIPE_SECRET_KEY must be a live key in production"

The validator detected a test key (`sk_test_`) in a production environment. Switch to your live Stripe key (`sk_live_`).

### "REVEALUI_PUBLIC_SERVER_URL and NEXT_PUBLIC_SERVER_URL should match"

These two variables must have the same value. They serve the same purpose for different frameworks (RevealUI core vs Next.js).

### "SKIP_ENV_VALIDATION=true is only valid during Next.js build phases"

You set `SKIP_ENV_VALIDATION=true` outside a build or test context. This is a security violation because build-time fallback secrets would be used at runtime. Remove `SKIP_ENV_VALIDATION` from your production environment.

### Database Connection Fails

1. Verify `POSTGRES_URL` is correct and includes `?sslmode=require`.
2. Check that the database host is reachable from your network.
3. For NeonDB: verify the project is not suspended (free tier auto-suspends after inactivity).
4. For Supabase: verify you are using the pooler connection string (port 6543), not the direct connection.

### Media Uploads Fail

1. Verify `BLOB_READ_WRITE_TOKEN` is set and the token has Read and Write permissions.
2. Check that the token is not expired in the Vercel Dashboard.
3. For local development without Vercel Blob, you can skip upload features. They degrade gracefully.

### Stripe Webhooks Fail Signature Verification

For local development:
```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```
Copy the `whsec_...` secret printed by the CLI into your `.env.development.local`.

For production:
1. Verify the webhook endpoint URL in the Stripe Dashboard matches your deployment URL.
2. Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret shown in the Stripe Dashboard for that endpoint.
3. If using separate live/test webhook endpoints, check `STRIPE_WEBHOOK_SECRET_LIVE`.

### OAuth Login Redirects to Wrong URL

Set `NEXT_PUBLIC_APP_URL` to match your deployment URL. It defaults to `NEXT_PUBLIC_SERVER_URL`, but if your app URL differs from your server URL, set it explicitly.

### Variables Changed but App Uses Old Values

`NEXT_PUBLIC_` variables are inlined at build time. After changing them in Vercel, you must trigger a new deployment. Runtime environment changes do not affect already-built client bundles.

### Env File Not Loading

Check the file loading order:
1. Verify your file is named correctly (`.env.development.local`, not `.env.dev.local`).
2. Verify you are running from the monorepo root or an app subdirectory (the loader walks up to find `.env.template` as a root marker).
3. Remember that `process.env` always overrides file values. If a variable is set in your shell, the file value is ignored.

---

## Related Documentation

- [Quick Start](./QUICK_START.md): 5-minute setup guide
- [CI/CD Guide](./CI_CD_GUIDE.md): Deployment with environment variables
- [Database Guide](./DATABASE.md): Database setup and management
- [Auth Guide](./AUTH.md): Authentication system
- [Troubleshooting](./TROUBLESHOOTING.md): General troubleshooting
- [Forge Guide](./FORGE.md): Self-hosted Forge configuration
- [Pro Guide](./PRO.md): Pro tier features and configuration
- [`@revealui/config` source](../packages/config/src/): Zod schemas and validation logic
