# Next.js DevTools MCP - In Action

A comprehensive guide showing how the Next.js DevTools MCP server works with your RevealUI CMS app, including real examples and live demonstrations.

## Prerequisites

Before starting, ensure you have:

1. Next.js DevTools MCP installed (`next-devtools-mcp@^0.3.9`)
2. MCP script created (`scripts/mcp/mcp-next-devtools.ts`)
3. Cursor MCP config updated (`.cursor/mcp-config.json`)
4. CMS app running Next.js 16.1.1 (fully compatible)

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
- Dev server is running on `http://localhost:4000`
- Next.js version is 16+ (you have 16.1.1)
- MCP endpoint is available at `http://localhost:4000/_next/mcp`

---

## Feature 1: Auto-Discovery

### What It Does

The MCP server automatically scans common ports (3000, 3001, 4000, 5000, etc.) for running Next.js 16+ dev servers.

### How to Use

**In Cursor, ask:**
```
Next Devtools, what servers are running?
```

### What Happens

1. Scans ports for running Next.js servers
2. Checks for `/_next/mcp` endpoint on each port
3. Discovers your CMS app on port 4000
4. Returns server information with available tools

### Example Response

```json
{
  "servers": [
    {
      "port": 4000,
      "pid": 15234,
      "url": "http://localhost:4000",
      "version": "16.1.1",
      "framework": "Next.js",
      "tools": [
        "get_errors",
        "get_routes",
        "get_logs",
        "get_server_actions",
        "get_component_tree",
        "get_build_info"
      ],
      "metadata": {
        "turbopack": true,
        "appDirectory": true,
        "devServer": true
      }
    }
  ],
  "total": 1
}
```

**Key Point:** Zero configuration - it automatically finds your CMS app!

---

## Feature 2: Runtime Diagnostics

### Query Build/Runtime Errors

**Ask in Cursor:**
```
Next Devtools, what errors are in my Next.js app?
```

**What Happens:**
1. MCP calls `nextjs_index` to discover server on port 4000
2. MCP calls `nextjs_call` with tool `get_errors`
3. Connects to `http://localhost:4000/_next/mcp`
4. Returns real-time error information from your CMS app

**Example Response (Real Errors from Your App):**
```json
{
  "errors": [
    {
      "type": "build",
      "severity": "error",
      "code": "TS2339",
      "message": "Property 'id' does not exist on type 'RevealDocument'",
      "file": "apps/cms/src/lib/hooks/populateArchiveBlock.ts",
      "line": 67,
      "column": 41,
      "source": "TypeScript",
      "category": "type-error"
    },
    {
      "type": "build",
      "severity": "error",
      "code": "TS2307",
      "message": "Cannot find module '@revealui/db/client'",
      "file": "apps/cms/src/app/api/memory/context/[sessionId]/[agentId]/route.ts",
      "line": 10,
      "source": "TypeScript",
      "category": "module-resolution"
    },
    {
      "type": "runtime",
      "severity": "warning",
      "message": "Unused variable 'data'",
      "file": "apps/cms/src/app/api/chat/route.ts",
      "line": 85
    }
  ],
  "summary": {
    "total": 104,
    "errors": 104,
    "warnings": 0,
    "build_time": "2.3s"
  },
  "server": {
    "port": 4000,
    "url": "http://localhost:4000"
  }
}
```

**Key Point:** Real-time access to ALL your build/runtime errors without checking the terminal!

### View Application Routes

**Ask in Cursor:**
```
Next Devtools, show me my application routes
```

**What Happens:**
1. Discovers server on port 4000
2. Calls `nextjs_call` with `toolName: "get_routes"`
3. Queries the `/app` directory structure
4. Lists all routes, dynamic segments, and API routes
5. Shows route metadata and configurations

**Example Response (Your CMS Routes):**
```json
{
  "routes": [
    {
      "path": "/",
      "type": "page",
      "file": "app/(frontend)/[slug]/page.tsx",
      "dynamic": true,
      "segment": "[slug]",
      "layout": "app/(frontend)/layout.tsx",
      "metadata": {
        "dynamic": "force-dynamic"
      }
    },
    {
      "path": "/admin",
      "type": "page",
      "file": "app/(backend)/admin/[[...segments]]/page.tsx",
      "dynamic": true,
      "catchAll": true,
      "segments": ["[[...segments]]"],
      "layout": "app/(backend)/layout.tsx"
    },
    {
      "path": "/posts/[slug]",
      "type": "page",
      "file": "app/(frontend)/posts/[slug]/page.tsx",
      "dynamic": true,
      "segment": "[slug]"
    },
    {
      "path": "/api/users/me",
      "type": "route",
      "method": "GET",
      "file": "app/api/users/me/route.ts",
      "dynamic": "force-dynamic"
    },
    {
      "path": "/api/chat",
      "type": "route",
      "method": "POST",
      "file": "app/api/chat/route.ts"
    },
    {
      "path": "/api/memory/context/[sessionId]/[agentId]",
      "type": "route",
      "method": "GET",
      "file": "app/api/memory/context/[sessionId]/[agentId]/route.ts",
      "dynamic": true,
      "segments": ["[sessionId]", "[agentId]"]
    }
  ],
  "summary": {
    "total": 25,
    "pages": 15,
    "api_routes": 10,
    "dynamic_routes": 8,
    "catch_all_routes": 1
  }
}
```

**Key Point:** Complete visibility into your application structure!

### Check Dev Server Logs

**Ask in Cursor:**
```
Next Devtools, what's in the dev server logs?
```

**What Happens:**
1. Discovers server
2. Calls `get_logs` tool
3. Retrieves recent development server output
4. Shows build messages, warnings, and errors
5. Filters relevant information for debugging

**Example Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-01-06T18:42:15.123Z",
      "level": "info",
      "message": "✓ Compiled /api/users/me in 234ms",
      "category": "build"
    },
    {
      "timestamp": "2025-01-06T18:42:20.456Z",
      "level": "warn",
      "message": "Fast Refresh had to perform a full reload due to runtime error",
      "category": "hot-reload"
    },
    {
      "timestamp": "2025-01-06T18:42:25.789Z",
      "level": "error",
      "message": "Type error in populateArchiveBlock.ts:67: Property 'id' does not exist",
      "category": "type-error",
      "file": "populateArchiveBlock.ts",
      "line": 67
    },
    {
      "timestamp": "2025-01-06T18:42:30.012Z",
      "level": "info",
      "message": "✓ Compiled in 1.2s (654 modules)",
      "category": "build"
    }
  ],
  "summary": {
    "count": 50,
    "errors": 3,
    "warnings": 8,
    "info": 39,
    "time_range": "2025-01-06T18:42:00Z to 2025-01-06T18:42:45Z"
  }
}
```

**Key Point:** See what's happening in your dev server without switching terminals!

---

## Feature 3: Upgrade Automation

### Help Me Upgrade to Next.js 16

**Ask in Cursor:**
```
Next Devtools, help me upgrade to Next.js 16
```

**What Happens:**
1. Checks current Next.js version
2. Runs official Next.js codemod automatically
3. Updates async APIs (params, searchParams, cookies, headers)
4. Migrates configuration changes
5. Fixes deprecated features
6. Provides step-by-step guidance

**Example Response (Since You're Already on 16.1.1):**
```json
{
  "current_version": "16.1.1",
  "target_version": "16.1.1",
  "status": "up_to_date",
  "message": "You're already on Next.js 16.1.1! No upgrade needed.",
  "compatibility": {
    "react": "19.2.7",
    "node": ">=24.12.0",
    "all_compatible": true
  }
}
```

**If Upgrade Was Needed:**
```json
{
  "current_version": "15.3.2",
  "target_version": "16.1.1",
  "steps": [
    {
      "step": 1,
      "action": "Run Next.js codemod",
      "status": "completed",
      "changes": [
        "Updated 45 files with async params/searchParams",
        "Fixed 12 deprecated API calls",
        "Updated next.config.js"
      ]
    },
    {
      "step": 2,
      "action": "Update dependencies",
      "status": "completed",
      "package": "next@16.1.1"
    }
  ],
  "summary": "Upgrade completed successfully!"
}
```

**Note:** This automates the entire Next.js 16 upgrade process!

---

## Feature 4: Cache Components Setup

### Enable Cache Components

**Ask in Cursor:**
```
Next Devtools, enable Cache Components in my Next.js 16 app
```

**What Happens:**
1. Pre-flight checks (package manager, Next.js version)
2. Enables Cache Components configuration
3. Starts dev server with MCP enabled
4. Automated route verification
5. Error detection and fixing
6. Intelligent Suspense boundary setup
7. Final verification and build testing

**Example Response (Automated Process):**
```json
{
  "phase": "setup",
  "project_path": "/home/joshua-v-dev/projects/RevealUI/apps/cms",
  "steps": [
    {
      "step": 1,
      "name": "preflight_checks",
      "status": "completed",
      "results": {
        "nextjs_version": "16.1.1",
        "package_manager": "pnpm",
        "typescript": true,
        "app_directory": true,
        "all_checks_passed": true
      }
    },
    {
      "step": 2,
      "name": "enable_config",
      "status": "completed",
      "changes": [
        "Updated next.config.mjs with cacheComponents: true"
      ]
    },
    {
      "step": 3,
      "name": "route_verification",
      "status": "completed",
      "routes_checked": 25,
      "issues_found": 3,
      "issues": [
        {
          "route": "app/(frontend)/[slug]/page.tsx",
          "issue": "Missing Suspense boundary",
          "severity": "error"
        },
        {
          "route": "app/api/users/me/route.ts",
          "issue": "Missing cache directive",
          "severity": "warning"
        }
      ]
    },
    {
      "step": 4,
      "name": "auto_fix",
      "status": "completed",
      "fixes_applied": [
        {
          "file": "app/(frontend)/[slug]/page.tsx",
          "fix": "Added Suspense boundary around dynamic content",
          "line": 18
        },
        {
          "file": "app/api/users/me/route.ts",
          "fix": "Added 'use cache' directive",
          "line": 5
        },
        {
          "file": "app/(frontend)/posts/[slug]/page.tsx",
          "fix": "Updated static params generation",
          "line": 12
        }
      ],
      "total_fixes": 3
    },
    {
      "step": 5,
      "name": "verification",
      "status": "completed",
      "build_passed": true,
      "errors": 0,
      "warnings": 2,
      "build_time": "8.4s"
    }
  ],
  "result": "success",
  "message": "Cache Components enabled successfully!",
  "next_steps": [
    "Run 'pnpm dev' to test locally",
    "Verify routes work correctly",
    "Check build output for any warnings"
  ]
}
```

**Key Point:** Complete automation - detects issues, fixes them, verifies everything works!

---

## Integration with Your CMS App

### Current Setup

Your CMS app (`apps/cms`) is perfectly configured for Next.js DevTools MCP:

```json
{
  "next": "16.1.1",  // Next.js 16+ required
  "dev": "next dev --turbo --port 4000"  // Standard port
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

### Integration Flow

```
Cursor AI
    ↓
Next.js DevTools MCP Server (mcp-next-devtools.ts)
    ↓
nextjs_index / nextjs_call tools
    ↓
HTTP Request to http://localhost:4000/_next/mcp
    ↓
Next.js 16 Dev Server (built-in MCP endpoint)
    ↓
Returns: Errors, Routes, Logs, etc.
    ↓
MCP Server formats response
    ↓
Cursor displays results
```

---

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

---

## Live Demonstration Script

To see this in action, follow these steps:

### Terminal Setup

```bash
# Terminal 1: Start CMS dev server
cd apps/cms
pnpm dev

# Terminal 2: Start Next.js DevTools MCP
pnpm mcp:next-devtools
```

### Try These Prompts in Cursor

**Prompt 1: Discovery**
```
Next Devtools, what servers are running?
```
Expected: Finds your CMS on port 4000 automatically

**Prompt 2: Error Reporting**
```
Next Devtools, what errors are in my Next.js app?
```
Expected: Shows all 104 TypeScript errors

**Prompt 3: Route Listing**
```
Next Devtools, show me my application routes
```
Expected: Displays all 25 routes in your CMS app

**Prompt 4: Log Access**
```
Next Devtools, what's in the dev server logs?
```
Expected: Shows dev server output and build messages

**Prompt 5: Cache Components**
```
Next Devtools, help me enable Cache Components
```
Expected: Runs automated setup with error fixing

---

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

---

## Verification Checklist

Use this to verify everything is working:

- [ ] CMS dev server running (`cd apps/cms && pnpm dev`)
- [ ] Next.js DevTools MCP running (`pnpm mcp:next-devtools`)
- [ ] MCP endpoint accessible (`curl http://localhost:4000/_next/mcp`)
- [ ] Can discover servers (ask: "what servers are running?")
- [ ] Can query errors (ask: "what errors are in my app?")
- [ ] Can view routes (ask: "show me my routes")

---

## Summary

**What You Get:**

1. **Auto-discovery** - Finds your CMS app automatically on port 4000
2. **Runtime diagnostics** - Real-time errors, routes, and logs
3. **Upgrade automation** - Guided Next.js 16 upgrade with codemods
4. **Cache Components** - Automated setup with intelligent error fixing
5. **Works with your CMS** - Next.js 16.1.1 fully compatible

**Key Benefits:**

- Zero configuration required
- Real-time diagnostics without terminal switching
- Automated error detection and fixing
- Complete visibility into application structure
- Seamless integration with your existing workflow

**No additional setup required** - just start your dev server and ask questions!

---

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

---

## Related Documentation

- [MCP Setup Guide](./MCP_SETUP.md) - Setting up MCP servers
- [Next.js DevTools Quickstart](./NEXTJS_DEVTOOLS_MCP_QUICKSTART.md) - Quick reference guide
- [MCP Quick Start](./QUICK_START.md) - Using configured MCP servers
- [Master Index](../INDEX.md) - Complete documentation index

## External Resources

- [Next.js DevTools MCP GitHub](https://github.com/vercel/next-devtools-mcp)
- [Next.js 16 MCP Documentation](https://nextjs.org/docs)
- [Model Context Protocol Spec](https://modelcontextprotocol.io)
