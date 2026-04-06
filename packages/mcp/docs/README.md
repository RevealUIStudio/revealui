# Model Context Protocol (MCP) - Complete Guide

Complete guide for setting up and using Model Context Protocol (MCP) servers in RevealUI, including Next.js DevTools integration.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [MCP Servers](#mcp-servers)
- [Getting API Keys](#getting-api-keys)
- [Next.js DevTools MCP](#nextjs-devtools-mcp)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)
- [Related Documentation](#related-documentation)

---

## Overview

RevealUI includes 7 MCP servers for enhanced AI capabilities:

- **Code Validator MCP** - Static analysis and code quality checks
- **Vercel MCP** - Deploy and manage Vercel projects
- **Stripe MCP** - Payment processing and billing operations
- **NeonDB MCP** - Database operations and SQL queries
- **Supabase MCP** - Supabase project management and CRUD operations
- **Playwright MCP** - Browser automation and web scraping
- **Next.js DevTools MCP** - Next.js 16+ runtime diagnostics and automation

All servers are **free** and run locally as npm packages.

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
# Start all servers
pnpm mcp:all

# Or start individually
pnpm mcp:vercel
pnpm mcp:stripe
pnpm mcp:neon
pnpm mcp:supabase
pnpm mcp:playwright
pnpm mcp:next-devtools
```

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

### NeonDB MCP (`@neondatabase/mcp-server-neon@0.6.5`)

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

**Detailed guide**: See [NEON_API_KEY_SETUP.md](./ENVIRONMENT_VARIABLES_GUIDE.md)

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
MCP_API_KEY=your-generated-api-key-here
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

### Integration with Your CMS App

Your CMS app (`apps/cms`) is perfectly configured for Next.js DevTools MCP:

```json
{
  "next": "16.1.1",  // Next.js 16+ required
  "dev": "next dev --turbo --port 4000"  // Standard port
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

**Key Point:** Zero configuration - it automatically finds your CMS app!

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

**Step 1: Start Your CMS Dev Server**
```bash
cd apps/cms
pnpm dev
```

**Step 2: Start Next.js DevTools MCP Server (Optional)**
```bash
# In another terminal
pnpm mcp:next-devtools

# Or start all MCP servers
pnpm mcp:all
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
Shows real-time build and runtime errors from your CMS app.

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

### "Missing API key" Error

**Solution:** Ensure your `.env` file has the required environment variables:
- Check file location: `<your-project-root>/.env`
- Verify variable names match exactly (case-sensitive)
- Restart the MCP server after adding variables

### "Connection refused" Error

**Solution:**
- Ensure MCP servers are running: `pnpm mcp:all`
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
1. Ensure dev server is running: `cd apps/cms && pnpm dev`
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
# Check if script works
pnpm mcp:next-devtools

# Should start MCP server (will run until stopped)
```

---

## Testing

### Test Individual Servers

```bash
# Test each server (will timeout after 3 seconds - this is normal)
timeout 3 pnpm mcp:vercel     # Should show "Starting Vercel MCP Server..."
timeout 3 pnpm mcp:stripe     # Should show "Starting Stripe MCP Server..."
timeout 3 pnpm mcp:neon       # Will fail if NEON_API_KEY not set
timeout 3 pnpm mcp:supabase   # Will fail if SUPABASE_URL not set
timeout 3 pnpm mcp:playwright # Should show "Starting Playwright MCP Server..."
timeout 3 pnpm mcp:next-devtools # Should show "Starting Next.js DevTools MCP..."
```

### Verify All Servers Start

```bash
# Start all servers (Ctrl+C to stop)
pnpm mcp:all

# Expected output:
# [0] ✅ Vercel MCP Server running
# [1] ✅ Stripe MCP Server running
# [2] ⚠️ NeonDB MCP: Missing NEON_API_KEY
# [3] ⚠️ Supabase MCP: Missing SUPABASE_URL
# [4] ✅ Playwright MCP Server running
# [5] ✅ Next.js DevTools MCP Server running
```

### Next.js DevTools Verification

Use this checklist to verify everything is working:

- [ ] CMS dev server running (`cd apps/cms && pnpm dev`)
- [ ] Next.js DevTools MCP running (`pnpm mcp:next-devtools`)
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

| Server | Status | Package | Env Required |
|--------|--------|---------|--------------|
| Vercel | ✅ Working | `vercel-mcp@0.0.7` | `VERCEL_API_KEY` |
| Stripe | ✅ Working | `@stripe/mcp@0.1.4` | `STRIPE_SECRET_KEY` |
| NeonDB | ⚠️ Needs API Key | `@neondatabase/mcp-server-neon@0.6.5` | `NEON_API_KEY` |
| Supabase | ⚠️ Needs Credentials | `supabase-mcp@1.5.0` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| Playwright | ✅ Working | `@executeautomation/playwright-mcp-server@1.0.12` | None |
| Next.js DevTools | ✅ Working | `next-devtools-mcp@0.3.9` | None (requires Next.js 16+) |

---

## Related Documentation

- [MCP Fixes 2025](./MCP_FIXES_2025.md) - Recent MCP updates and fixes
- [Next.js DevTools Demo](./NEXTJS_DEVTOOLS_MCP_DEMO.md) - Demo and examples
- [MCP Demo Interaction](./demo-mcp-interaction.md) - Interaction examples
- [Neon API Key Setup](./ENVIRONMENT_VARIABLES_GUIDE.md) - Detailed Neon setup
- [Supabase IPv4/IPv6](./DATABASE.md) - Network compatibility
- [Environment Variables Guide](./ENVIRONMENT_VARIABLES_GUIDE.md) - Configuration
- [Master Index](../INDEX.md) - Complete documentation index

---

## External Resources

- [Next.js DevTools MCP GitHub](https://github.com/vercel/next-devtools-mcp)
- [Next.js 16 MCP Documentation](https://nextjs.org/docs)
- [Model Context Protocol Spec](https://modelcontextprotocol.io)
- [Supabase API Key Changes Discussion](https://github.com/orgs/supabase/discussions/29260)

---

**Last Updated:** January 2025
**Maintained by:** RevealUI Team
