---
title: "@revealui/mcp"
description: "**Model Context Protocol (MCP) - Complete Integration Package**"
visibility: public
status: verified
audience: user
---

# @revealui/mcp

> **Commercial package**  -  requires a [RevealUI Pro license](https://revealui.com/pro). Free to install and evaluate; a license key is required for production use.


**Model Context Protocol (MCP) - Complete Integration Package**

Centralized MCP server infrastructure, configuration, and documentation for RevealUI.

## Overview

This package contains everything MCP-related:

- **14 MCP Servers** - Code Validator, Contracts Introspection, RevealUI Docs, Neon, Next.js DevTools, Playwright, RevealUI Content, RevealUI Email, RevealUI Memory, RevealUI Stripe, Stripe, Supabase, Vercel, and the Adapter base (BaseAdapter with retry and idempotency, plus the Vercel/Stripe/Neon adapter subclasses). This roster matches the CI counter in `scripts/validate/claim-drift.ts` (adapter counted, the underscore-prefixed email-provider utility not); the count is enforced by `pnpm validate:claims`. Of the 14, eight are RevealUI-authored and six are first-party launchers that start vendor MCP server packages.
- **Configuration Templates** - For Claude Code / Claude Desktop
- **Utilities** - Config management, database adapters
- **Documentation** - Complete guides and per-server docs
- **Database Migrations** - MCP-related schema

> **Pro Package**  -  `@revealui/mcp` is published to the public npm registry under the RevealUI Pro license (FSL-1.1-MIT).
> Install: `pnpm add @revealui/mcp`

## Quick Start

### 1. Install Dependencies

```bash
# In the monorepo:
pnpm install

# As an external Pro subscriber:
pnpm add @revealui/mcp
```

### 2. Configure MCP Client

```bash
# Use template for your IDE
cp packages/mcp/configs/claude-template.json ~/.claude/config.json

# Replace <REPO_PATH> with actual path
sed -i "s|<REPO_PATH>|$(pwd)|g" ~/.claude/config.json
```

### 3. Test Server

```bash
# Test code validator
tsx packages/mcp/src/servers/code-validator.ts
# Should start (Ctrl+C to exit)
```

## Structure

```
packages/mcp/
├── src/
│   ├── servers/          # MCP server implementations (run `ls packages/mcp/src/servers/` for the current list)
│   │   ├── code-validator.ts   ← AI code standards enforcer
│   │   └── …                   ← Neon, Next.js DevTools, Playwright, RevealUI-*, Stripe, Supabase, Vercel
│   ├── config/           # Configuration utilities (index.ts, config.json)
│   └── adapters/         # Database adapters (db.ts)
├── configs/              # Template configurations
│   ├── claude-template.json
│   └── README.md
├── docs/                 # Complete documentation
│   ├── INDEX.md          ← Start here
│   ├── README.md         # Main MCP guide
│   ├── SETUP.md          # Setup instructions
│   └── servers/          # Per-server documentation
│       └── code-validator.md
└── package.json
```

## Available MCP Servers

### 1. Code Validator ⭐
**Status:** ✅ Active and configured

Prevents AI-generated technical debt by validating code before it's written.

- **Rules:** console.log, any types, TODO refs, debugger, skip tests
- **Integration:** Pre-commit hook + MCP server
- **Docs:** [docs/servers/code-validator.md](./docs/servers/code-validator.md)

```bash
tsx packages/mcp/src/servers/code-validator.ts
```

### 2. Vercel
**Status:** Available (requires API key)

Deploy and manage Vercel projects.

```bash
tsx packages/mcp/src/servers/vercel.ts
```

### 3. Stripe
**Status:** Available (requires API key)

Payment processing and billing operations.

```bash
tsx packages/mcp/src/servers/stripe.ts
```

### 4. Neon
**Status:** Available (requires API key)

Database operations and SQL queries.

```bash
tsx packages/mcp/src/servers/neon.ts
```

### 5. Supabase
**Status:** Available (requires API key)

Supabase project management and CRUD operations.

```bash
tsx packages/mcp/src/servers/supabase.ts
```

### 6. Playwright
**Status:** Available

Browser automation and web scraping.

```bash
tsx packages/mcp/src/servers/playwright.ts
```

### 7. Next.js DevTools
**Status:** Available

Next.js 16+ runtime diagnostics and automation.

```bash
tsx packages/mcp/src/servers/next-devtools.ts
```

### 8. Contracts Introspection
**Status:** ✅ Active (no API key required, **not** Pro-license-gated)

Phase 1 of the protocol-pyramid ADR ([`docs/decisions/2026-05-03-contracts-protocol-pyramid.md`](../../docs/decisions/2026-05-03-contracts-protocol-pyramid.md)). Exposes every `@revealui/contracts` category (representation, entities, content, admin, agents, security, secrets, a2a, api-auth, api-chat, api-gdpr, content-validation, devkit-profiles, generated, providers, stripe-webhook-events) as MCP **resources** (read-only JSON Schemas of every category schema) and matching MCP **tools** that parse arbitrary JSON against any registered schema.

- **Resources:** `revealui-contracts://catalog` (full discovery payload) + `revealui-contracts://<category>` (one per category, returns all schemas).
- **Tools:** `contracts_list_categories`, `contracts_get_schema`, plus one `contracts_validate_<category>` per category.
- **License:** intentionally NOT Pro-gated. `@revealui/contracts` is MIT and agent-side schema introspection is meant to enable any MCP client (Claude Code, Cursor, custom agents) to integrate cleanly.

```bash
tsx packages/mcp/src/servers/contracts.ts
```

## Configuration

All configuration templates are in `configs/`:

- **`claude-template.json`** - Claude Code / Claude Desktop

See [configs/README.md](./configs/README.md) for details.

## Environment Variables

```env
# Code Validator (no env vars needed)

# Vercel MCP
VERCEL_API_KEY=vercel_...

# Stripe MCP
STRIPE_SECRET_KEY=sk_test_...

# Neon MCP
NEON_API_KEY=neon_...

# Supabase MCP
SUPABASE_URL=https://....supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Documentation

📚 **[Complete Documentation Index](./docs/INDEX.md)**

- **[Main Guide](./docs/README.md)** - MCP overview
- **[Setup Guide](./docs/SETUP.md)** - Configuration steps
- **[Code Validator](./docs/servers/code-validator.md)** - Validator guide

## Development

```bash
# Build package
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Running servers

There are no root `pnpm mcp:*` script aliases. Start a server with `tsx` against the file under `src/servers/` (underscore-prefixed files are helpers, not counted servers):

```bash
# Examples (from monorepo root)
tsx packages/mcp/src/servers/code-validator.ts
tsx packages/mcp/src/servers/vercel.ts
tsx packages/mcp/src/servers/stripe.ts
tsx packages/mcp/src/servers/neon.ts
tsx packages/mcp/src/servers/supabase.ts
tsx packages/mcp/src/servers/playwright.ts
tsx packages/mcp/src/servers/next-devtools.ts
tsx packages/mcp/src/servers/contracts.ts
tsx packages/mcp/src/servers/docs.ts

# Copy Claude config template
pnpm setup:mcp
```

## Exports

```typescript
// Config utilities
import { getMcpConfig } from '@revealui/mcp/config'
```

## Migration from Old Structure

This package consolidates MCP code from multiple locations:

**Before:**
- `scripts/mcp/` → Now `src/servers/`
- `packages/config/src/mcp/` → Now `src/config/`
- Multiple config files → Now `configs/` templates
- Scattered docs → Now `docs/`

**After:**
- Everything in `packages/mcp/` ✅

## Related Documentation

- [Root MCP Guide](../../docs/MCP.md)
- [Automation Guide](../../docs/AUTOMATION.md) - AI agent integration
- [Project Overview](../../docs/OVERVIEW.md) - Framework overview

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Anthropic MCP Servers](https://github.com/anthropics/mcp-servers)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)

## License

FSL-1.1-MIT (Fair Source — converts to MIT after 2 years). See [LICENSE](../../LICENSE).

---

**Status:** ✅ Consolidated and Active
**Servers:** 14 available (ground truth: `pnpm validate:claims` — source of truth is `packages/mcp/src/servers/`)
**Last Updated:** 2026-05-03
