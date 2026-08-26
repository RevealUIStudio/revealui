/**
 * Tests for DocLayout component
 */

import { render, screen } from '@testing-library/react';
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

  it('renders an untiled Circuit-R at about 36px instead of IconCode', () => {
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    const homeLinks = screen.getAllByRole('link', { name: 'RevealUI' });
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of homeLinks) {
      const mark = link.querySelector('svg');
      expect(mark).toBeTruthy();
      expect(mark).toHaveAttribute('viewBox', '0 0 512 512');
      expect(mark?.className.baseVal ?? mark?.getAttribute('class') ?? '').toContain('h-[36px]');
      expect(link.querySelector('svg[viewBox="0 0 24 24"]')).toBeNull();
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

  it('should render navigation links', () => {
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    expect(screen.getAllByText('Quick Start').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Authentication').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getAllByText('Home').length).toBeGreaterThanOrEqual(1);
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
