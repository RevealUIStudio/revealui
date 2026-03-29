import type React from 'react';
import {
  Component,
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { Router } from './router';
import type { Location, NavigateOptions, RouteMatch } from './types';

/**
 * Router context
 */
const RouterContext = createContext<Router | null>(null);

/**
 * Current match context
 */
const MatchContext = createContext<RouteMatch | null>(null);

/**
 * RouterProvider - Provides router instance to the app
 */
export function RouterProvider({
  router,
  children,
}: {
  router: Router;
  children: React.ReactNode;
}) {
  return <RouterContext.Provider value={router}>{children}</RouterContext.Provider>;
}

/**
 * Routes - Renders the matched route component
 */
export function Routes() {
  const router = useRouter();
  const options = router.getOptions();

  // Subscribe to router changes
  const match = useSyncExternalStore(
    (callback) => router.subscribe(callback),
    () => router.getCurrentMatch(),
    () => router.getCurrentMatch(), // Server-side snapshot (same as client)
  );

  if (!match) {
    const CustomNotFound = options.notFound;
    return CustomNotFound ? <CustomNotFound /> : <NotFound />;
  }

  const { route, params, data } = match;
  const RouteComponent = route.component;
  const Layout = route.layout;

  const element = <RouteComponent params={params} data={data} />;
  const wrapped = Layout ? <Layout>{element}</Layout> : element;

  return (
    <MatchContext.Provider value={match}>
      {options.errorBoundary ? (
        <RouteErrorBoundary fallback={options.errorBoundary}>{wrapped}</RouteErrorBoundary>
      ) : (
        wrapped
      )}
    </MatchContext.Provider>
  );
}

interface LinkProps extends Record<string, unknown> {
  to: string;
  replace?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
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
}: LinkProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Call custom onClick if provided
    onClick?.(e);

    // Don't navigate if default was prevented
    if (e.defaultPrevented) {
      return;
    }

    // Only handle left clicks
    if (e.button !== 0) {
      return;
    }

    // Ignore if modifier keys are pressed
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }

    e.preventDefault();
    router.navigate(to, { replace });
  };

  return (
    <a href={to} onClick={handleClick} className={className} style={style} {...props}>
      {children}
    </a>
  );
}

/**
 * useRouter - Hook to access router instance
 */
export function useRouter(): Router {
  const router = use(RouterContext);

  if (!router) {
    throw new Error('useRouter must be used within a RouterProvider');
  }

  return router;
}

/**
 * useMatch - Hook to access current route match
 */
export function useMatch(): RouteMatch | null {
  return use(MatchContext);
}

/**
 * useParams - Hook to access route parameters
 */
export function useParams<T = Record<string, string>>(): T {
  const match = useMatch();
  return (match?.params as T) || ({} as T);
}

/**
 * useData - Hook to access route data
 */
export function useData<T = unknown>(): T | undefined {
  const match = useMatch();
  return match?.data as T | undefined;
}

/**
 * useNavigate - Hook to get navigation function
 */
export function useNavigate(): (to: string, options?: NavigateOptions) => void {
  const router = useRouter();

  return (to: string, options?: NavigateOptions) => {
    router.navigate(to, options);
  };
}

const SERVER_LOCATION: Location = { pathname: '/', search: '', hash: '' };

function getWindowLocation(): Location {
  if (typeof window === 'undefined') return SERVER_LOCATION;
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
}

/**
 * useLocation - Hook to access current location (pathname, search, hash).
 * Returns a stable reference that only changes when the URL actually changes.
 */
export function useLocation(): Location {
  const router = useRouter();
  const locationRef = useRef<Location>(getWindowLocation());

  // Re-subscribe on route changes to detect URL updates
  useSyncExternalStore(
    (callback) => router.subscribe(callback),
    () => {
      if (typeof window === 'undefined') return '/';
      return window.location.pathname + window.location.search + window.location.hash;
    },
    () => '/',
  );

  const current = getWindowLocation();
  if (
    current.pathname !== locationRef.current.pathname ||
    current.search !== locationRef.current.search ||
    current.hash !== locationRef.current.hash
  ) {
    locationRef.current = current;
  }

  return locationRef.current;
}

/**
 * useSearchParams - Hook to access parsed query string parameters
 */
export function useSearchParams(): URLSearchParams {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
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
  );
}

/**
 * RouteErrorBoundary - Catches render errors in route components
 */
class RouteErrorBoundary extends Component<
  { fallback: React.ComponentType<{ error: Error }>; children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: {
    fallback: React.ComponentType<{ error: Error }>;
    children: React.ReactNode;
  }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  render() {
    if (this.state.error) {
      const Fallback = this.props.fallback;
      return <Fallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

/**
 * Navigate - Component for declarative navigation
 */
export function Navigate({ to, replace = false }: { to: string; replace?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    router.navigate(to, { replace });
  }, [to, replace, router]);

  return null;
}
