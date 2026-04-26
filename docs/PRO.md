---
title: "Pro Guide"
description: "RevealUI Pro tier  -  AI agents, MCP servers, editor integrations, and licensing"
category: guide
audience: developer
---

# RevealUI Pro Guide

Commercial guide to RevealUI Pro: packaging, MCP integrations, open-model inference, editors, harnesses, services, x402 payments, marketplace flows, and licensing.

Commercially, RevealUI Pro should not be treated as a simple seat upgrade layered on top of the OSS stack. The intended model is account-level platform access, metered agent execution, explicit commerce fees where RevealUI is in the transaction path, and premium trust or governance controls for approval, audit, and compliance needs.

Per-user or perpetual licenses can still exist for narrowly scoped products, but the primary hosted entitlement model should be account-level.

---

## Table of Contents

- [Overview](#overview)
- [Commercial Model](#commercial-model)
- [What Pro Includes](#what-pro-includes)
- [Licensing (Fair Source + MIT)](#licensing-fair-source--mit)
- [MCP Setup](#mcp-setup)
- [MCP Servers](#mcp-servers)
- [Getting API Keys](#getting-api-keys)
- [Next.js DevTools MCP](#nextjs-devtools-mcp)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)
- [Open-Model Inference](#open-model-inference)
- [Editors](#revealuieditors)
- [Harnesses](#revealuiharnesses)
- [Services](#revealuiservices)
- [x402 Micropayments](#x402-micropayments)
- [Perpetual Licenses](#perpetual-licenses)
- [MCP Marketplace](#mcp-marketplace)
- [Forge](#forge-enterprise-perpetual)
- [Related Documentation](#related-documentation)

---

## Overview

RevealUI Pro is the commercial layer for teams building agentic products, paid APIs, and operational tooling on top of RevealUI.

This guide covers the full Pro surface area, not just MCP setup:

- account-level commercial packaging
- MCP servers and developer tooling
- Open-model inference (Ollama shipped; Ubuntu Inference Snaps on roadmap)
- editor and harness workflows
- Stripe, Supabase, and x402 payment features
- marketplace monetization
- perpetual and Forge licensing

## Commercial Model

The target RevealUI Pro pricing model is:

- **Platform subscription** for workspace or account access
- **Metered agent execution** for workflows, tool calls, and other digital labor
- **Commerce fees** for paid API, marketplace, and agent-initiated transaction flows
- **Trust and governance controls** for approvals, audit, policy, and compliance

This is the model the product and billing architecture should converge on from 2026 onward.

## What Pro Includes

RevealUI Pro is the commercial layer that runs *inside* the RevealUI runtime — Pro packages, Pro APIs, Pro feature gates. It also unlocks features in *companion products* across the RevealUI Studio Suite.

**In the RevealUI runtime (this monorepo):**

- Pro packages (Fair Source / FSL-1.1-MIT): `@revealui/ai`, `@revealui/harnesses`
- MCP servers and developer tooling
- Open-model inference configuration per deployment
- Stripe and Supabase service integrations
- x402 micropayments and paid API support
- Marketplace and self-hosted commercial deployment options

**Unlocked in companion products (separate repos in the [RevealUI Studio Suite](https://github.com/RevealUIStudio)):**

- **Studio** desktop app (lives in [RevDev](https://github.com/RevealUIStudio/revdev), Tauri) — agent coordination hub, local inference management, visual agent dashboard. Studio talks to your RevealUI runtime; the Pro tier unlocks Studio's commercial features.
- **RevVault** desktop app (lives in [RevVault](https://github.com/RevealUIStudio/revvault), Tauri) — age-encrypted secret management
- **RevVault rotation engine** — automated credential lifecycle

## Ecosystem Features by Tier

RevealUI is part of a four-project ecosystem. Each project has features distributed across tiers:

| Feature | Free | Pro | Max | Forge |
|---------|------|-----|-----|-------|
| Studio desktop app | | Yes | Yes | Yes |
| Studio agent dashboard | | Yes | Yes | Yes |
| RevVault CLI + core crate | Yes | Yes | Yes | Yes |
| RevVault desktop app | | Yes | Yes | Yes |
| RevVault rotation engine | | Yes | Yes | Yes |
| RevKit agent coordination protocol | Yes | Yes | Yes | Yes |
| RevKit environment provisioning | | | Yes | Yes |
| RevealCoin x402 agent payments | | | | Yes |

The MIT-licensed components (RevVault CLI, RevKit agent coordination) are free forever. Commercial features (desktop app, rotation engine, provisioning, x402 payments) require the corresponding tier.

## Licensing (Fair Source + MIT)

RevealUI publishes every package to npm from the same public repo. There are two source licenses in play:

- **OSS packages (MIT):** `@revealui/core`, `@revealui/auth`, `@revealui/db`, `@revealui/contracts`, `@revealui/security`, `@revealui/utils`, `@revealui/config`, `@revealui/cache`, `@revealui/resilience`, `@revealui/openapi`, `@revealui/sync`, `@revealui/mcp`, and the rest of the public infrastructure. Use them however you want — commercial products, forks, SaaS, whatever.
- **Pro packages (Fair Source, FSL-1.1-MIT):** `@revealui/ai` and `@revealui/harnesses`. Source-visible in the public repo, installable from npm like any other package, with one legal constraint: you can't build a product that competes directly with RevealUI on top of them. Two years after each release the license on that release automatically converts to plain MIT. FSL-1.1 is the same license used by Sentry, GitButler, and Keygen.

**What this means in practice:**

- You get full source access to the Pro packages for audit, security review, bug reports, and self-service debugging. No "black box" you have to trust.
- You can use the Pro packages commercially as long as your product isn't a substantially similar developer platform competing with RevealUI. Building a SaaS product on top of the AI primitives, agents, editors, harnesses, or MCP marketplace is fine. Publishing a competing "platform software sold at the account or workspace level" isn't.
- Every Pro release has a scheduled MIT-conversion date two years out. You can see the history in the package's changelog, and today's FSL source becomes tomorrow's MIT source.

The Pro tier gate isn't enforced by the license — it's enforced at runtime by license validation (`initializeLicense()`, 6-layer middleware, `checkAIFeatureGate()` at every Pro API entry point). The license JWTs are RS256-signed; the check can't be bypassed by forking the source. FSL is the legal backstop; runtime enforcement is the real protection.

For full decision context: [ADR-003: Fair Source Licensing](./architecture/ADR-003-fair-source-licensing.md). The root `LICENSE` file (MIT) and per-package `LICENSE` files inside `packages/ai/`, `packages/harnesses/`, and `packages/engines/` (FSL-1.1-MIT) describe the terms verbatim.

## MCP Setup

RevealUI ships **13 MCP servers** under `packages/mcp/src/servers/` for enhanced AI capabilities. Highlights:

- **Code Validator MCP** - Static analysis and code quality checks
- **Vercel MCP** - Deploy and manage Vercel projects
- **Stripe MCP** + **RevealUI Stripe MCP** - Payment processing and billing operations
- **NeonDB MCP** - Database operations and SQL queries (remote endpoint at `mcp.neon.tech`)
- **Supabase MCP** - Supabase project management and CRUD operations
- **Playwright MCP** - Browser automation and web scraping
- **Next.js DevTools MCP** - Next.js 16+ runtime diagnostics and automation
- **RevealUI Content MCP** - admin content collections via MCP
- **RevealUI Email MCP** + **RevealUI Memory MCP** - first-party platform servers
- **Vultr Test MCP** - inference provider test harness

The full list lives at [`packages/mcp/src/servers/`](https://github.com/RevealUIStudio/revealui/tree/main/packages/mcp/src/servers); exports use launcher functions (`launchStripeMcp`, `launchSupabaseMcp`, etc.).

All servers are **free**; most run locally as npm packages (NeonDB MCP is a remote endpoint).

---

**Prerequisites**: Complete [QUICK_START.md](./QUICK_START.md) first for basic setup.

## MCP-Specific Setup

### 1. Configure MCP Environment Variables

Add MCP server API keys to `.env.development.local`:

```env
# Vercel MCP
VERCEL_API_KEY=vercel_xxx...

# Stripe MCP (likely already configured from Quick Start)
STRIPE_SECRET_KEY=sk_test_xxx...

# NeonDB MCP
NEON_API_KEY=neon_xxx...

# Supabase MCP
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Next.js DevTools MCP
NEXT_TELEMETRY_DISABLED=0
```

See [Getting API Keys](#getting-api-keys) section below for instructions.

### 2. Start MCP Servers

```bash
pnpm setup:mcp
revealui dev up --include mcp
```

The supported local workflow is to validate credentials with `pnpm setup:mcp` and include MCP readiness checks in the standard RevealUI bootstrap with `revealui dev up --include mcp`.

---

## MCP Servers

### Vercel MCP (`vercel-mcp@0.0.7`)

**Capabilities:**

- Deploy projects
- Manage domains
- Configure environment variables
- View project analytics
- Manage teams and permissions

**Environment:** `VERCEL_API_KEY`

**Status:** ✅ Working

---

### Stripe MCP (`@stripe/mcp@0.1.4`)

**Capabilities:**

- `balance.read` - Retrieve balance information
- `coupons.create/read` - Manage coupons
- `customers.create/read` - Manage customers
- `invoices.create/read/update` - Invoice operations
- `paymentIntents.read` - Payment intent information
- `paymentLinks.create` - Create payment links
- `prices.create/read` - Price management
- `products.create/read` - Product management
- `refunds.create` - Process refunds
- `subscriptions.read/update` - Subscription management
- `documentation.read` - Search Stripe documentation

**Environment:** `STRIPE_SECRET_KEY`

**Status:** ✅ Working

---

### NeonDB MCP (remote: `mcp.neon.tech`)

**Capabilities:**

- Execute SQL queries
- Create tables
- Update rows
- Delete tables
- Manage database schema
- Interact with Neon Management API

**Environment:** `NEON_API_KEY`

**Status:** ⚠️ Requires API key setup

---

### Supabase MCP (`supabase-mcp@1.5.0`)

**Capabilities:**

- CRUD operations on tables
- Query data
- Manage database records
- Interact with Supabase projects

**Environment:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` (required), `SUPABASE_SERVICE_ROLE_KEY` (optional)

**Status:** ⚠️ Requires credentials setup

---

### Playwright MCP (`@executeautomation/playwright-mcp-server@1.0.12`)

**Capabilities:**

- Navigate to URLs
- Take screenshots
- Click elements
- Fill forms
- Extract text and data
- Run browser automation scripts
- Web scraping capabilities

**Environment:** None required

**Status:** ✅ Working (downloads browser binaries on first run ~300MB)

---

### Next.js DevTools MCP (`next-devtools-mcp@0.3.9`)

**Capabilities:**

- Auto-discover Next.js 16+ dev servers
- Real-time error reporting
- Route discovery and metadata
- Development server logs
- Server Action discovery
- Component tree analysis
- Build configuration inspection
- Automated Next.js 16 upgrades
- Cache Components setup with error fixing

**Environment:** `NEXT_TELEMETRY_DISABLED` (optional)

**Status:** ✅ Working (requires Next.js 16+)

---

## Getting API Keys

### Vercel API Key

1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Copy the token (starts with `vercel_`)
4. Add to `.env`: `VERCEL_API_KEY=vercel_xxx...`

### Stripe Secret Key

1. Go to https://dashboard.stripe.com/apikeys
2. Copy the "Secret key" (starts with `sk_test_` for test mode)
3. Add to `.env`: `STRIPE_SECRET_KEY=sk_test_xxx...`

### Neon API Key

1. Go to https://console.neon.tech/app/settings/api-keys
2. Click "Create API Key"
3. Copy the key (starts with `neon_`)
4. Add to `.env`: `NEON_API_KEY=neon_xxx...`

**Detailed guide**: See [NEON_API_KEY_SETUP.md](./ENVIRONMENT-VARIABLES-GUIDE.md)

### Supabase Credentials

**⚠️ Important: Supabase API Key Changes (2025)**

Supabase introduced new API keys in June 2025. Both legacy and new keys are supported:

**New API Keys (Recommended):**

- **Publishable Key** (`sb_publishable_...`) - Replaces anon key, safe to expose
- **Secret Key** (`sb_secret_...`) - Replaces service_role key, for backend use

**Legacy API Keys (Deprecated Nov 2025):**

- **anon key** (JWT format) - Still works but will be deprecated
- **service_role key** (JWT format) - Still works but will be deprecated

**Getting Your Keys:**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **For new keys:**
     - **Publishable key** (`sb_publishable_...`) → `SUPABASE_PUBLISHABLE_KEY`
     - **Secret key** (`sb_secret_...`) → `SUPABASE_SECRET_KEY`
   - **For legacy keys:**
     - **anon/public key** (JWT) → `SUPABASE_ANON_KEY`
     - **service_role key** (JWT) → `SUPABASE_SERVICE_ROLE_KEY`

**Migration Timeline:**

- **June 2025**: New keys available (early preview)
- **July 2025**: Full feature launch
- **November 2025**: Legacy keys deprecated for new projects

**Reference:** [Supabase API Key Changes Discussion](https://github.com/orgs/supabase/discussions/29260) | [Official Docs](https://supabase.com/docs/guides/api/api-keys)

**MCP_API_KEY (Optional but Recommended):**

The `MCP_API_KEY` is **NOT** a Supabase key - it's a key you generate yourself to secure the MCP server HTTP endpoint.

- **Auto-generated**: If not set, the script will auto-generate a secure random key (shown in console)
- **Recommended**: Copy the auto-generated key to your `.env` file to persist it across restarts
- **Manual generation**: Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate a 64-character hex string
- **Purpose**: Authenticates requests to the MCP server HTTP endpoint (prevents unauthorized access)

**Example:**

```env
MCP_API_KEY=5b32a7c681704fdef16dcfd018e86660bf2a79dc7f7551a987cb94bb0a72eda1
```

**Note**: The script will show you the auto-generated key when you first run it - just copy it to your `.env` file.

**IPv4/IPv6 Note**: See [SUPABASE_IPV4_EXPLANATION.md](./DATABASE.md) for network compatibility info.

---

## Next.js DevTools MCP

The Next.js DevTools MCP provides runtime diagnostics, automated upgrades, and intelligent error fixing for Next.js 16+ applications.

### Prerequisites

- Next.js 16.0.0 or higher
- Development server running
- MCP server configured in Cursor

### How It Works

**Important**: MCP servers in Cursor are **automatically managed**. You don't need to manually start them!

1. **Cursor reads** `.cursor/mcp-config.json` at startup
2. **Cursor starts** MCP servers automatically when needed
3. **You use them** through Cursor's AI chat - no manual commands needed

### Integration with Your admin App

Your admin app (`apps/admin`) is perfectly configured for Next.js DevTools MCP:

```json
{
  "next": "16.1.1", // Next.js 16+ required
  "dev": "next dev --turbo --port 4000" // Standard port
}
```

### MCP Endpoint

Next.js 16 automatically exposes an MCP endpoint:

- **URL:** `http://localhost:4000/_next/mcp`
- **Available when:** Dev server is running
- **Authentication:** None (localhost only)

### Integration Flow

```
Cursor AI
    ↓
Next.js DevTools MCP Server (mcp-next-devtools.ts)
    ↓
nextjs_index / nextjs_call tools
    ↓
HTTP Request to http://localhost:4000/_next/mcp
    ↓
Next.js 16 Dev Server (built-in MCP endpoint)
    ↓
Returns: Errors, Routes, Logs, etc.
    ↓
MCP Server formats response
    ↓
Cursor displays results
```

### Available Tools (via MCP)

When your dev server is running, you can use these tools:

1. **get_errors** - Real-time error reporting
2. **get_routes** - Route discovery and metadata
3. **get_logs** - Development server logs
4. **get_server_actions** - Server Action discovery
5. **get_component_tree** - Component hierarchy
6. **get_build_info** - Build configuration and status

### Features

#### 1. Auto-Discovery

Automatically scans common ports (3000, 3001, 4000, 5000, etc.) for running Next.js 16+ dev servers.

**Ask in Cursor:**

```
Next Devtools, what servers are running?
```

**Returns:**

- Server port, PID, URL, version
- Available diagnostic tools
- Framework metadata (Turbopack, App Directory, etc.)

**Key Point:** Zero configuration - it automatically finds your admin app!

#### 2. Runtime Diagnostics

**Query Build/Runtime Errors:**

```
Next Devtools, what errors are in my Next.js app?
```

Returns real-time error information including:

- TypeScript errors
- Module resolution errors
- Runtime warnings
- Error location (file, line, column)
- Error category and severity

**View Application Routes:**

```
Next Devtools, show me my application routes
```

Returns complete route structure:

- All pages, API routes, and dynamic segments
- Route metadata and configurations
- Layout information
- Catch-all routes

**Check Dev Server Logs:**

```
Next Devtools, what's in the dev server logs?
```

Returns recent development server output:

- Build messages
- Hot reload events
- Compilation warnings
- Error messages with timestamps

#### 3. Upgrade Automation

**Upgrade to Next.js 16:**

```
Next Devtools, help me upgrade to Next.js 16
```

Automated upgrade process:

- Checks current Next.js version
- Runs official Next.js codemod automatically
- Updates async APIs (params, searchParams, cookies, headers)
- Migrates configuration changes
- Fixes deprecated features
- Provides step-by-step guidance

#### 4. Cache Components Setup

**Enable Cache Components:**

```
Next Devtools, enable Cache Components in my Next.js 16 app
```

Complete automated setup:

- Pre-flight compatibility checks
- Enables Cache Components configuration
- Starts dev server with MCP enabled
- Automated route verification
- Intelligent error detection and fixing:
  - Suspense boundary setup
  - Caching directive placement
  - Static params configuration
- Final verification and build testing

**Key Point:** Complete automation - detects issues, fixes them, verifies everything works!

---

## Configuration

### Cursor IDE

MCP servers are configured in `.cursor/mcp-config.json`:

```json
{
  "mcpServers": {
    "vercel": {
      "command": "pnpm",
      "args": ["mcp:vercel"],
      "env": {
        "VERCEL_API_KEY": "${VERCEL_API_KEY}"
      }
    },
    "stripe": {
      "command": "pnpm",
      "args": ["mcp:stripe"],
      "env": {
        "STRIPE_SECRET_KEY": "${STRIPE_SECRET_KEY}"
      }
    },
    "neon": {
      "command": "pnpm",
      "args": ["mcp:neon"],
      "env": {
        "NEON_API_KEY": "${NEON_API_KEY}"
      }
    },
    "supabase": {
      "command": "pnpm",
      "args": ["mcp:supabase"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_ANON_KEY": "${SUPABASE_ANON_KEY}"
      }
    },
    "playwright": {
      "command": "pnpm",
      "args": ["mcp:playwright"]
    },
    "next-devtools": {
      "command": "pnpm",
      "args": ["mcp:next-devtools"],
      "env": {
        "NEXT_TELEMETRY_DISABLED": "${NEXT_TELEMETRY_DISABLED:-0}"
      }
    }
  }
}
```

**Note:** Restart Cursor after configuration changes.

To enable automatic restart in the Cursor-managed process, add `"--", "--restart"` to the args:

```json
"stripe": {
  "command": "pnpm",
  "args": ["mcp:stripe", "--", "--restart"],
  "env": { "STRIPE_SECRET_KEY": "${STRIPE_SECRET_KEY}" }
}
```

Restart applies to Stripe, Neon, Supabase, and Vercel launchers. Playwright and Next.js DevTools do not support `--restart` (managed by their own upstream packages).

---

## Usage Examples

### Example 1: Debug Build Errors

```
You: "Next Devtools, what errors are in my Next.js app?"

MCP: Discovers server → Calls get_errors → Returns errors

You: "Show me the error in populateArchiveBlock.ts"

MCP: Provides detailed error info with file location
```

### Example 2: Understand Application Structure

```
You: "Next Devtools, show me my application routes"

MCP: Discovers server → Calls get_routes → Returns route list

You: "What pages use dynamic segments?"

MCP: Filters routes and shows dynamic segment usage
```

### Example 3: Enable Cache Components

```
You: "Next Devtools, enable Cache Components"

MCP: Runs enable_cache_components tool:
  1. Checks compatibility
  2. Updates config
  3. Runs dev server
  4. Detects errors
  5. Auto-fixes issues
  6. Verifies success
```

### Example 4: Using Next.js DevTools MCP

To use the Next.js DevTools MCP effectively:

**Step 1: Start Your admin Dev Server**

```bash
cd apps/admin
pnpm dev
```

**Step 2: Start Next.js DevTools MCP Server (Optional)**

```bash
# In another terminal
pnpm setup:mcp
revealui dev up --include mcp
```

**Note:** Cursor manages MCP servers automatically, so manual startup is only for testing.

**Step 3: Try These Commands in Cursor**

**Auto-Discovery:**

```
Next Devtools, what servers are running?
```

Shows all Next.js 16+ dev servers with their ports, tools, and metadata.

**Runtime Diagnostics - Errors:**

```
Next Devtools, what errors are in my Next.js app?
```

Shows real-time build and runtime errors from your admin app.

**Runtime Diagnostics - Routes:**

```
Next Devtools, show me my application routes
```

Shows all routes, pages, API endpoints, and dynamic segments.

**Runtime Diagnostics - Logs:**

```
Next Devtools, what's in the dev server logs?
```

Shows recent development server output and messages.

**Upgrade Automation:**

```
Next Devtools, help me upgrade to Next.js 16
```

Automated upgrade with codemods (confirms if already on 16.1.1).

**Cache Components Setup:**

```
Next Devtools, enable Cache Components in my Next.js 16 app
```

Complete automated setup with error detection and fixing.

---

## Troubleshooting

### MCP Server Exits Unexpectedly

**Solution:** Re-validate MCP setup and bootstrap through the RevealUI CLI:

```bash
pnpm setup:mcp
revealui dev up --include mcp
```

---

### "Missing API key" Error

**Solution:** Ensure your `.env` file has the required environment variables:

- Check file location: `<your-project-root>/.env`
- Verify variable names match exactly (case-sensitive)
- Restart the MCP server after adding variables

### "Connection refused" Error

**Solution:**

- Ensure MCP credentials are configured: `pnpm setup:mcp`
- Bootstrap the local environment with MCP checks: `revealui dev up --include mcp`
- Check if port conflicts exist
- Verify Cursor has restarted after configuration

### "Command not found" Error

**Solution:**

- Run `pnpm install` to install dependencies
- Verify scripts exist in `package.json`
- Check Node.js version (requires Node 18+)

### Vercel MCP Silent Failure

**Solution:**

- Verify `vercel-mcp` package is installed: `ls node_modules/vercel-mcp`
- Check API key format (should start with `vercel_`)
- Test manually: `node node_modules/vercel-mcp/build/index.js VERCEL_API_KEY=test`

### Playwright Download Issues

**Solution:**

- First run downloads ~300MB of browser binaries (be patient)
- Check internet connection
- Verify disk space available
- Run manually: `pnpm dlx @executeautomation/playwright-mcp-server`

### Next.js DevTools: MCP Server Can't Find Dev Server

**Problem:** `No server info found`

**Solutions:**

1. Ensure dev server is running: `cd apps/admin && pnpm dev`
2. Check port 4000 is accessible: `curl http://localhost:4000`
3. Verify Next.js version is 16+: Check `package.json`

### Next.js DevTools: MCP Endpoint Not Available

**Problem:** Cannot connect to `/_next/mcp`

**Solutions:**

1. Dev server must be running
2. Next.js must be 16.0.0 or higher
3. Check browser console for errors
4. Try: `curl http://localhost:4000/_next/mcp`

### Next.js DevTools: Tools Not Available

**Problem:** `nextjs_call` returns empty tools list

**Solutions:**

1. Restart dev server
2. Check Next.js version compatibility
3. Verify MCP endpoint is responding
4. Check dev server logs for errors

### Next.js DevTools: MCP Not Working in Cursor

**Solutions:**

1. **Restart Cursor** - MCP servers load at startup
2. **Check config file exists**: `.cursor/mcp-config.json`
3. **Verify package installed**: `pnpm list next-devtools-mcp`

### Next.js DevTools: Server Won't Start Manually

If you want to test manually:

```bash
# Validate MCP setup first
pnpm setup:mcp
revealui dev up --include mcp
```

---

## Testing

### Test Individual Servers

```bash
# Validate the supported MCP bootstrap path
pnpm setup:mcp
revealui dev up --include mcp --dry-run
```

### Verify All Servers Start

```bash
# Validate credentials and preview the RevealUI bootstrap plan
pnpm setup:mcp
revealui dev status --profile agent
```

### Next.js DevTools Verification

Use this checklist to verify everything is working:

- [ ] admin dev server running (`cd apps/admin && pnpm dev`)
- [ ] MCP credentials validated (`pnpm setup:mcp`)
- [ ] MCP endpoint accessible (`curl http://localhost:4000/_next/mcp`)
- [ ] Can discover servers (ask: "what servers are running?")
- [ ] Can query errors (ask: "what errors are in my app?")
- [ ] Can view routes (ask: "show me my routes")

---

## Project Conventions

### Script Execution

All MCP scripts use:

- ✅ `pnpm dlx` instead of `npx` (project requirement)
- ✅ `tsx` for TypeScript execution
- ✅ `dotenv` for environment variable loading
- ✅ Proper error handling and signal management

### File Locations

- **Scripts**: `scripts/mcp-*.ts`
- **Config**: `.cursor/mcp-config.json`
- **Environment**: `.env` (project root)
- **Documentation**: `docs/mcp/MCP.md`

---

## Cost

All MCP servers are **completely free**:

- ✅ No subscription fees
- ✅ No usage-based pricing
- ✅ Only your existing service API usage costs apply
- ⚠️ Playwright downloads browser binaries (~300MB) on first run

---

## Current Status

| Server           | Status               | Package                                           | Env Required                        |
| ---------------- | -------------------- | ------------------------------------------------- | ----------------------------------- |
| Vercel           | ✅ Working           | `vercel-mcp@0.0.7`                                | `VERCEL_API_KEY`                    |
| Stripe           | ✅ Working           | `@stripe/mcp@0.1.4`                               | `STRIPE_SECRET_KEY`                 |
| NeonDB           | ⚠️ Needs API Key     | Remote: `mcp.neon.tech`                            | `NEON_API_KEY`                      |
| Supabase         | ⚠️ Needs Credentials | `supabase-mcp@1.5.0`                              | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| Playwright       | ✅ Working           | `@executeautomation/playwright-mcp-server@1.0.12` | None                                |
| Next.js DevTools | ✅ Working           | `next-devtools-mcp@0.3.9`                         | None (requires Next.js 16+)         |

---

## Related Documentation

- [Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md) - Configuration
- [Database](./DATABASE.md) - Database setup and network compatibility
- [Master Index](./INDEX.md) - Complete documentation index

---

## External Resources

- [Next.js DevTools MCP GitHub](https://github.com/vercel/next-devtools-mcp)
- [Next.js 16 MCP Documentation](https://nextjs.org/docs)
- [Model Context Protocol Spec](https://modelcontextprotocol.io)
- [Supabase API Key Changes Discussion](https://github.com/orgs/supabase/discussions/29260)

---

**Maintained by:** RevealUI Team

---

# Open-Model Inference

RevealUI AI runs exclusively on open source models. No proprietary cloud APIs, no vendor lock-in, no API bills.

## Inference Paths

### Shipped

| Path | Runtime | Notes |
|------|---------|-------|
| **Ollama** | Local GGUF models | Any open source GGUF model. Default: `gemma4:e2b` |
| **HuggingFace** | HuggingFace Inference API | Open models hosted on HuggingFace infrastructure |
| **Vultr** | Vultr GPU Cloud | Open models on Vultr serverless inference |

### Planned (roadmap)

| Path | Runtime | Current state | Tracking |
|------|---------|---------------|----------|
| **Ubuntu Inference Snaps** | Canonical snap runtime | CLI install works today for Gemma3, DeepSeek-R1, Qwen-VL, Nemotron-Nano (`sudo snap install <model>`). Setting `INFERENCE_SNAPS_BASE_URL` wires an already-running snap service to the LLM client. Studio lifecycle management (start / stop / health / model discovery) is **not shipped**. | Integration issue to be filed; see MASTER_PLAN §CR-9 P1-04 |

## Server-side usage

```typescript
import { createLLMClientFromEnv } from "@revealui/ai/llm/client";

// Auto-detects from environment in precedence order:
//   INFERENCE_SNAPS_BASE_URL (if set — planned path, manual wiring)
//   OLLAMA_BASE_URL (default local runtime)
//   HUGGINGFACE_API_KEY / VULTR_API_KEY (hosted fallbacks)
const llm = createLLMClientFromEnv();

const response = await llm.chat([{ role: "user", content: "Hello!" }]);
```

## Environment configuration

```bash
# Ubuntu inference snap — planned path; requires manual snap install + service
# (see Planned roadmap table above). Studio UI lifecycle not shipped.
INFERENCE_SNAPS_BASE_URL=http://localhost:8080/v1

# Ollama (any open source model)
OLLAMA_BASE_URL=http://localhost:11434/v1

# HuggingFace Inference API (open models)
HUGGINGFACE_API_KEY=hf_xxxxx

# Vultr GPU Cloud (open models, serverless inference)
VULTR_API_KEY=VXUUC6WSXXXXXXXXXXXXXXXXXXXXXXXXXX
VULTR_BASE_URL=https://api.vultrinference.com/v1

# Force specific inference path (overrides auto-detection)
# Valid values: ollama, huggingface, vultr, inference-snaps (planned)
LLM_PROVIDER=ollama
```

## Security notes

- Keys are never stored in plaintext
- Master key rotation re-encrypts all user data keys
- Keys are never returned in full via the API
- Rate limiting applies to key verification endpoints
- Admin-level access cannot read user keys  -  only re-wrap them during rotation

## Per-user provider keys

For multi-tenant deployments, individual users can register their own keys for the
**open-model** provider endpoints supported by RevealUI — Vultr, HuggingFace, Groq,
Ollama, and Ubuntu Inference Snaps. Proprietary "bring-your-own-key" paths
(Anthropic, OpenAI, etc.) were removed on 2026-04-05 in the open-model-only pivot;
`@revealui/ai` only ships providers for Apache-2.0 / Fair-Source open models.

The key is resolved from `tenant_provider_configs` → the user's encrypted
`user_api_keys` row, falling back to the server-default client if no user-level
key is configured:

```typescript
import { createLLMClientForUser } from "@revealui/ai/llm/client";

const llm = await createLLMClientForUser(userId, db);
```

User-level inference configuration takes precedence over server defaults.

---

# RevCon (editor config sync)

Editor configuration sync — recommended extensions, workspace settings, and AI rules for VS Code, Zed, Cursor, and Antigravity — lives in **RevCon**, a sibling repository published separately from this monorepo.

- Repo: [`RevealUIStudio/editor-configs`](https://github.com/RevealUIStudio/editor-configs)
- CLI: `revcon sync`, `revcon diff`, `revcon pull`, `revcon push`

RevCon is intentionally decoupled from the RevealUI runtime: editor profiles evolve on a different cadence than the CMS/API packages and are not gated by the Pro license. Install it standalone rather than adding it as a runtime dependency of your RevealUI app.

---

# @revealui/harnesses

AI harness adapters, workboard coordination, and JSON-RPC server. Integrates Claude Code and Cursor into the RevealUI development workflow.

## Overview

`@revealui/harnesses` connects AI coding tools to each other and to your project's shared workboard. Multiple AI sessions  -  across editors, terminals, and CI  -  register themselves and claim file ownership to prevent conflicts.

**Requires a Pro or Forge license.**

## Quick start

```typescript
import { HarnessCoordinator } from "@revealui/harnesses";

const coordinator = new HarnessCoordinator({
  projectRoot: "/path/to/your/project",
  socketPath: "/tmp/revealui-harness.sock",
  task: "Implement auth middleware",
});

await coordinator.start();
// ... your agent work ...
await coordinator.stop();
```

`start()` auto-detects installed harnesses, registers this session in `.claude/workboard.md`, and opens a JSON-RPC socket. `stop()` cleans up the session and closes the socket.

## Workboard

The workboard is a markdown file at `.claude/workboard.md` that tracks active sessions, claimed files, and recent events.

```typescript
import { WorkboardManager } from "@revealui/harnesses";

const wb = new WorkboardManager("/path/to/.claude/workboard.md");

// Read current state
const state = await wb.readAsync();

// Register a session
wb.registerSession({
  id: "zed-1",
  env: "Zed/ACP",
  started: new Date().toISOString().slice(0, 16) + "Z",
  task: "Add OAuth flow",
  files: "",
  updated: new Date().toISOString().slice(0, 16) + "Z",
});

// Claim file ownership (prevents conflicts with other sessions)
wb.claimFiles("zed-1", ["apps/admin/src/lib/auth.ts"]);

// Check for conflicts before editing
const result = wb.checkConflicts("zed-1", ["apps/admin/src/lib/auth.ts"]);
if (!result.clean) {
  console.warn("File conflict:", result.conflicts);
}

// Release claims when done
wb.releaseFiles("zed-1");

// Detect stale sessions (inactive > 4h)
const stale = wb.detectStale();
```

**Sync vs async:** `read()`/`write()` are sync (safe for CLI scripts); `readAsync()`/`writeAsync()` use `fs/promises` (preferred in server contexts).

## JSON-RPC server

`RpcServer` exposes harness operations over a Unix domain socket. The socket protocol is JSON-RPC 2.0 with newline-delimited messages.

```typescript
import { HarnessRegistry, RpcServer } from "@revealui/harnesses";

const registry = new HarnessRegistry();
registry.register("native", new RevealUIAgentAdapter());

const server = new RpcServer(registry, "/tmp/harness.sock");
await server.start();
```

**Available methods:**

| Method                | Params                     | Returns                |
| --------------------- | -------------------------- | ---------------------- |
| `harness.list`        |  -                           | `HarnessInfo[]`        |
| `harness.info`        | `{ harnessId }`            | `HarnessInfo`          |
| `harness.execute`     | `{ harnessId, command }`   | `HarnessCommandResult` |
| `harness.listRunning` | `{ harnessId }`            | `HarnessProcessInfo[]` |
| `harness.syncConfig`  | `{ harnessId, direction }` | `ConfigSyncResult`     |
| `harness.diffConfig`  | `{ harnessId }`            | `ConfigDiffEntry`      |

**Example call:**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"harness.list","params":{}}' \
  | nc -U /tmp/harness.sock
```

## Process detection

```typescript
import { findHarnessProcesses, autoDetectHarnesses } from "@revealui/harnesses";

// Find running Claude Code processes
const procs = await findHarnessProcesses("claude-code");
// [{ pid: 12345, command: 'claude ...', harnessId: 'claude-code' }]

// Auto-populate a registry from what's actually installed
const registry = new HarnessRegistry();
await autoDetectHarnesses(registry);
```

## Config sync

Sync harness configuration between the local project and an external SSD/DevPod:

```typescript
import { syncConfig, diffConfig } from "@revealui/harnesses";

// See what differs
const diff = diffConfig("claude-code");
// { harnessId, localExists, ssdExists, identical }

// Pull config from SSD to local
syncConfig("claude-code", "pull");

// Push local config to SSD
syncConfig("claude-code", "push");
```

---

# @revealui/services

Stripe payment processing and Supabase client integrations for RevealUI Pro.

## Overview

`@revealui/services` provides pre-wired Stripe and Supabase integrations with auth-aware clients, webhook handlers, and billing flow helpers.

**Requires a Pro or Forge license** (`isFeatureEnabled('payments')`).

## Stripe

### Client

```typescript
import { protectedStripe, getStripe } from "@revealui/services";

// Server-side: authenticated Stripe client (throws if STRIPE_SECRET_KEY missing)
const stripe = protectedStripe();
const customer = await stripe.customers.retrieve(customerId);

// Client-side: load Stripe.js (lazy singleton)
const stripe = await getStripe();
const { error } = await stripe.redirectToCheckout({ sessionId });
```

### Payment intents

For one-time charges, the package exports `createPaymentIntent`:

```typescript
import { createPaymentIntent, protectedStripe } from "@revealui/services";

const paymentIntent = await createPaymentIntent({
  amount: 2000, // $20.00 (cents)
  currency: "usd",
  metadata: { userId },
});
```

Full checkout/portal/webhook route handlers are wired at the application layer (see `apps/api/src/routes/billing.ts` in the monorepo for the reference implementation). The `@revealui/services` package intentionally exposes only the low-level clients (`protectedStripe`, `getStripe`, `createPaymentIntent`) so that each app can implement its billing flow against its own license record.

### Webhook environment

> Pre-launch posture: RevealUI runs in Stripe TEST mode in production. Use `sk_test_*` until billing-readiness sign-off; `STRIPE_LIVE_MODE=true` flips the live path.

```bash
STRIPE_SECRET_KEY=sk_test_...   # Use sk_live_... once billing-readiness sign-off lands
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...       # Your Pro tier price
```

## Supabase

### Server client (Next.js App Router)

```typescript
import { createServerClient } from "@revealui/services";
import { cookies } from "next/headers";

// In a Server Component or Route Handler
const supabase = createServerClient(cookies());
const { data } = await supabase.from("profiles").select("*");
```

### Browser client

```typescript
import { createBrowserClient } from "@revealui/services";

// In a Client Component
const supabase = createBrowserClient();
const {
  data: { session },
} = await supabase.auth.getSession();
```

### Request client (Hono / Edge)

```typescript
import { createServerClientFromRequest } from "@revealui/services";

// In a Hono handler
app.get("/me", async (c) => {
  const supabase = createServerClientFromRequest(c.req.raw);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return c.json({ user });
});
```

### Resilience wrapper

Wraps any Supabase operation with automatic retry on transient errors:

```typescript
import { withSupabaseResilience } from "@revealui/services";

const data = await withSupabaseResilience(() =>
  supabase.from("posts").select("*").limit(10),
);
```

## Environment configuration

```bash
# Stripe (use sk_test_/pk_test_ until billing-readiness sign-off; sk_live_/pk_live_ post-flip)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Supabase (new API keys, recommended)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

# Supabase (legacy JWT keys, deprecated Nov 2025)
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

# x402 Micropayments

RevealUI Pro includes native support for the [x402 protocol](https://x402.org)  -  HTTP-402-based micropayments in USDC on Base. Agents and callers pay per-task without subscriptions or API keys.

## Overview

When a caller hits a metered endpoint without a valid payment, the API returns:

```http
HTTP/1.1 402 Payment Required
X-PAYMENT-REQUIRED: <base64 PaymentRequired>
```

The caller pays the required USDC amount on-chain, then retries with the payment proof in `X-PAYMENT-PAYLOAD`. The API verifies the payment via the Coinbase x402 facilitator and processes the request.

## Metered endpoints

| Endpoint                                   | Default price                       |
| ------------------------------------------ | ----------------------------------- |
| `POST /a2a/:agentId/tasks/send`            | `X402_PRICE_PER_TASK` USDC          |
| `POST /api/marketplace/servers/:id/invoke` | Per-server price (set by developer) |

## Environment configuration

```bash
# Enable x402 payment gating
X402_ENABLED=true

# USDC receiving address on Base
X402_RECEIVING_ADDRESS=0x...

# Default price per agent task (USDC string, e.g. "0.01")
X402_PRICE_PER_TASK=0.01

# Network (base or base-sepolia for testnet)
X402_NETWORK=base
```

## Caller integration

```typescript
import { withPaymentInterceptor } from "@coinbase/x402/fetch";
import { createWalletClient } from "viem";

const wallet = createWalletClient({
  /* your wallet config */
});
const fetch402 = withPaymentInterceptor(fetch, wallet);

// Automatically handles 402 → pay → retry
const response = await fetch402(
  "https://api.revealui.com/a2a/my-agent/tasks/send",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      /* A2A task payload */
    }),
  },
);
```

The SDK handles the full 402 → payment → retry cycle automatically.

## Security

- Payment is verified by the [x402.org](https://x402.org) facilitator before any task is executed
- Each `X-PAYMENT-PAYLOAD` is validated on-chain; replays are rejected
- The receiving address is set server-side  -  callers cannot redirect payments

## Related

- [MCP Marketplace](./MARKETPLACE.md)  -  per-server x402 pricing for community MCP servers
- [AI agents](./AI.md)  -  A2A task dispatch with payment gating
- [Coinbase x402 SDK](https://github.com/coinbase/x402)

---

# Professional Services (Track D)

RevealUI offers four professional service engagements for teams that need hands-on help:

| Service | Description | Deliverable |
|---------|-------------|-------------|
| **Architecture Review** | Codebase, schema, deployment, and security review (up to 50K LOC) | Written report within 5 business days |
| **Migration Assist** | Migrate existing admin, database, or billing to RevealUI | Working migration with verified data integrity |
| **Launch Package** | Zero to production in one week (setup, billing, deploy, onboarding) | Production-ready deployment within 5 business days |
| **Consulting Hour** | One-on-one video call  -  pair programming, architecture, debugging | Session recording and written follow-up notes |

Contact: [services@revealui.com](mailto:services@revealui.com)

---

# Perpetual Licenses

All perpetual tiers are available for purchase. The full checkout flow is wired  -  webhook handler extends `supportExpiresAt` by one year on renewal.

RevealUI Pro is available as a **perpetual license** in addition to monthly/annual subscriptions. Buy once, use forever on a single production domain.

## What's included

- All Pro tier features at time of purchase
- 12 months of updates (patch + minor releases)
- Priority support during the coverage period
- License key scoped to one production domain

After the 12-month update period, the license continues to work indefinitely on the version you have. Renewing adds another 12 months of updates.

## License key format

Perpetual license keys are JWT-signed:

```
rui_perpetual_<base64-payload>.<signature>
```

The payload encodes: `domain`, `issuedAt`, `expiresAt` (update window end), and `tier`.

## Validating a license

```http
POST /api/license/verify
Content-Type: application/json

{ "licenseKey": "rui_perpetual_..." }
```

```json
{
  "valid": true,
  "tier": "pro",
  "domain": "app.example.com",
  "updatesUntil": "2027-03-07T00:00:00Z"
}
```

## Forge (enterprise perpetual)

Forge licenses follow the same perpetual model but are scoped to self-hosted deployments with domain lock. See [Forge](./FORGE.md) for the full self-hosted deployment guide.

---

# MCP Marketplace

The MCP Marketplace lets developers publish Model Context Protocol servers with per-call USDC pricing. RevealUI takes 20%; you earn 80%. Callers pay via x402  -  no subscriptions, no API keys.

This is a full reference guide for both publishers and callers.

See **[MARKETPLACE.md](./MARKETPLACE.md)** for the complete guide, including:

- Publishing a server (POST `/api/marketplace/servers`)
- Category and pricing guidelines
- Stripe Connect onboarding for payouts
- Discovering and invoking servers as a caller
- x402 payment flow with the Coinbase SDK
- SSRF protection and server requirements
- Rate limits

### Quick reference

```http
# Publish
POST /api/marketplace/servers
Authorization: Bearer <session-token>

# Discover
GET /api/marketplace/servers?category=coding

# Invoke (with x402 payment)
POST /api/marketplace/servers/:id/invoke
X-PAYMENT-PAYLOAD: <base64 proof>

# Agent discovery
GET /.well-known/marketplace.json
```

---

# Forge  -  Self-Hosted Deployment

Forge is the enterprise tier of RevealUI. Deploy the entire stack on your own infrastructure with domain lock and unlimited users.

See **[FORGE.md](./FORGE.md)** for the complete deployment guide, including:

- Docker Compose stack (API + admin + PostgreSQL)
- Environment variables (`FORGE_LICENSE_KEY`, `FORGE_LICENSED_DOMAIN`, etc.)
- Domain lock enforcement
- Reverse proxy configuration (Caddy + Nginx examples)
- Database migrations and upgrade procedure
- RSA key generation for license JWT signing
- Troubleshooting

### Quick reference

```bash
# Pull images (requires GHCR token from Forge welcome email)
echo "$GHCR_TOKEN" | docker login ghcr.io -u revealuistudio --password-stdin
docker pull ghcr.io/revealuistudio/revealui-api:latest
docker pull ghcr.io/revealuistudio/revealui-admin:latest

# Start the stack
docker compose -f docker-compose.forge.yml --env-file .env.forge up -d

# Apply migrations
docker compose -f docker-compose.forge.yml exec api pnpm db:migrate

# Verify
curl https://your-domain.com/health
# {"status":"ok","db":"connected","license":"forge"}
```
