import { cleanup, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the logger
vi.mock('@revealui/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
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
} from '../components.js';
import { Router } from '../router.js';
import type { Route } from '../types.js';

afterEach(() => {
  cleanup();
  // Reset jsdom URL to / so tests don't leak navigation state
  window.history.pushState(null, '', '/');
});

function TestComponent({ params }: { params?: Record<string, string> }) {
  return <div data-testid="route-component">Hello {params?.name ?? 'World'}</div>;
}

function NotFoundComponent() {
  return <div data-testid="not-found">Custom 404</div>;
}

function LayoutComponent({ children }: { children: React.ReactNode }) {
  return <div data-testid="layout">{children}</div>;
}

function createRoute(path: string, overrides?: Partial<Route>): Route {
  return { path, component: TestComponent, ...overrides };
}

function renderWithRouter(ui: React.ReactNode, router: Router) {
  return render(<RouterProvider router={router}>{ui}</RouterProvider>);
}

describe('RouterProvider', () => {
  it('provides router context to children', () => {
    const router = new Router();
    function Child() {
      const r = useRouter();
      return <div data-testid="has-router">{r ? 'yes' : 'no'}</div>;
    }
    renderWithRouter(<Child />, router);
    expect(screen.getByTestId('has-router').textContent).toBe('yes');
  });
});

describe('useRouter', () => {
  it('throws when used outside RouterProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bad() {
      useRouter();
      return null;
    }
    expect(() => render(<Bad />)).toThrow('useRouter must be used within a RouterProvider');
    spy.mockRestore();
  });
});

describe('useMatch', () => {
  it('returns null when no match context', () => {
    const router = new Router();
    let match: unknown = 'not-set';
    function Child() {
      match = useMatch();
      return null;
    }
    renderWithRouter(<Child />, router);
    expect(match).toBeNull();
  });
});

describe('useParams', () => {
  it('returns empty object when no match', () => {
    const router = new Router();
    let params: unknown = 'not-set';
    function Child() {
      params = useParams();
      return null;
    }
    renderWithRouter(<Child />, router);
    expect(params).toEqual({});
  });
});

describe('Routes', () => {
  it('renders default NotFound when no routes match', () => {
    const router = new Router();
    renderWithRouter(<Routes />, router);
    expect(screen.getByText('404 - Page Not Found')).toBeDefined();
  });

  it('renders custom NotFound component when provided', () => {
    const router = new Router({ notFound: NotFoundComponent });
    renderWithRouter(<Routes />, router);
    expect(screen.getByTestId('not-found')).toBeDefined();
  });

  it('renders matched route component for current pathname', () => {
    const router = new Router();
    router.register(createRoute('/'));
    renderWithRouter(<Routes />, router);
    expect(screen.getByTestId('route-component')).toBeDefined();
  });

  it('renders route with layout when provided', () => {
    const router = new Router();
    router.register(createRoute('/', { layout: LayoutComponent }));
    renderWithRouter(<Routes />, router);
    expect(screen.getByTestId('layout')).toBeDefined();
    expect(screen.getByTestId('route-component')).toBeDefined();
  });

  it('renders route without layout when not provided', () => {
    const router = new Router();
    router.register(createRoute('/'));
    renderWithRouter(<Routes />, router);
    expect(screen.getByTestId('route-component')).toBeDefined();
    expect(screen.queryByTestId('layout')).toBeNull();
  });
});

describe('Link', () => {
  it('renders an anchor element with href', () => {
    const router = new Router();
    renderWithRouter(<Link to="/about">About</Link>, router);
    const link = screen.getByText('About');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/about');
  });

  it('calls router.navigate on left click', () => {
    const router = new Router();
    router.register(createRoute('/'));
    const navigateSpy = vi.spyOn(router, 'navigate');
    renderWithRouter(<Link to="/about">About</Link>, router);
    const link = screen.getByText('About');
    act(() => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    });
    expect(navigateSpy).toHaveBeenCalledWith('/about', { replace: false });
  });

  it('does not navigate on right click', () => {
    const router = new Router();
    const navigateSpy = vi.spyOn(router, 'navigate');
    renderWithRouter(<Link to="/about">About</Link>, router);
    const link = screen.getByText('About');
    act(() => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 2 }));
    });
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('does not navigate when meta key is pressed', () => {
    const router = new Router();
    const navigateSpy = vi.spyOn(router, 'navigate');
    renderWithRouter(<Link to="/about">About</Link>, router);
    const link = screen.getByText('About');
    act(() => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, metaKey: true }));
    });
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('calls custom onClick handler', () => {
    const router = new Router();
    const onClick = vi.fn();
    renderWithRouter(
      <Link to="/about" onClick={onClick}>
        About
      </Link>,
      router,
    );
    const link = screen.getByText('About');
    act(() => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    });
    expect(onClick).toHaveBeenCalled();
  });

  it('passes replace option to navigate', () => {
    const router = new Router();
    router.register(createRoute('/'));
    const navigateSpy = vi.spyOn(router, 'navigate');
    renderWithRouter(
      <Link to="/about" replace>
        About
      </Link>,
      router,
    );
    const link = screen.getByText('About');
    act(() => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    });
    expect(navigateSpy).toHaveBeenCalledWith('/about', { replace: true });
  });

  it('passes extra props to the anchor', () => {
    const router = new Router();
    renderWithRouter(
      <Link to="/about" data-testid="my-link" className="custom">
        About
      </Link>,
      router,
    );
    const link = screen.getByTestId('my-link');
    expect(link.className).toBe('custom');
  });
});

describe('Navigate', () => {
  it('calls router.navigate on mount', () => {
    const router = new Router();
    const navigateSpy = vi.spyOn(router, 'navigate');
    renderWithRouter(<Navigate to="/target" />, router);
    expect(navigateSpy).toHaveBeenCalledWith('/target', { replace: false });
  });

  it('calls router.navigate with replace option', () => {
    const router = new Router();
    const navigateSpy = vi.spyOn(router, 'navigate');
    renderWithRouter(<Navigate to="/target" replace />, router);
    expect(navigateSpy).toHaveBeenCalledWith('/target', { replace: true });
  });

  it('renders null', () => {
    const router = new Router();
    const { container } = renderWithRouter(<Navigate to="/target" />, router);
    expect(container.innerHTML).toBe('');
  });
});

describe('useNavigate', () => {
  it('returns a navigation function', () => {
    const router = new Router();
    const navigateSpy = vi.spyOn(router, 'navigate');
    let navigateFn: ((to: string) => void) | null = null;
    function Child() {
      navigateFn = useNavigate();
      return null;
    }
    renderWithRouter(<Child />, router);
    expect(typeof navigateFn).toBe('function');
    act(() => {
      navigateFn!('/somewhere');
    });
    expect(navigateSpy).toHaveBeenCalledWith('/somewhere', undefined);
  });
});

describe('useLocation', () => {
  it('returns current location with pathname, search, and hash', () => {
    const router = new Router();
    let location: { pathname: string; search: string; hash: string } | null = null;
    function Child() {
      location = useLocation();
      return null;
    }
    renderWithRouter(<Child />, router);
    expect(location).not.toBeNull();
    expect(typeof location!.pathname).toBe('string');
    expect(typeof location!.search).toBe('string');
    expect(typeof location!.hash).toBe('string');
  });
});

describe('useSearchParams', () => {
  it('returns URLSearchParams instance', () => {
    const router = new Router();
    let params: URLSearchParams | null = null;
    function Child() {
      params = useSearchParams();
      return null;
    }
    renderWithRouter(<Child />, router);
    expect(params).toBeInstanceOf(URLSearchParams);
  });
});

describe('useData', () => {
  it('returns undefined when no match context', () => {
    const router = new Router();
    let data: unknown = 'not-set';
    function Child() {
      data = useData();
      return null;
    }
    renderWithRouter(<Child />, router);
    expect(data).toBeUndefined();
  });
});

describe('Link edge cases', () => {
  it('does not navigate when ctrl key is pressed', () => {
    const router = new Router();
    const navigateSpy = vi.spyOn(router, 'navigate');
    renderWithRouter(<Link to="/about">About</Link>, router);
    const link = screen.getByText('About');
    act(() => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, ctrlKey: true }));
    });
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('does not navigate when shift key is pressed', () => {
    const router = new Router();
    const navigateSpy = vi.spyOn(router, 'navigate');
    renderWithRouter(<Link to="/about">About</Link>, router);
    const link = screen.getByText('About');
    act(() => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, shiftKey: true }));
    });
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('does not navigate when alt key is pressed', () => {
    const router = new Router();
    const navigateSpy = vi.spyOn(router, 'navigate');
    renderWithRouter(<Link to="/about">About</Link>, router);
    const link = screen.getByText('About');
    act(() => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, altKey: true }));
    });
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('does not navigate when default is prevented by onClick handler', () => {
    const router = new Router();
    const navigateSpy = vi.spyOn(router, 'navigate');
    renderWithRouter(
      <Link to="/about" onClick={(e) => e.preventDefault()}>
        About
      </Link>,
      router,
    );
    const link = screen.getByText('About');
    act(() => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

describe('Routes with error boundary', () => {
  it('renders error boundary fallback when route component throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function ErrorComponent(): React.ReactNode {
      throw new Error('Component exploded');
    }
    function ErrorFallback({ error }: { error: Error }) {
      return <div data-testid="error-fallback">{error.message}</div>;
    }
    const router = new Router({ errorBoundary: ErrorFallback });
    router.register({ path: '/', component: ErrorComponent });
    renderWithRouter(<Routes />, router);
    expect(screen.getByTestId('error-fallback').textContent).toBe('Component exploded');
    spy.mockRestore();
  });

  it('renders route normally when no error and error boundary is configured', () => {
    function ErrorFallback({ error }: { error: Error }) {
      return <div data-testid="error-fallback">{error.message}</div>;
    }
    const router = new Router({ errorBoundary: ErrorFallback });
    router.register(createRoute('/'));
    renderWithRouter(<Routes />, router);
    expect(screen.getByTestId('route-component')).toBeDefined();
    expect(screen.queryByTestId('error-fallback')).toBeNull();
  });
});

describe('Routes passes data and params to component', () => {
  it('passes params to route component', () => {
    function ParamsComponent({ params }: { params?: Record<string, string> }) {
      return <div data-testid="params-display">{params?.id ?? 'none'}</div>;
    }
    const router = new Router();
    // Register route and navigate so getCurrentMatch returns params
    router.register({ path: '/posts/:id', component: ParamsComponent });
    // Resolve to seed currentMatch
    router.navigate('/posts/42');
    renderWithRouter(<Routes />, router);
    expect(screen.getByTestId('params-display').textContent).toBe('42');
  });
});
