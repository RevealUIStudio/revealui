import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUsePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSelectedLayoutSegments: () => [],
}));

import { AdminBar } from '../index';

// Keep in lockstep with AUTH_PATHS in lib/auth/auth-paths.ts
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
  });

  it('does not probe /api/auth/me on auth routes', () => {
    mockUsePathname.mockReturnValue('/signup');
    render(<AdminBar />);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('mounts the bar shell on a content route (hidden until admin role confirmed)', () => {
    mockUsePathname.mockReturnValue('/posts/some-post');
    const { container } = render(<AdminBar />);
    // Outer wrapper renders; inner shell starts hidden (show=false) until /api/auth/me
    // confirms role === 'admin'. With the fetch mock pending, it stays hidden.
    expect(container.querySelector('.hidden')).not.toBeNull();
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

  it('renders "Exit Preview" markup when preview mode is enabled (visibility still gated by role)', () => {
    mockUsePathname.mockReturnValue('/posts/some-post');
    render(<AdminBar adminBarProps={{ preview: true }} />);
    // The button is in the DOM regardless of show; the show flag only toggles the
    // wrapper's block/hidden class. Role-gated visibility is asserted separately.
    expect(screen.getByText('Exit Preview')).toBeInTheDocument();
  });

  it('probes /api/auth/me on content routes', () => {
    mockUsePathname.mockReturnValue('/posts/some-post');
    render(<AdminBar />);
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.anything());
  });
});
