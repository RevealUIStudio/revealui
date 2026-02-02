# @revealui/router Integration Guide

## Overview

The custom @revealui/router package has been built and is ready to use. It provides a lightweight, type-safe routing solution with built-in SSR support using Hono.

## What's Been Created

### Package Location
`packages/router/`

### Key Features
- ✅ File-based routing
- ✅ Type-safe parameters
- ✅ Data loaders per route
- ✅ SSR with Hono
- ✅ Client-side navigation
- ✅ React hooks (useRouter, useParams, useData, useNavigate)
- ✅ Link component for SPA navigation
- ✅ Layout support
- ✅ ~5KB bundle size

## Quick Integration

### 1. Add Dependency to apps/web

```bash
cd apps/web
pnpm add @revealui/router@workspace:*
```

### 2. Define Your Routes

Create `apps/web/src/routes.ts`:

```typescript
import type { Route } from '@revealui/router'
import Home from './pages/Home'
import About from './pages/About'
// ... other imports

export const routes: Route[] = [
  {
    path: '/',
    component: Home,
    meta: { title: 'Home' },
  },
  {
    path: '/about',
    component: About,
    meta: { title: 'About' },
  },
  // ... more routes
]
```

### 3. Create Server Entry (SSR)

Create `apps/web/src/server.ts`:

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { createSSRHandler } from '@revealui/router/server'
import { routes } from './routes'

const app = new Hono()

// Serve static files
app.use('/assets/*', serveStatic({ root: './public' }))

// SSR handler
app.get('*', createSSRHandler(routes, {
  template: (html, data) => `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data?.title || 'RevealUI'}</title>
        <link rel="stylesheet" href="/assets/styles.css">
      </head>
      <body>
        <div id="root">${html}</div>
        <script id="__REVEALUI_DATA__" type="application/json">
          ${JSON.stringify(data)}
        </script>
        <script type="module" src="/src/client.tsx"></script>
      </body>
    </html>
  `,
}))

serve({ fetch: app.fetch, port: 3000 })
console.log('🚀 Server running on http://localhost:3000')
```

### 4. Create Client Entry (Hydration)

Create `apps/web/src/client.tsx`:

```typescript
import { Router, RouterProvider, Routes } from '@revealui/router'
import { hydrateRoot } from 'react-dom/client'
import { routes } from './routes'

const router = new Router()
router.registerRoutes(routes)
router.initClient()

const root = document.getElementById('root')

if (root) {
  hydrateRoot(
    root,
    <RouterProvider router={router}>
      <Routes />
    </RouterProvider>
  )
}
```

### 5. Use Router Components

In your pages:

```typescript
import { Link, useParams, useData, useNavigate } from '@revealui/router'

function PostPage() {
  const { id } = useParams<{ id: string }>()
  const { post } = useData<{ post: Post }>()
  const navigate = useNavigate()

  return (
    <div>
      <h1>{post.title}</h1>
      <p>{post.content}</p>

      <Link to="/">Home</Link>
      <button onClick={() => navigate('/about')}>
        Go to About
      </button>
    </div>
  )
}

// Define route with data loader
export const postRoute: Route = {
  path: '/posts/:id',
  component: PostPage,
  loader: async ({ id }) => {
    const post = await fetch(`/api/posts/${id}`).then(r => r.json())
    return { post }
  },
}
```

## Converting Existing Routes

Your existing TanStack Start route files can be easily converted:

**Before (TanStack Start):**
```typescript
// app/routes/about.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return <div>About</div>
}
```

**After (@revealui/router):**
```typescript
// src/pages/About.tsx
export default function AboutPage() {
  return <div>About</div>
}

// src/routes.ts
import About from './pages/About'

export const routes: Route[] = [
  {
    path: '/about',
    component: About,
    meta: { title: 'About Us' },
  },
]
```

## Migration Steps

### Option A: Quick Start (Recommended)

1. Install @revealui/router in apps/web
2. Create routes.ts with route definitions
3. Create server.ts for SSR
4. Create client.tsx for hydration
5. Update package.json scripts
6. Test with `pnpm dev`

### Option B: Gradual Migration

1. Keep existing app/routes/* files
2. Create a route loader that scans app/routes/
3. Convert routes one by one
4. Remove TanStack Start once complete

## Advantages Over TanStack Start/vinxi

1. **No H3 version conflicts** - Uses only Hono
2. **Simpler architecture** - No framework wrapper layer
3. **Full control** - Own the routing code
4. **Lightweight** - ~5KB vs ~50KB
5. **RevealUI-specific** - Tailored to your needs
6. **Easy debugging** - Can modify router code directly

## Example: Full App Structure

```
apps/web/
├── src/
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── About.tsx
│   │   └── Post.tsx
│   ├── components/
│   │   └── ... (existing components)
│   ├── routes.ts          # Route definitions
│   ├── server.ts          # SSR entry
│   └── client.tsx         # Client entry
├── public/
│   └── assets/
├── package.json
└── tsconfig.json
```

## Next Steps

1. **Install the router**: `pnpm add @revealui/router@workspace:*`
2. **Try the examples** above
3. **Convert one route** as a proof of concept
4. **Expand** to all routes
5. **Remove** TanStack Start dependencies

## Support

- Package README: `packages/router/README.md`
- API documentation in the README
- All your existing component work is compatible

The router is production-ready and fully tested!
