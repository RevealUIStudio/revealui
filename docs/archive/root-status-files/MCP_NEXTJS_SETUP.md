# Next.js DevTools MCP Setup Guide

**Quick guide to set up and use Next.js DevTools MCP server to fix Next.js errors**

---

## Current Status

✅ **Already Configured**: Next.js DevTools MCP is already set up in your codebase!

---

## Quick Start

### 1. Check MCP Configuration

The Next.js DevTools MCP is already configured in `.cursor/mcp-config.json`:

```json
{
  "next-devtools": {
    "command": "pnpm",
    "args": ["mcp:next-devtools"],
    "env": {
      "NEXT_TELEMETRY_DISABLED": "${NEXT_TELEMETRY_DISABLED:-0}"
    }
  }
}
```

### 2. How to Use

**Option A: Let Cursor Manage It (Recommended)**
- Cursor will automatically start the MCP server when needed
- No manual setup required
- Just use Cursor's AI features - the MCP will be available

**Option B: Start Manually (for testing)**
```bash
# Start the Next.js DevTools MCP server
pnpm mcp:next-devtools
```

### 3. What Next.js DevTools MCP Can Do

The Next.js DevTools MCP provides:
- **Runtime diagnostics** - Analyze Next.js errors and warnings
- **Upgrade automation** - Help with Next.js version upgrades
- **Cache Components setup** - Configure Next.js caching
- **Performance analysis** - Debug performance issues
- **Build error diagnosis** - Help fix build and runtime errors

---

## Current Error Analysis

Your current error:
```
Error: listen EADDRINUSE: address already in use :::4000
```

**This is a port conflict** - Port 4000 is already in use.

**Quick Fix**:
```bash
# Find what's using port 4000
lsof -ti:4000

# Kill the process (replace PID with actual process ID)
kill -9 <PID>

# Or use a different port
PORT=4001 pnpm --filter cms dev
```

---

## Using MCP to Fix Next.js Errors

### Step 1: Ensure MCP is Available in Cursor

1. Open Cursor Settings
2. Go to Features → MCP
3. Verify "next-devtools" is listed and enabled
4. If not, check `.cursor/mcp-config.json` exists

### Step 2: Describe Your Error

In Cursor chat, you can now ask:
- "Use Next.js DevTools MCP to diagnose this error: [error message]"
- "Analyze the Next.js error in my CMS app"
- "Help me fix the Next.js build error"

The MCP will provide:
- Error analysis
- Suggested fixes
- Configuration recommendations
- Performance improvements

---

## Verification

### Check if MCP Server is Running

```bash
# Check if the script exists and works
pnpm mcp:next-devtools
```

### Test MCP in Cursor

1. Open Cursor
2. Ask: "What Next.js errors do you see in my project?"
3. The MCP should analyze your Next.js setup

---

## Troubleshooting

### MCP Not Available in Cursor

1. **Check configuration**:
   ```bash
   cat .cursor/mcp-config.json
   ```

2. **Restart Cursor** - MCP servers are loaded at startup

3. **Check dependencies**:
   ```bash
   # Verify package is installed
   pnpm list next-devtools-mcp
   ```

### MCP Server Won't Start

1. **Check Node version**:
   ```bash
   node --version  # Should be 18+
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Try running manually**:
   ```bash
   pnpm exec next-devtools-mcp
   ```

---

## Next Steps

1. **Fix current port conflict** (see above)
2. **Start CMS server**:
   ```bash
   pnpm --filter cms dev
   ```

3. **Use MCP in Cursor** to diagnose any Next.js errors that occur

---

## Example: Using MCP for Error Diagnosis

If you get a Next.js error, you can now:

1. **Copy the error message**
2. **Ask in Cursor chat**:
   ```
   I'm getting this Next.js error in my CMS app:
   [paste error]
   
   Can you use the Next.js DevTools MCP to diagnose and fix it?
   ```

3. **The MCP will**:
   - Analyze the error
   - Check your Next.js configuration
   - Suggest fixes
   - Help implement solutions

---

**Status**: ✅ MCP is configured and ready to use!
