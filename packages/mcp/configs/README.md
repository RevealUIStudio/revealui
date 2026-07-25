---
title: "MCP Configuration Templates"
description: "This directory contains template configuration files for different MCP clients."
visibility: public
status: verified
audience: user
---

# MCP Configuration Templates

This directory contains template configuration files for different MCP clients.

## Available Templates

### `claude-template.json`
Template for Claude Code / Claude Desktop

**Installation:**
1. Copy to your Claude config location:
   - Linux: `~/.config/Claude/claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - CLI: `~/.claude/config.json`

2. Replace `<REPO_PATH>` with absolute path to RevealUI repo

3. Enable desired servers by setting `"enabled": true`


## Available MCP Servers

| Server | Command | Description |
|--------|---------|-------------|
| code-validator | `tsx packages/mcp/src/servers/code-validator.ts` | Validates code against standards |
| vercel | `tsx packages/mcp/src/servers/vercel.ts` | Vercel deployment |
| stripe | `tsx packages/mcp/src/servers/stripe.ts` | Payment processing |
| neon | `tsx packages/mcp/src/servers/neon.ts` | Database operations |
| playwright | `tsx packages/mcp/src/servers/playwright.ts` | Browser automation |
| next-devtools | `tsx packages/mcp/src/servers/next-devtools.ts` | Next.js debugging |

## Quick Setup Script

Run from repo root:

```bash
# Auto-generate config with correct paths
pnpm setup:mcp

# Or manually:
REPO_PATH=$(pwd)
sed "s|<REPO_PATH>|$REPO_PATH|g" packages/mcp/configs/claude-template.json > ~/.claude/config.json
```

## Environment Variables

Make sure these are set:

```env
VERCEL_API_KEY=vercel_...
STRIPE_SECRET_KEY=sk_test_...
NEON_API_KEY=neon_...
```

## See Also

- [MCP Setup Guide](../docs/SETUP.md)
- [Server Documentation](../docs/servers/)
