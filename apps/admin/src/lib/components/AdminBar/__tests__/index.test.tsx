import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUsePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSelectedLayoutSegments: () => [],
}));

import { AdminBar } from '../index';

// Mirrors AUTH_ROUTES in ../index — the bar must never render on these pages.
const AUTH_ROUTES = [
  '/login',
  '/signup',
  '/setup',
  '/mfa',
  '/rotate-password',
  '/forgot-password',
  '/reset-password',
];

beforeEach(() => {
  vi.clearAllMocks();
  // The bar's inner component probes GET /api/auth/me on mount. Keep that promise
  // pending so no post-render state update (setShow) fires during the synchronous
  // assertions below.
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>(() => {
          // Intentionally never settles — see comment above.
        }),
    ),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AdminBar', () => {
  it.each(AUTH_ROUTES)('renders nothing on auth route %s', (route) => {
    mockUsePathname.mockReturnValue(route);
    const { container } = render(<AdminBar />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Exit Preview')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('does not probe /api/auth/me on auth routes', () => {
    mockUsePathname.mockReturnValue('/signup');
    render(<AdminBar />);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('renders the bar on a content route', () => {
    mockUsePathname.mockReturnValue('/posts/some-post');
    render(<AdminBar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders the bar on the dashboard root', () => {
    mockUsePathname.mockReturnValue('/');
    render(<AdminBar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('hides "Exit Preview" on a content route when preview mode is not enabled', () => {
    mockUsePathname.mockReturnValue('/posts/some-post');
    render(<AdminBar />);
    expect(screen.queryByText('Exit Preview')).not.toBeInTheDocument();
  });

  it('hides "Exit Preview" when preview is explicitly false', () => {
    mockUsePathname.mockReturnValue('/posts/some-post');
    render(<AdminBar adminBarProps={{ preview: false }} />);
    expect(screen.queryByText('Exit Preview')).not.toBeInTheDocument();
  });

  it('shows "Exit Preview" only when preview mode is enabled', () => {
    mockUsePathname.mockReturnValue('/posts/some-post');
    render(<AdminBar adminBarProps={{ preview: true }} />);
    expect(screen.getByText('Exit Preview')).toBeInTheDocument();
  });

  it('probes /api/auth/me on content routes', () => {
    mockUsePathname.mockReturnValue('/posts/some-post');
    render(<AdminBar />);
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.anything());
  });
});
