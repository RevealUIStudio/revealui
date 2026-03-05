# @revealui/router

Lightweight client-side router with SSR support. Built on `path-to-regexp` — no heavy dependencies.

```bash
npm install @revealui/router
```

## Subpath Exports

| Import path | Environment | Purpose |
|-------------|-------------|---------|
| `@revealui/router` | Both | Components, hooks, Router class |
| `@revealui/router/server` | Server only | SSR rendering utilities |

---

## Setup

```tsx
import { Router, RouterProvider, Routes } from '@revealui/router'

const router = new Router({ basePath: '' })

router.registerRoutes([
  { path: '/',           component: HomePage },
  { path: '/about',      component: AboutPage },
  { path: '/posts/:id',  component: PostPage },
])

export function App() {
  return (
    <RouterProvider router={router}>
      <Routes />
    </RouterProvider>
  )
}
```

---

## Core Class

### `new Router(options?)`

Creates a router instance. Pass it to `<RouterProvider>`.

```ts
import { Router } from '@revealui/router'

const router = new Router({
  basePath: '/app',  // optional URL prefix
})
```

**`RouterOptions`:**
```ts
interface RouterOptions {
  basePath?: string  // strip this prefix from all matched paths
}
```

---

### `router.register(route)`

Registers a single route.

```ts
router.register({
  path: '/posts/:id',
  component: PostPage,
  loader: async ({ params }) => {
    return fetch(`/api/posts/${params.id}`).then(r => r.json())
  },
})
```

**`Route`:**
```ts
interface Route {
  path: string
  component: React.ComponentType
  loader?: (match: RouteMatch) => Promise<unknown>
}
```

---

### `router.registerRoutes(routes)`

Registers multiple routes at once.

```ts
router.registerRoutes([
  { path: '/', component: Home },
  { path: '/about', component: About },
])
```

---

### `router.match(url)`

Matches a URL string against registered routes. Returns a `RouteMatch` or `null`.

```ts
const match = router.match('/posts/42')
// { route: { path: '/posts/:id', ... }, params: { id: '42' } }
```

**`RouteMatch`:**
```ts
interface RouteMatch {
  route: Route
  params: RouteParams          // e.g. { id: '42' }
}
```

---

### `router.navigate(url, options?)`

Programmatically navigate to a URL. Updates `window.history`.

```ts
router.navigate('/dashboard')
router.navigate('/login', { replace: true })     // replaces history entry
router.navigate('/settings', { state: { tab: 'billing' } })
```

**`NavigateOptions`:**
```ts
interface NavigateOptions {
  replace?: boolean
  state?: unknown
}
```

---

### `router.subscribe(listener)` / `router.unsubscribe(listener)`

Listen for route changes (e.g. to sync with external state).

```ts
const cleanup = router.subscribe(() => {
  console.log('Route changed to', window.location.pathname)
})

// Later:
cleanup()
```

---

## React Components

### `<RouterProvider router={router}>`

Provides the router instance to all child components via context. Wrap your entire app.

```tsx
import { RouterProvider } from '@revealui/router'

<RouterProvider router={router}>
  <App />
</RouterProvider>
```

---

### `<Routes />`

Renders the component matched by the current URL. Place this where you want page content to appear.

```tsx
import { Routes } from '@revealui/router'

function Layout() {
  return (
    <div>
      <Navbar />
      <main>
        <Routes />
      </main>
    </div>
  )
}
```

---

### `<Link href>`

Client-side navigation link. Intercepts clicks to use `router.navigate()` instead of full page reloads.

```tsx
import { Link } from '@revealui/router'

<Link href="/dashboard">Dashboard</Link>
<Link href="/posts/42" className="text-blue-500">Read post</Link>
```

---

### `<Navigate to>`

Declarative redirect. Navigates on render.

```tsx
import { Navigate } from '@revealui/router'

if (!user) {
  return <Navigate to="/login" />
}
```

---

## React Hooks

### `useRouter()`

Returns the `Router` instance from context.

```ts
import { useRouter } from '@revealui/router'

const router = useRouter()
router.navigate('/settings')
```

---

### `useNavigate()`

Returns a `navigate` function bound to the current router.

```ts
import { useNavigate } from '@revealui/router'

const navigate = useNavigate()

function handleSubmit() {
  await savePost()
  navigate('/posts')
}
```

---

### `useParams()`

Returns the dynamic route parameters from the current match.

```ts
import { useParams } from '@revealui/router'

// Route: /posts/:id
const { id } = useParams<{ id: string }>()
```

---

### `useMatch()`

Returns the current `RouteMatch` object (route + params).

```ts
import { useMatch } from '@revealui/router'

const match = useMatch()
// { route: { path: '/posts/:id', ... }, params: { id: '42' } }
```

---

### `useData()`

Returns the data resolved by the current route's `loader` function.

```ts
import { useData } from '@revealui/router'

// Route loader: async ({ params }) => fetchPost(params.id)
const post = useData<Post>()
```

---

## Server-Side Rendering

Import from `@revealui/router/server`. The router integrates with Hono for SSR.

### `createSSRHandler(routes, options?): HonoHandler`

Creates a Hono request handler that matches the URL, runs the route loader, renders to an HTML string (or streams), and inlines loader data for hydration. Uses `react-dom/server` under the hood.

```ts
import { createSSRHandler } from '@revealui/router/server'
import { Hono } from 'hono'
import { routes } from './routes'

const app = new Hono()
app.get('*', createSSRHandler(routes, {
  template: (html, data) => `<!DOCTYPE html>
<html><head><title>${data?.title ?? 'App'}</title></head>
<body><div id="root">${html}</div>
<script type="module" src="/src/client.tsx"></script>
</body></html>`,
}))
```

**`SSROptions`:**
```ts
interface SSROptions {
  /** HTML template function — receives rendered HTML + loader data */
  template?: (html: string, data?: Record<string, unknown>) => string
  /** Enable streaming SSR via renderToPipeableStream */
  streaming?: boolean
  /** Error handler */
  onError?: (error: Error, context: Context) => void
}
```

---

### `createDevServer(routes, options?): Promise<void>`

Starts a local development server with HMR support. Wraps Hono + Vite middleware.

```ts
import { createDevServer } from '@revealui/router/server'
import { routes } from './routes'

await createDevServer(routes, { port: 3000 })
```

---

### `hydrate(router?, rootElement?): Promise<void>`

Hydrates the server-rendered HTML on the client. Call this in your client entry point.

```ts
// src/client.tsx
import { hydrate } from '@revealui/router/server'

await hydrate()  // auto-detects router + #root element
```

---

## Types

```ts
import type { Route, RouteMatch, RouteParams, RouterOptions, NavigateOptions } from '@revealui/router'
```

---

## Related

- [`@revealui/core`](/reference/core) — Uses the router for admin UI routing
- [`@revealui/presentation`](/reference/presentation) — `Link`, `Navbar`, and `Sidebar` integrate with the router
