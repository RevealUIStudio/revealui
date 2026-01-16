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

The project uses `.cursor/mcp-config.json` as the primary config for Cursor IDE, which is the most comprehensive and uses pnpm scripts from `package.json`.

### Available MCP Servers

1. **Vercel** - `pnpm mcp:vercel`
2. **Stripe** - `pnpm mcp:stripe`
3. **Neon** - `pnpm mcp:neon`
4. **Supabase** - `pnpm mcp:supabase`
5. **Playwright** - `pnpm mcp:playwright`
6. **Next DevTools** - `pnpm mcp:next-devtools`

## Migration Plan

To consolidate configurations:

1. **Use `.cursor/mcp-config.json` as the source of truth** (most comprehensive)
2. **Update `.mcp/config.json`** to match or reference the comprehensive config
3. **Document which tool uses which config**:
   - Cursor IDE: `.cursor/mcp-config.json`
   - VS Code: `.vscode/mcp.json` (if different)
   - Other tools: `.mcp/config.json`

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
