# Next.js DevTools MCP - Interactive Demonstration

## 🎯 What You'll See in Action

This guide shows exactly how Next.js DevTools MCP works with your CMS app.

---

## 📋 Prerequisites Check

Run this to verify everything is ready:

```bash
# 1. Check if CMS dev server should be running
cd apps/cms
pnpm dev  # Should run on http://localhost:4000

# 2. Check MCP endpoint (in another terminal)
curl http://localhost:4000/_next/mcp
```

---

## 🚀 Feature Demonstrations

### Feature 1: Auto-Discovery of Running Servers

**What happens:**
When you ask "Next Devtools, what servers are running?", the MCP server:

1. **Scans common ports** (3000, 3001, 4000, 5000, etc.)
2. **Detects Next.js 16+ servers** by checking `/_next/mcp` endpoint
3. **Returns server metadata**:
   ```json
   {
     "servers": [
       {
         "port": 4000,
         "pid": 12345,
         "url": "http://localhost:4000",
         "version": "16.1.1",
         "tools": [
           "get_errors",
           "get_routes",
           "get_logs",
           "get_server_actions",
           "get_component_tree"
         ]
       }
     ]
   }
   ```

**Try it:**
1. Start CMS: `cd apps/cms && pnpm dev`
2. Start MCP: `pnpm mcp:next-devtools`
3. In Cursor, ask: "Next Devtools, what servers are running?"

---

### Feature 2: Runtime Diagnostics - Errors

**Example: Query Current Errors**

**You ask:**
```
Next Devtools, what errors are in my Next.js app?
```

**MCP Process:**
1. Calls `nextjs_index` → Finds server on port 4000
2. Calls `nextjs_call` with `toolName: "get_errors"`
3. Connects to `http://localhost:4000/_next/mcp`
4. Returns real-time errors

**Example Response:**
```json
{
  "errors": [
    {
      "type": "build",
      "severity": "error",
      "message": "Type error: Property 'id' does not exist on type 'RevealDocument'",
      "file": "apps/cms/src/lib/hooks/populateArchiveBlock.ts",
      "line": 67,
      "column": 41,
      "code": "TS2339"
    },
    {
      "type": "runtime",
      "severity": "warning",
      "message": "Unused variable 'data'",
      "file": "apps/cms/src/app/api/chat/route.ts",
      "line": 85
    }
  ],
  "total": 2,
  "errors_count": 1,
  "warnings_count": 1
}
```

**This gives you real-time error information from your running dev server!**

---

### Feature 2: Runtime Diagnostics - Routes

**Example: View Application Routes**

**You ask:**
```
Next Devtools, show me my application routes
```

**MCP Process:**
1. Discovers server on port 4000
2. Calls `nextjs_call` with `toolName: "get_routes"`
3. Queries the Next.js dev server's route information

**Example Response:**
```json
{
  "routes": [
    {
      "path": "/",
      "type": "page",
      "file": "app/(frontend)/[slug]/page.tsx",
      "dynamic": true,
      "segment": "[slug]"
    },
    {
      "path": "/admin",
      "type": "page",
      "file": "app/(backend)/admin/[[...segments]]/page.tsx",
      "dynamic": true,
      "catchAll": true
    },
    {
      "path": "/api/users/me",
      "type": "route",
      "method": "GET",
      "file": "app/api/users/me/route.ts"
    },
    {
      "path": "/api/chat",
      "type": "route",
      "method": "POST",
      "file": "app/api/chat/route.ts"
    },
    {
      "path": "/posts/[slug]",
      "type": "page",
      "file": "app/(frontend)/posts/[slug]/page.tsx",
      "dynamic": true
    }
  ],
  "total": 25,
  "pages": 15,
  "api_routes": 10
}
```

**This shows the complete route structure of your CMS app!**

---

### Feature 2: Runtime Diagnostics - Logs

**Example: Check Dev Server Logs**

**You ask:**
```
Next Devtools, what's in the dev server logs?
```

**MCP Process:**
1. Discovers server
2. Calls `get_logs` tool
3. Retrieves recent development server output

**Example Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-01-06T18:42:15.123Z",
      "level": "info",
      "message": "✓ Compiled /api/users/me in 234ms"
    },
    {
      "timestamp": "2025-01-06T18:42:20.456Z",
      "level": "warn",
      "message": "Fast Refresh had to perform a full reload"
    },
    {
      "timestamp": "2025-01-06T18:42:25.789Z",
      "level": "error",
      "message": "Type error in populateArchiveBlock.ts:67"
    }
  ],
  "count": 50,
  "errors": 1,
  "warnings": 5
}
```

**Real-time access to what's happening in your dev server!**

---

### Feature 3: Upgrade Automation

**Example: Upgrade to Next.js 16**

**You ask:**
```
Next Devtools, help me upgrade to Next.js 16
```

**MCP Process:**
1. Checks current Next.js version (you have 16.1.1, so it confirms you're up to date)
2. If older version, runs codemod automatically
3. Updates all async APIs
4. Migrates configuration

**Example Response (if upgrade needed):**
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

**Automated upgrade with zero manual work!**

---

### Feature 4: Cache Components Setup

**Example: Enable Cache Components**

**You ask:**
```
Next Devtools, enable Cache Components in my Next.js 16 app
```

**MCP Process:**
1. Pre-flight checks (Next.js version, package manager)
2. Enables Cache Components in config
3. Starts dev server with MCP enabled
4. Scans routes for issues
5. **Automatically fixes errors** by adding Suspense boundaries
6. Verifies everything works

**Example Response:**
```json
{
  "phase": "setup",
  "steps": [
    {
      "step": "preflight",
      "status": "completed",
      "nextjs_version": "16.1.1",
      "package_manager": "pnpm"
    },
    {
      "step": "enable_config",
      "status": "completed",
      "config_updated": true
    },
    {
      "step": "route_verification",
      "status": "completed",
      "routes_checked": 25,
      "issues_found": 3
    },
    {
      "step": "auto_fix",
      "status": "completed",
      "fixes_applied": [
        "Added Suspense boundary to app/(frontend)/[slug]/page.tsx",
        "Added 'use cache' directive to app/api/users/me/route.ts",
        "Fixed static params in app/(frontend)/posts/[slug]/page.tsx"
      ]
    },
    {
      "step": "verification",
      "status": "completed",
      "build_passed": true,
      "errors": 0
    }
  ],
  "result": "Cache Components enabled successfully!"
}
```

**Complete automation with error detection and fixing!**

---

## 🎬 Live Demonstration Script

To see this in action:

```bash
# Terminal 1: Start CMS dev server
cd apps/cms
pnpm dev

# Terminal 2: Start Next.js DevTools MCP
pnpm mcp:next-devtools

# In Cursor, try these prompts:
```

**Prompt 1:**
```
Next Devtools, what servers are running?
```

**Prompt 2:**
```
Next Devtools, what errors are in my Next.js app?
```

**Prompt 3:**
```
Next Devtools, show me my application routes
```

**Prompt 4:**
```
Next Devtools, what's in the dev server logs?
```

**Prompt 5:**
```
Next Devtools, help me enable Cache Components
```

---

## 🔍 How It Works Under the Hood

### Architecture Flow

```
Your Question in Cursor
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

### Next.js 16 Built-in MCP Endpoint

Next.js 16 automatically exposes an MCP endpoint at `/_next/mcp` when:
- Dev server is running
- Next.js version is 16.0.0+
- Server is accessible on localhost

This endpoint provides:
- Runtime diagnostics
- Build information
- Route metadata
- Error reporting
- Server Action discovery

---

## ✅ Verification Checklist

Use this to verify everything is working:

- [ ] CMS dev server running (`cd apps/cms && pnpm dev`)
- [ ] Next.js DevTools MCP running (`pnpm mcp:next-devtools`)
- [ ] MCP endpoint accessible (`curl http://localhost:4000/_next/mcp`)
- [ ] Can discover servers (ask: "what servers are running?")
- [ ] Can query errors (ask: "what errors are in my app?")
- [ ] Can view routes (ask: "show me my routes")

---

## 📚 Additional Resources

- [Next.js DevTools MCP GitHub](https://github.com/vercel/next-devtools-mcp)
- [Next.js 16 Documentation](https://nextjs.org/docs)
- Your CMS app: `apps/cms` (Next.js 16.1.1)

---

**Now try it yourself!** Start your dev server and ask the Next.js DevTools MCP about your app! 🚀
