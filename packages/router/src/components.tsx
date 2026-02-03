import type React from 'react'
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'
import type { Router } from './router'
import type { NavigateOptions, RouteMatch } from './types'

/**
 * Router context
 */
const RouterContext = createContext<Router | null>(null)

/**
 * Current match context
 */
const MatchContext = createContext<RouteMatch | null>(null)

/**
 * RouterProvider - Provides router instance to the app
 */
export function RouterProvider({
  router,
  children,
}: {
  router: Router
  children: React.ReactNode
}) {
  return <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
}

/**
 * Routes - Renders the matched route component
 */
export function Routes() {
  const router = useRouter()

  // Subscribe to router changes
  const match = useSyncExternalStore(
    (callback) => router.subscribe(callback),
    () => router.getCurrentMatch(),
    () => router.getCurrentMatch(), // Server-side snapshot (same as client)
  )

  if (!match) {
    return <NotFound />
  }

  const { route, params, data } = match
  const Component = route.component
  const Layout = route.layout

  const element = <Component params={params} data={data} />

  return (
    <MatchContext.Provider value={match}>
      {Layout ? <Layout>{element}</Layout> : element}
    </MatchContext.Provider>
  )
}

/**
 * Link - Client-side navigation link
 */
export function Link({
  to,
  replace = false,
  children,
  className,
  style,
  onClick,
  ...props
}: {
  to: string
  replace?: boolean
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  [key: string]: any
}) {
  const router = useRouter()

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Call custom onClick if provided
    onClick?.(e)

    // Don't navigate if default was prevented
    if (e.defaultPrevented) {
      return
    }

    // Only handle left clicks
    if (e.button !== 0) {
      return
    }

    // Ignore if modifier keys are pressed
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return
    }

    e.preventDefault()
    router.navigate(to, { replace })
  }

  return (
    <a href={to} onClick={handleClick} className={className} style={style} {...props}>
      {children}
    </a>
  )
}

/**
 * useRouter - Hook to access router instance
 */
export function useRouter(): Router {
  const router = useContext(RouterContext)

  if (!router) {
    throw new Error('useRouter must be used within a RouterProvider')
  }

  return router
}

/**
 * useMatch - Hook to access current route match
 */
export function useMatch(): RouteMatch | null {
  return useContext(MatchContext)
}

/**
 * useParams - Hook to access route parameters
 */
export function useParams<T = Record<string, string>>(): T {
  const match = useMatch()
  return (match?.params as T) || ({} as T)
}

/**
 * useData - Hook to access route data
 */
export function useData<T = any>(): T | undefined {
  const match = useMatch()
  return match?.data as T | undefined
}

/**
 * useNavigate - Hook to get navigation function
 */
export function useNavigate() {
  const router = useRouter()

  return (to: string, options?: NavigateOptions) => {
    router.navigate(to, options)
  }
}

/**
 * NotFound - Default 404 component
 */
function NotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/">Go Home</Link>
    </div>
  )
}

/**
 * Navigate - Component for declarative navigation
 */
export function Navigate({ to, replace = false }: { to: string; replace?: boolean }) {
  const router = useRouter()

  useEffect(() => {
    router.navigate(to, { replace })
  }, [to, replace, router])

  return null
}
