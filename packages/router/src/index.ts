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

// React components and hooks
export {
  Link,
  Navigate,
  RouterProvider,
  Routes,
  useData,
  useMatch,
  useNavigate,
  useParams,
  useRouter,
} from './components';
// Core router
export { Router } from './router';

// Types
export type {
  NavigateOptions,
  Route,
  RouteMatch,
  RouteMeta,
  RouteParams,
  RouterOptions,
} from './types';
