/**
 * @revealui/router - Lightweight file-based routing with SSR support
 *
 * @example
 * ```typescript
 * import { Router, RouterProvider, Routes, Link } from '@revealui/router'
 *
 * const router = new Router()
 *
 * router.register({
 *   path: '/',
 *   component: Home,
 * })
 *
 * router.register({
 *   path: '/about',
 *   component: About,
 * })
 *
 * // In your app
 * <RouterProvider router={router}>
 *   <Routes />
 * </RouterProvider>
 * ```
 */

// Core router
export { Router } from './router'

// React components and hooks
export {
  RouterProvider,
  Routes,
  Link,
  Navigate,
  useRouter,
  useMatch,
  useParams,
  useData,
  useNavigate,
} from './components'

// Types
export type {
  Route,
  RouteParams,
  RouteMeta,
  RouteMatch,
  RouterOptions,
  NavigateOptions,
} from './types'
