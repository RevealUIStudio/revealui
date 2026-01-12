# Next.js DevTools MCP - Quick Start Guide

## 🎯 See It In Action Right Now

### Step 1: Start Your CMS Dev Server

```bash
cd apps/cms
pnpm dev
```

This starts your Next.js 16.1.1 CMS app on `http://localhost:4000` with the built-in MCP endpoint at `/_next/mcp`.

### Step 2: Start Next.js DevTools MCP Server

```bash
# In another terminal
pnpm mcp:next-devtools
```

Or start all MCP servers:
```bash
pnpm mcp:all
```

### Step 3: Try These Commands in Cursor

Once both are running, you can ask in Cursor:

#### 🔍 Auto-Discovery
```
Next Devtools, what servers are running?
```
**Shows:** All Next.js 16+ dev servers with their ports, tools, and metadata

#### 🐛 Runtime Diagnostics - Errors
```
Next Devtools, what errors are in my Next.js app?
```
**Shows:** Real-time build and runtime errors from your CMS app

#### 🗺️ Runtime Diagnostics - Routes  
```
Next Devtools, show me my application routes
```
**Shows:** All routes, pages, API endpoints, and dynamic segments

#### 📋 Runtime Diagnostics - Logs
```
Next Devtools, what's in the dev server logs?
```
**Shows:** Recent development server output and messages

#### 🚀 Upgrade Automation
```
Next Devtools, help me upgrade to Next.js 16
```
**Does:** Automated upgrade with codemods (you're already on 16.1.1, so it confirms!)

#### ⚡ Cache Components Setup
```
Next Devtools, enable Cache Components in my Next.js 16 app
```
**Does:** Complete automated setup with error detection and fixing

---

## 📊 What Each Feature Does

### ✅ Auto-Discovery

The MCP server automatically scans and discovers:
- Next.js 16+ dev servers on common ports (3000, 4000, 5000, etc.)
- Server metadata (port, PID, URL, version)
- Available diagnostic tools on each server

**No configuration needed** - it just works!

### ✅ Runtime Diagnostics

When your CMS dev server is running, you get:
- **Real-time errors** - See build/runtime errors as they happen
- **Route discovery** - Complete application route structure
- **Server logs** - Development server output
- **Server Actions** - Discover and inspect Server Actions
- **Component tree** - Application component hierarchy

### ✅ Upgrade Automation

The `upgrade_nextjs_16` tool:
- ✅ Checks your current version (16.1.1 - already up to date!)
- ✅ Runs official Next.js codemods automatically
- ✅ Updates async APIs (params, searchParams are Promises)
- ✅ Migrates configuration
- ✅ Fixes deprecated features
- ✅ Guides you through React 19 compatibility

### ✅ Cache Components Setup

The `enable_cache_components` tool:
- ✅ Pre-flight compatibility checks
- ✅ Enables Cache Components configuration
- ✅ Starts dev server with MCP enabled
- ✅ Automated route verification
- ✅ **Auto-detects and fixes errors** with intelligent:
  - Suspense boundary setup
  - Caching directive placement
  - Static params configuration
- ✅ Final verification and build testing

---

## 🔧 How It Works with Your CMS App

Your CMS app (`apps/cms`) is **perfectly configured**:

```json
{
  "next": "16.1.1",           // ✅ Next.js 16+ required
  "dev": "next dev --turbo --port 4000"  // ✅ Standard setup
}
```

### Next.js 16 Built-in MCP Endpoint

Next.js 16 automatically provides an MCP endpoint:
- **URL:** `http://localhost:4000/_next/mcp`
- **Available when:** Dev server is running
- **Provides:** Runtime diagnostics, errors, routes, logs

### Integration Flow

```
Cursor AI
    ↓
Next.js DevTools MCP Server (pnpm mcp:next-devtools)
    ↓
Discovers: http://localhost:4000/_next/mcp
    ↓
Your CMS App (Next.js 16.1.1)
    ↓
Returns: Errors, Routes, Logs, etc.
```

---

## 🎬 Try It Now!

1. **Start CMS:** `cd apps/cms && pnpm dev`
2. **Start MCP:** `pnpm mcp:next-devtools` 
3. **Ask in Cursor:** "Next Devtools, what servers are running?"

You should see:
```json
{
  "servers": [{
    "port": 4000,
    "url": "http://localhost:4000",
    "version": "16.1.1",
    "tools": ["get_errors", "get_routes", "get_logs", ...]
  }]
}
```

---

## 📚 Full Documentation

See `docs/NEXTJS_DEVTOOLS_MCP_DEMO.md` for complete examples and workflows.

---

**Everything is ready! Just start your dev server and the MCP will discover it automatically!** 🚀
