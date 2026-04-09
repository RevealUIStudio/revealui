/**
 * @revealui/router — File-based routing for React apps
 *
 * Works with Vite, Hono, or any React setup. No framework required.
 *
 * Features:
 * - Named params (`:id`), wildcards (`*path`), optional segments (`{/...}`)
 * - Nested routes with composable layouts
 * - Data loaders (async, per-route)
 * - Middleware chain (global + per-route, supports redirects)
 * - SSR with streaming support (Hono integration)
 * - Client-side navigation (History API, link interception)
 * - React 18/19 compatible (useSyncExternalStore)
 *
 * @example
 * ```tsx
 * import { Router, RouterProvider, Routes, Link } from '@revealui/router'
 *
 * const router = new Router()
 *
 * router.register({ path: '/', component: Home })
 * router.register({ path: '/about', component: About })
 * router.register({
 *   path: '/posts/:id',
 *   component: Post,
 *   loader: ({ id }) => fetch(`/api/posts/${id}`).then(r => r.json()),
 * })
 *
 * function App() {
 *   return (
 *     <RouterProvider router={router}>
 *       <nav><Link href="/">Home</Link></nav>
 *       <Routes />
 *     </RouterProvider>
 *   )
 * }
 * ```
 */

// React components and hooks
export {
  Link,
  Navigate,
  RouterProvider,
  Routes,
  useData,
  useLocation,
  useMatch,
  useNavigate,
  useParams,
  useRouter,
  useSearchParams,
} from './components';
// Core router
export { Router } from './router';

// Types
export type {
  Location,
  MiddlewareContext,
  NavigateOptions,
  Route,
  RouteMatch,
  RouteMeta,
  RouteMiddleware,
  RouteParams,
  RouterOptions,
} from './types';
