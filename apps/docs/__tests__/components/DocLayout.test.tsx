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
  useLocation: () => ({ pathname: '/docs/AUTH' }),
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

  it('should render the sidebar with RevealUI branding', () => {
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    expect(screen.getAllByText('RevealUI').length).toBeGreaterThanOrEqual(1);
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

  it('should render footer links to GitHub and website', () => {
    render(
      <DocLayout>
        <div>Content</div>
      </DocLayout>,
    );

    expect(screen.getAllByText('GitHub').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('revealui.com')).toBeInTheDocument();
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
