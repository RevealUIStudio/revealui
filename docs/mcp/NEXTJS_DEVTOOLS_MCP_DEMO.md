# Next.js DevTools MCP - Live Demonstration

This document shows how the Next.js DevTools MCP server works with your RevealUI CMS app.

## Prerequisites

1. ✅ **Next.js DevTools MCP installed** (`next-devtools-mcp@^0.3.9`)
2. ✅ **MCP script created** (`scripts/mcp/mcp-next-devtools.ts`)
3. ✅ **Cursor MCP config updated** (`.cursor/mcp-config.json`)
4. ✅ **CMS app is Next.js 16.1.1** (fully compatible)

## Quick Start

### 1. Start Your CMS Dev Server

```bash
cd apps/cms
pnpm dev
# Server runs on http://localhost:4000
```

### 2. Start Next.js DevTools MCP Server

```bash
# Start just Next.js DevTools
pnpm mcp:next-devtools

# Or start all MCP servers
pnpm mcp:all
```

### 3. Verify Connection

The Next.js DevTools MCP server will automatically discover your CMS app when:
- ✅ Dev server is running on `http://localhost:4000`
- ✅ Next.js version is 16+ (you have 16.1.1 ✓)
- ✅ MCP endpoint is available at `http://localhost:4000/_next/mcp`

## Features in Action

### 🔍 Feature 1: Auto-Discovery

**What it does:**
The MCP server automatically scans common ports (3000, 3001, 4000, etc.) for running Next.js 16+ dev servers.

**How to trigger:**
In Cursor, ask:
```
Next Devtools, what servers are running?
```

**Expected output:**
```json
{
  "servers": [
    {
      "port": 4000,
      "pid": 12345,
      "url": "http://localhost:4000",
      "tools": [
        "get_errors",
        "get_routes",
        "get_logs",
        "get_server_actions",
        ...
      ]
    }
  ]
}
```

### 🐛 Feature 2: Runtime Diagnostics

#### Query Build/Runtime Errors

**Ask in Cursor:**
```
Next Devtools, what errors are in my Next.js app?
```

**What happens:**
1. MCP calls `nextjs_index` to discover server on port 4000
2. MCP calls `nextjs_call` with tool `get_errors`
3. Returns real-time error information from your CMS app

**Example response:**
```json
{
  "errors": [
    {
      "type": "build",
      "message": "Type error in src/lib/hooks/populateArchiveBlock.ts",
      "file": "populateArchiveBlock.ts",
      "line": 67,
      "details": "..."
    }
  ]
}
```

#### View Application Routes

**Ask in Cursor:**
```
Next Devtools, show me my application routes
```

**What happens:**
- Queries the `/app` directory structure
- Lists all routes, dynamic segments, and API routes
- Shows route metadata and configurations

**Example response:**
```json
{
  "routes": [
    {
      "path": "/",
      "type": "page",
      "file": "app/(frontend)/[slug]/page.tsx",
      "dynamic": true
    },
    {
      "path": "/api/users/me",
      "type": "route",
      "method": "GET",
      "file": "app/api/users/me/route.ts"
    },
    ...
  ]
}
```

#### Check Dev Server Logs

**Ask in Cursor:**
```
Next Devtools, what's in the dev server logs?
```

**What happens:**
- Retrieves recent development server output
- Shows build messages, warnings, and errors
- Filters relevant information for debugging

### 🚀 Feature 3: Upgrade Automation

**Ask in Cursor:**
```
Next Devtools, help me upgrade to Next.js 16
```

**What happens:**
1. Checks current Next.js version
2. Runs official Next.js codemod automatically
3. Updates async APIs (params, searchParams, cookies, headers)
4. Migrates configuration changes
5. Fixes deprecated features
6. Provides step-by-step guidance

**Note:** Since you're already on Next.js 16.1.1, this will confirm you're up to date!

### ⚡ Feature 4: Cache Components Setup

**Ask in Cursor:**
```
Next Devtools, enable Cache Components in my Next.js 16 app
```

**What happens:**
1. Pre-flight checks (package manager, Next.js version)
2. Enables Cache Components configuration
3. Starts dev server with MCP enabled
4. Automated route verification
5. Error detection and fixing
6. Intelligent Suspense boundary setup
7. Final verification and build testing

**This automates the entire Cache Components migration process!**

## Integration with Your CMS App

### Current Setup

Your CMS app (`apps/cms`) is perfectly configured for Next.js DevTools MCP:

```json
{
  "next": "16.1.1",  // ✅ Next.js 16+ required
  "dev": "next dev --turbo --port 4000"  // ✅ Standard port
}
```

### MCP Endpoint

Next.js 16 automatically exposes an MCP endpoint:
- **URL:** `http://localhost:4000/_next/mcp`
- **Available when:** Dev server is running
- **Authentication:** None (localhost only)

### Available Tools (via MCP)

When your dev server is running, you can use these tools:

1. **get_errors** - Real-time error reporting
2. **get_routes** - Route discovery and metadata
3. **get_logs** - Development server logs
4. **get_server_actions** - Server Action discovery
5. **get_component_tree** - Component hierarchy
6. **get_build_info** - Build configuration and status

## Example Workflows

### Workflow 1: Debug Build Errors

```
You: "Next Devtools, what errors are in my Next.js app?"

MCP: Discovers server → Calls get_errors → Returns errors

You: "Show me the error in populateArchiveBlock.ts"

MCP: Provides detailed error info with file location
```

### Workflow 2: Understand Application Structure

```
You: "Next Devtools, show me my application routes"

MCP: Discovers server → Calls get_routes → Returns route list

You: "What pages use dynamic segments?"

MCP: Filters routes and shows dynamic segment usage
```

### Workflow 3: Enable Cache Components

```
You: "Next Devtools, enable Cache Components"

MCP: Runs enable_cache_components tool:
  1. Checks compatibility
  2. Updates config
  3. Runs dev server
  4. Detects errors
  5. Auto-fixes issues
  6. Verifies success
```

## Troubleshooting

### MCP Server Can't Find Dev Server

**Problem:** `No server info found`

**Solutions:**
1. Ensure dev server is running: `cd apps/cms && pnpm dev`
2. Check port 4000 is accessible: `curl http://localhost:4000`
3. Verify Next.js version is 16+: Check `package.json`

### MCP Endpoint Not Available

**Problem:** Cannot connect to `/_next/mcp`

**Solutions:**
1. Dev server must be running
2. Next.js must be 16.0.0 or higher
3. Check browser console for errors
4. Try: `curl http://localhost:4000/_next/mcp`

### Tools Not Available

**Problem:** `nextjs_call` returns empty tools list

**Solutions:**
1. Restart dev server
2. Check Next.js version compatibility
3. Verify MCP endpoint is responding
4. Check dev server logs for errors

## Next Steps

1. **Start your CMS dev server:**
   ```bash
   cd apps/cms && pnpm dev
   ```

2. **Ensure MCP server is running:**
   ```bash
   pnpm mcp:all
   ```

3. **Try it in Cursor:**
   - Ask about errors in your app
   - Query application routes
   - Check dev server logs
   - Explore Cache Components setup

4. **Explore advanced features:**
   - Server Action discovery
   - Component tree analysis
   - Build configuration inspection

## Reference

- [Next.js DevTools MCP GitHub](https://github.com/vercel/next-devtools-mcp)
- [Next.js 16 MCP Documentation](https://nextjs.org/docs)
- [Model Context Protocol Spec](https://modelcontextprotocol.io)
