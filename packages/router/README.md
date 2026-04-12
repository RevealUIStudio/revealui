# @revealui/router

Lightweight file-based router for React apps with SSR, data loaders, middleware, and nested layouts. No framework required  -  works with Vite, Hono, or any React setup.

## Features

- **File-based routing**  -  named params (`:id`), wildcards (`*path`), optional segments
- **Nested routes**  -  composable layouts that stack automatically
- **Data loaders**  -  async per-route data loading with typed access via `useData()`
- **Middleware**  -  global + per-route, supports blocking and redirects
- **SSR + streaming**  -  Hono integration with `renderToReadableStream`
- **Client-side navigation**  -  History API, link interception, back/forward
- **Type-safe**  -  full TypeScript support, generic route data types
- **React 18/19**  -  uses `useSyncExternalStore` for stable rendering

## Installation

```bash
pnpm add @revealui/router
```

## Quick Start

### 1. Define Your Routes

```typescript
import { Router, type Route } from '@revealui/router'
import Home from './pages/Home'
import About from './pages/About'
import Post from './pages/Post'

const routes: Route[] = [
  {
    path: '/',
    component: Home,
    meta: { title: 'Home' },
  },
  {
    path: '/about',
    component: About,
    meta: { title: 'About Us' },
  },
  {
    path: '/posts/:id',
    component: Post,
    loader: async ({ id }) => {
      const post = await fetch(`/api/posts/${id}`).then(r => r.json())
      return { post }
    },
  },
]

const router = new Router()
router.registerRoutes(routes)
```

### 2. Client-Side Usage

```typescript
import { RouterProvider, Routes, Link } from '@revealui/router'

function App() {
  return (
    <RouterProvider router={router}>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <Routes />
    </RouterProvider>
  )
}
```

### 3. Server-Side Rendering (SSR)

```typescript
import { Hono } from 'hono'
import { createSSRHandler } from '@revealui/router/server'
import routes from './routes'

const app = new Hono()

app.get('*', createSSRHandler(routes, {
  template: (html, data) => `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${data?.title || 'My App'}</title>
      </head>
      <body>
        <div id="root">${html}</div>
        <script id="__REVEALUI_DATA__" type="application/json">
          ${JSON.stringify(data)}
        </script>
        <script type="module" src="/client.js"></script>
      </body>
    </html>
  `,
}))
```

## API Reference

### Router

```typescript
const router = new Router(options)
```

**Methods:**

- `register(route: Route)` - Register a single route
- `registerRoutes(routes: Route[])` - Register multiple routes
- `match(url: string)` - Match a URL to a route
- `resolve(url: string)` - Match and load route data
- `navigate(url: string, options?)` - Client-side navigation
- `back()` / `forward()` - Browser history navigation
- `subscribe(listener)` - Subscribe to route changes
- `initClient()` - Initialize client-side routing

### Components

#### `<RouterProvider>`

Provides router instance to your app:

```typescript
<RouterProvider router={router}>
  <App />
</RouterProvider>
```

#### `<Routes>`

Renders the matched route component:

```typescript
<Routes />
```

#### `<Link>`

Client-side navigation link:

```typescript
<Link to="/about" replace={false}>
  About Us
</Link>
```

#### `<Navigate>`

Declarative navigation:

```typescript
<Navigate to="/login" replace />
```

### Hooks

#### `useRouter()`

Access the router instance:

```typescript
const router = useRouter()
router.navigate('/about')
```

#### `useParams()`

Get route parameters:

```typescript
const { id } = useParams<{ id: string }>()
```

#### `useData()`

Get route data from loader:

```typescript
const { post } = useData<{ post: Post }>()
```

#### `useMatch()`

Get current route match:

```typescript
const match = useMatch()
console.log(match?.route.path, match?.params)
```

#### `useNavigate()`

Get navigation function:

```typescript
const navigate = useNavigate()
navigate('/about', { replace: true })
```

## Route Patterns

Supports path-to-regexp patterns:

```typescript
'/posts/:id'           // Named parameter
'/posts/:id?'          // Optional parameter
'/posts/:id(\\d+)'     // Parameter with regex
'/posts/*'             // Wildcard
'/posts/:path*'        // Wildcard with name
```

## Data Loading

Routes can have loaders for data fetching:

```typescript
{
  path: '/user/:id',
  component: UserProfile,
  loader: async ({ id }) => {
    const user = await fetchUser(id)
    return { user }
  },
}
```

Access data in your component:

```typescript
function UserProfile() {
  const { user } = useData<{ user: User }>()
  return <div>{user.name}</div>
}
```

## Layouts

Wrap routes with layouts:

```typescript
{
  path: '/dashboard',
  component: Dashboard,
  layout: DashboardLayout,
}
```

Layout component:

```typescript
function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>{children}</main>
    </div>
  )
}
```

## SSR with Streaming

Enable streaming SSR for better performance:

```typescript
createSSRHandler(routes, {
  streaming: true,
  onError: (error, context) => {
    console.error('SSR Error:', error)
  },
})
```

## Dev Server

Quick development server:

```typescript
import { createDevServer } from '@revealui/router/server'

await createDevServer(routes, {
  port: 3000,
  template: (html, data) => `...`,
})
```

## Integration with RevealUI

Works seamlessly with other RevealUI packages:

```typescript
import { Router } from '@revealui/router'
import { getRevealUI } from '@revealui/core'

const router = new Router()

router.register({
  path: '/cms/:slug',
  component: CMSPage,
  loader: async ({ slug }) => {
    const revealui = await getRevealUI()
    const page = await revealui.find({
      collection: 'pages',
      where: { slug: { equals: slug } },
    })
    return { page: page.docs[0] }
  },
})
```

## TypeScript

Full type safety:

```typescript
import type { Route, RouteParams } from '@revealui/router'

interface PostParams extends RouteParams {
  id: string
}

const route: Route = {
  path: '/posts/:id',
  component: Post,
  loader: async (params: PostParams) => {
    // params.id is typed as string
    return { post: await fetchPost(params.id) }
  },
}
```

## Comparison with Other Routers

| Feature | @revealui/router | TanStack Router | React Router |
|---------|-----------------|-----------------|--------------|
| Bundle Size | ~5KB | ~50KB | ~20KB |
| SSR Built-in | ✅ | ⚠️ Requires Start | ⚠️ Complex setup |
| Type Safety | ✅ | ✅ | ⚠️ Limited |
| Data Loading | ✅ | ✅ | ✅ |
| Learning Curve | Low | Medium | Low |

## When to Use This

- You need a lightweight, type-safe router with built-in SSR for a Hono + React app
- You want file-based routing conventions with data loaders and layouts
- You need a ~5KB router that avoids the bundle size of React Router or TanStack Router
- **Not** for Next.js apps  -  Next.js has its own App Router
- **Not** for API-only services  -  use Hono's native routing directly

## JOSHUA Alignment

- **Orthogonal**: Routing, data loading, and SSR are cleanly separated  -  loaders run independently of components
- **Hermetic**: SSR hydration uses a sealed data channel (`__REVEALUI_DATA__`) with no implicit global state
- **Sovereign**: No framework lock-in  -  works with any Hono server and standard React

## License

MIT - RevealUI

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md)
