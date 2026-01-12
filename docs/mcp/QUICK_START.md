# MCP Quick Start - Next.js DevTools

**Your Next.js DevTools MCP is already configured! Here's how to use it.**

---

## ✅ Current Status

- ✅ **Next.js DevTools MCP configured** in `.cursor/mcp-config.json`
- ✅ **Package installed**: `next-devtools-mcp@0.3.9`
- ✅ **Script available**: `pnpm mcp:next-devtools`

---

## How MCP Works in Cursor

**Important**: MCP servers in Cursor are **automatically managed**. You don't need to manually start them!

1. **Cursor reads** `.cursor/mcp-config.json` at startup
2. **Cursor starts** MCP servers automatically when needed
3. **You use them** through Cursor's AI chat - no manual commands needed

---

## Using Next.js DevTools MCP

### To Fix Next.js Errors

Just ask in Cursor chat:

```
I'm getting a Next.js error in my CMS app:
[paste error here]

Can you use the Next.js DevTools MCP to diagnose and fix it?
```

Or:

```
Use Next.js DevTools MCP to analyze my Next.js configuration 
and help fix any issues.
```

### What the MCP Can Do

The Next.js DevTools MCP provides:
- ✅ **Runtime diagnostics** - Analyze errors and warnings
- ✅ **Build error diagnosis** - Fix build-time issues
- ✅ **Performance analysis** - Debug performance problems
- ✅ **Upgrade automation** - Help with Next.js upgrades
- ✅ **Cache configuration** - Set up caching properly

---

## Current Error (Port Conflict)

Your current error:
```
Error: listen EADDRINUSE: address already in use :::4000
```

**This is NOT a Next.js code error** - it's a port conflict.

### Quick Fix:

```bash
# Option 1: Kill the process using port 4000
lsof -ti:4000 | xargs kill -9

# Option 2: Use a different port
PORT=4001 pnpm --filter cms dev

# Option 3: Change port in package.json dev script
```

---

## Manual MCP Server (Testing Only)

If you want to test the MCP server manually (not needed for normal use):

```bash
# Start Next.js DevTools MCP server
pnpm mcp:next-devtools
```

**Note**: This is for testing. Cursor manages MCP servers automatically.

---

## Verify MCP Configuration

### Check Configuration File

```bash
cat .cursor/mcp-config.json | grep -A 5 "next-devtools"
```

Should show:
```json
"next-devtools": {
  "command": "pnpm",
  "args": ["mcp:next-devtools"],
  "env": {
    "NEXT_TELEMETRY_DISABLED": "${NEXT_TELEMETRY_DISABLED:-0}"
  }
}
```

### Check Package is Installed

```bash
pnpm list next-devtools-mcp
```

---

## Using MCP for Real Next.js Errors

When you have an actual Next.js error (not a port conflict):

1. **Copy the full error message** (from terminal or browser console)

2. **Ask in Cursor chat**:
   ```
   I'm getting this Next.js error:
   
   [paste full error here]
   
   Please use Next.js DevTools MCP to diagnose and fix it.
   ```

3. **The MCP will**:
   - Analyze the error
   - Check your Next.js config
   - Review your code
   - Suggest fixes
   - Help implement solutions

---

## Example: Real Next.js Error

If you get an error like:
```
Error: Cannot find module '@/lib/components/Button'
Error: Hydration failed because the initial UI does not match what was rendered on the server
Error: Route /api/test returned 500 Internal Server Error
```

**Ask Cursor**:
```
I'm getting this Next.js error:
[error message]

Use Next.js DevTools MCP to help diagnose and fix it.
```

---

## Troubleshooting

### MCP Not Working in Cursor

1. **Restart Cursor** - MCP servers load at startup
2. **Check config file exists**: `.cursor/mcp-config.json`
3. **Verify package installed**: `pnpm list next-devtools-mcp`

### Server Won't Start Manually

If you want to test manually:
```bash
# Check if script works
pnpm mcp:next-devtools

# Should start MCP server (will run until stopped)
```

---

## Next Steps

1. **Fix current port conflict** (see above)
2. **Start CMS server**: `pnpm --filter cms dev`
3. **If you get Next.js errors**, ask Cursor to use the MCP to fix them!

---

**Status**: ✅ **MCP is ready to use - just ask Cursor!**
