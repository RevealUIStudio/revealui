# @revealui/mcp

> **Commercial package**  -  requires a [RevealUI Pro license](https://revealui.com/pro). Free to install and evaluate; a license key is required for production use.


**Model Context Protocol (MCP) - Complete Integration Package**

Centralized MCP server infrastructure, configuration, and documentation for RevealUI.

## Overview

This package contains everything MCP-related:

- **13 MCP Servers** — Code Validator, Neon, Next.js DevTools, Playwright, RevealUI Content, RevealUI Email, RevealUI Memory, RevealUI Stripe, Stripe, Supabase, Vercel, Vultr Test, and an Email Provider helper. Ground-truth count is enforced by `pnpm validate:claims`.
- **Configuration Templates** - For Claude Code / Claude Desktop
- **Utilities** - Config management, database adapters
- **Documentation** - Complete guides and per-server docs
- **Database Migrations** - MCP-related schema

> **Pro Package**  -  `@revealui/mcp` is available to RevealUI Pro subscribers via GitHub Packages.
> Install: `pnpm add @revealui/mcp --registry https://npm.pkg.github.com`

## Quick Start

### 1. Install Dependencies

```bash
# In the monorepo:
pnpm install

# As an external Pro subscriber:
pnpm add @revealui/mcp --registry https://npm.pkg.github.com
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
│   │   └── …                   ← Neon, Next.js DevTools, Playwright, RevealUI-*, Stripe, Supabase, Vercel, Vultr Test
│   ├── config/           # Configuration utilities
│   │   ├── index.ts
│   │   ├── config.json
│   │   └── README.md
│   └── adapters/         # Database adapters
│       └── db.ts
├── configs/              # Template configurations
│   ├── claude-template.json
│   └── README.md
├── docs/                 # Complete documentation
│   ├── INDEX.md          ← Start here
│   ├── README.md         # Main MCP guide
│   ├── SETUP.md          # Setup instructions
│   └── servers/          # Per-server documentation
│       └── code-validator.md
├── migrations/           # Database migrations
│   ├── 0001_add_crdt_columns.sql
│   └── ...
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
pnpm mcp:vercel
```

### 3. Stripe
**Status:** Available (requires API key)

Payment processing and billing operations.

```bash
pnpm mcp:stripe
```

### 4. Neon
**Status:** Available (requires API key)

Database operations and SQL queries.

```bash
pnpm mcp:neon
```

### 5. Supabase
**Status:** Available (requires API key)

Supabase project management and CRUD operations.

```bash
pnpm mcp:supabase
```

### 6. Playwright
**Status:** Available

Browser automation and web scraping.

```bash
pnpm mcp:playwright
```

### 7. Next.js DevTools
**Status:** Available

Next.js 16+ runtime diagnostics and automation.

```bash
pnpm mcp:next-devtools
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

## Package Scripts (Root)

```bash
# Start individual MCP servers
pnpm mcp:vercel
pnpm mcp:stripe
pnpm mcp:neon
pnpm mcp:supabase
pnpm mcp:playwright
pnpm mcp:next-devtools

# Setup MCP configuration
pnpm setup:mcp
```

## Exports

```typescript
// Config utilities
import { getMCPConfig } from '@revealui/mcp/config'
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

Commercial  -  see [LICENSE.commercial](../../LICENSE.commercial)

---

**Status:** ✅ Consolidated and Active
**Servers:** 7 available (1 active, 6 optional)
**Last Updated:** 2026-03-04
