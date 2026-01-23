# MCP (Model Context Protocol) Configuration

This directory contains the primary MCP server configuration used by various tools.

## Configuration Files

### `.mcp/config.json` (Primary)
This is the **source of truth** for MCP server configuration. It contains a minimal configuration for basic MCP clients that need direct node command execution.

### Other Config Files
- `.cursor/mcp-config.json` - **Most comprehensive**, used by Cursor IDE (6 servers, pnpm scripts)
- `.cursor/mcp.json` - Legacy or alternate Cursor config
- `.vscode/mcp.json` - Used by VS Code (if exists)

## Current Setup

The project uses `.cursor/mcp-config.json` as the primary config for Cursor IDE, which is the **source of truth** for MCP server configuration.

**Note**: As of January 2025, `.mcp/config.json` has been consolidated to include all 6 servers, matching `.cursor/mcp-config.json` for consistency.

### Available MCP Servers

Both `.mcp/config.json` and `.cursor/mcp-config.json` now include all 6 servers:

1. **Vercel** - `pnpm mcp:vercel`
2. **Stripe** - `pnpm mcp:stripe`
3. **Neon** - `pnpm mcp:neon`
4. **Supabase** - `pnpm mcp:supabase`
5. **Playwright** - `pnpm mcp:playwright`
6. **Next DevTools** - `pnpm mcp:next-devtools`

## Configuration Status

✅ **Consolidated** (January 2025): Both configs now include all 6 servers for consistency.

### Configuration Files

- **`.cursor/mcp-config.json`** - Source of truth (Cursor IDE, 6 servers)
- **`.mcp/config.json`** - Consolidated to match (all tools, 6 servers)
- **`.vscode/mcp.json`** - Optional VS Code config (if needed)

### Tool Usage

- **Cursor IDE**: Uses `.cursor/mcp-config.json` (source of truth)
- **VS Code**: Uses `.vscode/mcp.json` if present, otherwise `.mcp/config.json`
- **Other Tools**: Use `.mcp/config.json` (now matches comprehensive config)

## Environment Variables Required

Make sure these environment variables are set:

- `VERCEL_API_KEY` / `VERCEL_TOKEN`
- `STRIPE_SECRET_KEY`
- `NEON_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_TELEMETRY_DISABLED` (optional)

See `package.json` scripts for the MCP server commands.
