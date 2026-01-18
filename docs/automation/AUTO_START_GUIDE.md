# Auto-Start Automation Guide

This guide explains how the automation checks MCP server configuration and provides Ralph workflow suggestions when running `pnpm dev`.

## Overview

The RevealUI framework includes automation that:

1. **MCP configuration check** - Validates MCP server configuration when you run `pnpm dev`
2. **Ralph workflow suggestions** - Reminds you about active Ralph workflows or suggests using Ralph for complex tasks

## MCP Server Configuration Check

### How It Works

When you run `pnpm dev`, the automation script:

1. Checks if `.cursor/mcp-config.json` exists (indicates MCP is configured)
2. Validates environment variables for each MCP server
3. Shows which servers are configured and ready

**Important**: MCP servers are managed by Cursor IDE automatically. The automation script doesn't start them - it only checks if they're configured correctly. Cursor IDE will start MCP servers when needed based on `.cursor/mcp-config.json`.

### Configuration

#### Enable Configuration Check (Default)

By default, MCP configuration is checked if:
- `.cursor/mcp-config.json` exists (MCP is configured)
- Required environment variables are set for the servers

#### Disable Configuration Check

Set environment variable to disable:

```bash
# In .env.development.local or shell
AUTO_START_MCP=false
```

Or use the non-automated dev command:

```bash
pnpm dev:no-automation
```

### Available MCP Servers

The automation checks for these servers and validates their configuration:

1. **Vercel** - Requires `VERCEL_API_KEY` or `VERCEL_TOKEN`
2. **Stripe** - Requires `STRIPE_SECRET_KEY`
3. **Neon** - Requires `NEON_API_KEY`
4. **Supabase** - Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY`
5. **Playwright** - No env vars required (always available)
6. **Next.js DevTools** - No env vars required (always available)

### Starting MCP Servers

**By Cursor IDE (Recommended)**: Cursor IDE automatically starts MCP servers when needed based on `.cursor/mcp-config.json`.

**Manual Start**: Start MCP servers manually if needed:

```bash
# All servers
pnpm mcp:all

# Individual servers
pnpm mcp:vercel
pnpm mcp:stripe
# etc...
```

## Ralph Workflow Suggestions

### How It Works

The automation script:

1. Checks if a Ralph workflow is currently active
2. If active, shows status and continuation commands
3. If not active, suggests using Ralph for complex tasks (optional)

### Active Workflow Detection

If you have an active Ralph workflow, you'll see:

```
📋 Ralph workflow is active
   Check status: pnpm ralph:status
   Continue: pnpm ralph:continue
```

### Suggestions

If no active workflow and suggestions are enabled, you'll see:

```
💡 Tip: Use Ralph workflow for complex, multi-iteration tasks
   Start: pnpm ralph:start "<task>" --completion-promise "DONE"
   Set AUTO_SUGGEST_RALPH=false to disable this message
```

### Disable Suggestions

Set environment variable to disable:

```bash
# In .env.development.local or shell
AUTO_SUGGEST_RALPH=false
```

## Environment Variables

Add these to your `.env.development.local`:

```bash
# MCP Auto-Start Control
AUTO_START_MCP=true              # Enable/disable MCP auto-start (default: true if configured)
AUTO_SUGGEST_RALPH=true          # Enable/disable Ralph suggestions (default: true)

# MCP Server Configuration (required for auto-start)
VERCEL_API_KEY=your_key_here     # For Vercel MCP
STRIPE_SECRET_KEY=sk_test_...    # For Stripe MCP
NEON_API_KEY=your_key_here       # For Neon MCP
SUPABASE_URL=https://...         # For Supabase MCP
SUPABASE_ANON_KEY=your_key_here  # For Supabase MCP
```

## Usage Examples

### Default Behavior (Auto-Start Enabled)

```bash
# Starts MCP servers automatically, shows Ralph tips
pnpm dev
```

### Disable Auto-Start

```bash
# Set env var
export AUTO_START_MCP=false
pnpm dev

# Or use non-automated command
pnpm dev:no-automation
```

### Disable Ralph Suggestions

```bash
# Set env var
export AUTO_SUGGEST_RALPH=false
pnpm dev
```

### Full Control

```bash
# Disable all automation
export AUTO_START_MCP=false
export AUTO_SUGGEST_RALPH=false
pnpm dev

# Or just use the non-automated command (no suggestions shown)
pnpm dev:no-automation
```

## Troubleshooting

### MCP Servers Not Starting

1. **Check configuration**:
   ```bash
   ls .cursor/mcp-config.json  # Should exist
   ```

2. **Check environment variables**:
   ```bash
   # Verify required vars are set
   echo $VERCEL_API_KEY
   echo $STRIPE_SECRET_KEY
   # etc...
   ```

3. **Manual start** (to see errors):
   ```bash
   pnpm mcp:all
   ```

### Automation Script Failing

The automation script is designed to **never block** `pnpm dev` startup. If automation fails, you'll see a warning but dev will still start.

To debug:
```bash
# Run automation script directly
tsx scripts/automation/auto-start-dev.ts
```

### MCP Servers Already Running

If MCP servers are already running from a previous session, starting them again is safe. The MCP protocol handles multiple instances gracefully (they'll connect to the same servers).

## Best Practices

1. **Enable auto-start by default** - It's convenient and doesn't interfere if you don't need it
2. **Use Ralph workflow suggestions** - Helps you discover the feature for complex tasks
3. **Set env vars in `.env.development.local`** - Keeps configuration persistent
4. **Check MCP status manually** if needed:
   ```bash
   # See what servers are configured
   cat .cursor/mcp-config.json
   ```

## Related Commands

- `pnpm dev` - Start dev with automation (default)
- `pnpm dev:no-automation` - Start dev without automation
- `pnpm mcp:all` - Start all MCP servers manually
- `pnpm ralph:start` - Start a Ralph workflow
- `pnpm ralph:status` - Check Ralph workflow status

## Implementation Details

The automation script (`scripts/automation/auto-start-dev.ts`) runs before `turbo run dev` and:

1. Checks for Ralph workflows
2. Validates MCP configuration
3. Starts MCP servers in background (non-blocking)
4. Provides helpful tips and status messages

All automation is **non-blocking** - if it fails, `pnpm dev` will still start normally.
