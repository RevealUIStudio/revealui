/**
 * Tests for DocLayout component
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// Mock @revealui/router
vi.mock('@revealui/router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: '/auth' }),
  useNavigate: () => vi.fn(),
}));

// Mock SearchBar (lazy-loaded in DocLayout)
vi.mock('../../app/components/SearchBar', () => ({
  SearchBar: () => <div data-testid="search-bar">SearchBar</div>,
}));

import {
  DOCS_BOUNDARY_LINE,
  DOCS_CHROME,
  STUDIO_BLOG_HREF,
} from '../../../../packages/contracts/src/nav-docs-boundary.ts';
import { DocLayout } from '../../app/components/DocLayout';

describe('DocLayout', () => {
  it('should render children in the main content area', () => {
    render(
      <DocLayout>
        <div>Test content</div>
      </DocLayout>,
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('uses a logo-only home link with an accessible name', () => {
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    const homeLinks = screen.getAllByRole('link', { name: 'RevealUI' });
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
    expect(homeLinks.every((link) => link.getAttribute('href') === '/')).toBe(true);
    expect(screen.queryByText('RevealUI')).toBeNull();
    expect(screen.queryByText('RevealUI Studio')).toBeNull();
  });

  it('renders the untiled Circuit-R master at 48px instead of IconCode', () => {
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    const homeLinks = screen.getAllByRole('link', { name: 'RevealUI' });
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of homeLinks) {
      const light = link.querySelector('img[src="/revealui-logo.svg"]');
      const dark = link.querySelector('img[src="/revealui-logo-dark.svg"]');
      expect(light).toBeTruthy();
      expect(dark).toBeTruthy();
      expect(light).toHaveAttribute('width', '48');
      expect(light).toHaveAttribute('height', '48');
      expect(dark).toHaveAttribute('width', '48');
      expect(dark).toHaveAttribute('height', '48');
      expect(light?.getAttribute('class') ?? '').not.toContain('w-auto');
      expect(dark?.getAttribute('class') ?? '').not.toContain('w-auto');
      const chrome = link.querySelector('[data-circuit-r-chrome]');
      expect(chrome).toBeTruthy();
      expect(chrome?.getAttribute('class') ?? '').toContain('overflow-hidden');
      expect(chrome).toHaveStyle({ width: '48px', height: '48px' });
      expect(link.querySelector('svg[viewBox="0 0 24 24"]')).toBeNull();
      expect(link.querySelector('img[src="/apple-touch-icon.png"]')).toBeNull();
    }
  });

  it('should render navigation sections', () => {
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    expect(screen.getAllByText('Getting Started').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Core Guides').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Architecture').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Reference').length).toBeGreaterThanOrEqual(1);
  });

  it('renders category titles as prominent collapsible controls', () => {
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    const gettingStarted = screen.getByRole('button', { name: 'Getting Started' });
    expect(gettingStarted).toHaveAttribute('aria-expanded', 'false');
    expect(gettingStarted.className).toContain('text-base');
    expect(gettingStarted.className).toContain('font-bold');
    expect(gettingStarted.className).toContain('text-ink');
    expect(gettingStarted.className).toContain('mt-6');
    expect(gettingStarted.className).not.toContain('uppercase');
    expect(gettingStarted.className).not.toContain('tracking-widest');
    expect(gettingStarted.className).not.toContain('text-text-muted');

    const coreGuides = screen.getByRole('button', { name: 'Core Guides' });
    expect(coreGuides).toHaveAttribute('aria-expanded', 'true');
    expect(coreGuides).toHaveAttribute('aria-controls');
  });

  it('shows links for the open section and reveals a collapsed section on click', async () => {
    const user = userEvent.setup();
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    expect(screen.getByRole('link', { name: 'Database' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Quick Start' })).toBeNull();
    expect(screen.getAllByText(DOCS_CHROME.docsHomeLabel).length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole('button', { name: 'Getting Started' }));

    expect(screen.getByRole('link', { name: 'Quick Start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Getting Started' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Core Guides' }));

    expect(screen.queryByRole('link', { name: 'Database' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Core Guides' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('keeps Blog off the docs pillar and points Studio outbound', () => {
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    expect(screen.queryByRole('button', { name: DOCS_CHROME.blogLabel })).toBeNull();
    expect(screen.queryByRole('link', { name: 'UI of the Future' })).toBeNull();
    const blog = screen.queryByRole('link', { name: DOCS_CHROME.blogLabel });
    if (blog) {
      expect(blog.getAttribute('href')).toBe(STUDIO_BLOG_HREF);
    }
    const docsHome = screen.getAllByRole('link', { name: DOCS_CHROME.docsHomeLabel });
    expect(docsHome.length).toBeGreaterThanOrEqual(1);
    expect(docsHome.every((link) => link.getAttribute('href') === '/')).toBe(true);
    expect(screen.getByRole('link', { name: DOCS_CHROME.studioLabel }).getAttribute('href')).toBe(
      DOCS_CHROME.studioHref,
    );
    expect(screen.getByText(DOCS_BOUNDARY_LINE)).toBeInTheDocument();
  });

  it('should render quiet GitHub and website links in the sidebar', () => {
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    expect(screen.getAllByText('GitHub').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('revealui.com')).toBeInTheDocument();
  });

  it('renders a one-line legal footer without a product wordmark', () => {
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('Privacy');
    expect(footer).toHaveTextContent('Terms');
    expect(footer).toHaveTextContent('Cookies');
    expect(footer).toHaveTextContent('REVEALUI STUDIO L.L.C.');
    expect(footer).not.toHaveTextContent('RevealUI Studio');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      'https://revealui.com/privacy',
    );
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute(
      'href',
      'https://revealui.com/terms',
    );
    expect(screen.getByRole('link', { name: 'Cookies' })).toHaveAttribute(
      'href',
      'https://revealui.com/cookies',
    );
  });

  it('does not render marketing CTAs in the docs chrome', () => {
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    expect(screen.queryByRole('link', { name: 'Start free' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Book an intro' })).toBeNull();
  });

  it('should highlight the active nav link based on current path', () => {
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    const authLinks = screen.getAllByText('Authentication');
    // At least one Authentication link should have the active styling class
    const hasActiveLink = authLinks.some((link) => link.className.includes('font-semibold'));
    expect(hasActiveLink).toBe(true);
  });
});
