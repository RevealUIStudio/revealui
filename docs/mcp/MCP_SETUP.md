# MCP Servers Setup Guide

Complete guide for setting up and using Model Context Protocol (MCP) servers in RevealUI.

## Overview

RevealUI includes 5 MCP servers for enhanced AI capabilities:

- **Vercel MCP** - Deploy and manage Vercel projects
- **Stripe MCP** - Payment processing and billing operations
- **NeonDB MCP** - Database operations and SQL queries
- **Supabase MCP** - Supabase project management and CRUD operations
- **Playwright MCP** - Browser automation and web scraping

All servers are **free** and run locally as npm packages.

---

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Add required API keys to `.env` file in project root:

```env
# Vercel MCP (Required)
VERCEL_API_KEY=vercel_xxx...

# Stripe MCP (Required)
STRIPE_SECRET_KEY=sk_test_xxx...

# NeonDB MCP (Required)
NEON_API_KEY=neon_xxx...

# Supabase MCP (Required)
SUPABASE_URL=https://xxx.supabase.co
# Legacy keys (deprecated Nov 2025, but still work):
SUPABASE_ANON_KEY=eyJxxx...  # Legacy anon JWT key
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...  # Legacy service_role JWT key
# New keys (recommended, available June 2025+):
# SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx...  # New publishable key (replaces anon)
# SUPABASE_SECRET_KEY=sb_secret_xxx...  # New secret key (replaces service_role)
# MCP_API_KEY (auto-generated if not set, but recommended to set explicitly):
# MCP_API_KEY=your_random_64_char_hex_string  # Secures the MCP server endpoint

# Playwright MCP - No environment variables needed
```

### 3. Start Servers

```bash
# Start all servers
pnpm mcp:all

# Or start individually
pnpm mcp:vercel
pnpm mcp:stripe
pnpm mcp:neon
pnpm mcp:supabase
pnpm mcp:playwright
```

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

**Detailed guide**: See [NEON_API_KEY_SETUP.md](../guides/configuration/NEON_API_KEY_SETUP.md)

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

**IPv4/IPv6 Note**: See [SUPABASE_IPV4_EXPLANATION.md](../reference/configuration/SUPABASE_IPV4_EXPLANATION.md) for network compatibility info.

---

## Server Details

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
    }
  }
}
```

**Note:** Restart Cursor after configuration changes.

---

## Troubleshooting

### "Missing API key" Error

**Solution:** Ensure your `.env` file has the required environment variables:
- Check file location: `/home/joshua-v-dev/projects/RevealUI/.env`
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
```

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
- **Documentation**: `docs/MCP_SETUP.md`

---

## Cost

All MCP servers are **completely free**:
- ✅ No subscription fees
- ✅ No usage-based pricing
- ✅ Only your existing service API usage costs apply
- ⚠️ Playwright downloads browser binaries (~300MB) on first run

---

## Additional Resources

- **Neon API Key Setup**: [NEON_API_KEY_SETUP.md](../guides/configuration/NEON_API_KEY_SETUP.md)
- **Supabase IPv4/IPv6**: [SUPABASE_IPV4_EXPLANATION.md](../reference/configuration/SUPABASE_IPV4_EXPLANATION.md)
- **Project Rules**: [.cursorrules](../../.cursorrules)

---

## Current Status

| Server | Status | Package | Env Required |
|--------|--------|---------|--------------|
| Vercel | ✅ Working | `vercel-mcp@0.0.7` | `VERCEL_API_KEY` |
| Stripe | ✅ Working | `@stripe/mcp@0.1.4` | `STRIPE_SECRET_KEY` |
| NeonDB | ⚠️ Needs API Key | `@neondatabase/mcp-server-neon@0.6.5` | `NEON_API_KEY` |
| Supabase | ⚠️ Needs Credentials | `supabase-mcp@1.5.0` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| Playwright | ✅ Working | `@executeautomation/playwright-mcp-server@1.0.12` | None |

---

**Last Updated:** January 2025  
**Maintained by:** RevealUI Team
