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

### `vscode-template.json`
Template for VS Code

**Installation:**
1. Copy to `.vscode/mcp.json` in repo root
2. Replace `<REPO_PATH>` with absolute path
3. Enable desired servers

## Available MCP Servers

| Server | Command | Description |
|--------|---------|-------------|
| code-validator | `tsx packages/mcp/src/servers/code-validator.ts` | Validates code against standards |
| vercel | `pnpm mcp:vercel` | Vercel deployment |
| stripe | `pnpm mcp:stripe` | Payment processing |
| neon | `pnpm mcp:neon` | Database operations |
| supabase | `pnpm mcp:supabase` | Supabase management |
| playwright | `pnpm mcp:playwright` | Browser automation |
| next-devtools | `pnpm mcp:next-devtools` | Next.js debugging |

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
SUPABASE_URL=https://....supabase.co
SUPABASE_ANON_KEY=eyJ...
```

## See Also

- [MCP Setup Guide](../docs/SETUP.md)
- [Server Documentation](../docs/servers/)
