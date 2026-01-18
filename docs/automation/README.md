# Automation Features

This directory contains automation features that make development easier by reducing manual setup steps.

## Features

### 1. MCP Server Auto-Start

**Problem**: You had to manually remember to run `pnpm mcp:all` before starting development.

**Solution**: MCP servers now automatically start when you run `pnpm dev` (if configured).

**How it works**:
- Detects configured MCP servers in `.cursor/mcp-config.json`
- Validates environment variables for each server
- Starts available servers in background (non-blocking)
- Shows status of started servers

**Control**:
- Enable: `AUTO_START_MCP=true` (default if configured)
- Disable: `AUTO_START_MCP=false` or use `pnpm dev:no-automation`

### 2. Ralph Workflow Suggestions

**Problem**: Easy to forget about the Ralph workflow system for complex tasks.

**Solution**: Gentle reminders and status checks when you start development.

**How it works**:
- Checks if you have an active Ralph workflow
- If active: Shows status and continuation commands
- If not active: Suggests using Ralph for complex tasks (optional)

**Control**:
- Enable: `AUTO_SUGGEST_RALPH=true` (default)
- Disable: `AUTO_SUGGEST_RALPH=false`

## Quick Start

### Default Behavior (Recommended)

Just run:

```bash
pnpm dev
```

This will:
1. Auto-start configured MCP servers
2. Show Ralph workflow status/suggestions
3. Start your development servers

### Disable Automation

If you prefer manual control:

```bash
# Option 1: Use non-automated command
pnpm dev:no-automation

# Option 2: Disable via env vars
export AUTO_START_MCP=false
export AUTO_SUGGEST_RALPH=false
pnpm dev
```

## Configuration

Add to `.env.development.local`:

```bash
# Enable/disable features
AUTO_START_MCP=true          # Auto-start MCP servers (default: true if configured)
AUTO_SUGGEST_RALPH=true      # Show Ralph suggestions (default: true)

# MCP server configuration (required for auto-start)
VERCEL_API_KEY=your_key      # For Vercel MCP
STRIPE_SECRET_KEY=sk_test_   # For Stripe MCP
NEON_API_KEY=your_key        # For Neon MCP
SUPABASE_URL=https://...     # For Supabase MCP
SUPABASE_ANON_KEY=your_key   # For Supabase MCP
```

## Implementation

The automation runs via `scripts/automation/auto-start-dev.ts` which:

1. Checks for Ralph workflows
2. Validates MCP configuration
3. Starts MCP servers in background (non-blocking)
4. Provides helpful tips and status messages

All automation is **non-blocking** - if it fails, `pnpm dev` will still start normally.

## Documentation

- **[Auto-Start Guide](./AUTO_START_GUIDE.md)** - Complete guide with troubleshooting
- **[MCP Setup](../../docs/mcp/MCP_SETUP.md)** - MCP server configuration
- **[Ralph Workflow](../../.cursor/workflows/ralph-iterative-workflow.md)** - Ralph workflow usage

## Benefits

✅ **No manual steps** - MCP servers start automatically  
✅ **Discoverability** - Learn about Ralph workflow naturally  
✅ **Non-blocking** - Automation never blocks dev startup  
✅ **Configurable** - Easy to disable if not needed  
✅ **Smart detection** - Only starts what's configured  

## Feedback

The automation is designed to be helpful but non-intrusive. If you find it annoying, you can:

1. Disable specific features via env vars
2. Use `pnpm dev:no-automation` for manual control
3. Report issues or suggestions
