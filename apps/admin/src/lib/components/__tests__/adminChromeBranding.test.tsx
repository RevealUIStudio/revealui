import { AdminDashboard, generatePageMetadata } from '@revealui/core/admin';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminSidebarLayout } from '../AdminSidebarLayout';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

const licenseMock = vi.hoisted(() => ({
  tier: 'pro' as string,
  features: {} as Record<string, unknown>,
  isLoading: false,
  resolveError: null as null | string,
  refetch: () => {},
}));

vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => licenseMock,
}));

vi.mock('@revealui/auth/react', () => ({
  useSignOut: () => ({
    signOut: vi.fn(async () => {}),
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../WeeklyUsageChrome', () => ({
  WeeklyUsageChrome: () => <div data-testid="weekly-usage-chrome" />,
}));

// The admin chrome must show the kit's brand, never the framework name,
// when tenant identity is configured (canonical default otherwise).

const ENV_KEYS = ['REVEALUI_BRAND_NAME', 'REVEALUI_TENANT_NAME'] as const;
const saved: Record<string, string | undefined> = {};

describe('admin chrome white-label branding', () => {
  beforeEach(() => {
    licenseMock.tier = 'pro';
    licenseMock.isLoading = false;
    licenseMock.resolveError = null;
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  describe('AdminSidebarLayout', () => {
    it('renders the tenant name in the wordmark and footer with no framework leak', () => {
      render(<AdminSidebarLayout siteName="Acme">content</AdminSidebarLayout>);
      expect(screen.getByText('Acme')).toBeDefined();
      expect(screen.getByText('Acme Admin')).toBeDefined();
      expect(screen.queryByText(/RevealUI/)).toBeNull();
    });

    it('mounts weekly usage chrome in the sidebar', () => {
      render(<AdminSidebarLayout>content</AdminSidebarLayout>);
      expect(screen.getAllByTestId('weekly-usage-chrome').length).toBeGreaterThan(0);
    });

    it('keeps the canonical wordmark by default', () => {
      render(<AdminSidebarLayout>content</AdminSidebarLayout>);
      expect(screen.getByText('RevealUI')).toBeDefined();
      expect(screen.getByText('RevealUI Admin')).toBeDefined();
    });

    it('does not show app version in the footer or over nav icons', () => {
      render(<AdminSidebarLayout siteName="Acme">content</AdminSidebarLayout>);
      expect(screen.getByText('Acme Admin')).toBeDefined();
      expect(screen.getByText('Settings')).toBeDefined();
      expect(screen.queryByText(/^v\d/)).toBeNull();
    });

    it('labels Marketplace as preview so nav does not imply live execution', () => {
      render(<AdminSidebarLayout siteName="Acme">content</AdminSidebarLayout>);
      expect(screen.getByText('Marketplace (preview)')).toBeDefined();
      expect(screen.queryByText(/^Marketplace$/)).toBeNull();
    });

    it('labels the knowledge graph nav as RevMind', () => {
      render(<AdminSidebarLayout siteName="Acme">content</AdminSidebarLayout>);
      expect(screen.getByText('RevMind')).toBeDefined();
    });

    it('puts Sign out in the sidebar footer', () => {
      render(<AdminSidebarLayout siteName="Acme">content</AdminSidebarLayout>);
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
    });

    it('shows Upgrade for free/pro when a higher tier exists', () => {
      licenseMock.tier = 'free';
      licenseMock.isLoading = false;
      licenseMock.resolveError = null;
      render(<AdminSidebarLayout>content</AdminSidebarLayout>);
      expect(screen.getByText('Upgrade')).toBeDefined();
    });

    it('hides Upgrade for enterprise (founder / top tier)', () => {
      licenseMock.tier = 'enterprise';
      licenseMock.isLoading = false;
      licenseMock.resolveError = null;
      render(<AdminSidebarLayout>content</AdminSidebarLayout>);
      expect(screen.queryByText('Upgrade')).toBeNull();
    });

    it('hides Upgrade for max when only enterprise remains above', () => {
      // getTiersFromCurrent('max') still returns enterprise — product choice:
      // still show Upgrade for max so Max can buy Enterprise.
      licenseMock.tier = 'max';
      licenseMock.isLoading = false;
      licenseMock.resolveError = null;
      render(<AdminSidebarLayout>content</AdminSidebarLayout>);
      expect(screen.getByText('Upgrade')).toBeDefined();
    });
  });

  describe('AdminDashboard', () => {
    it('uses Overview as the page title and brands the subtitle from siteName', () => {
      render(<AdminDashboard config={{ collections: [], globals: [] } as never} siteName="Acme" />);
      expect(screen.getByRole('heading', { name: 'Overview' })).toBeDefined();
      expect(screen.getByText('Collections, globals, and system status for Acme.')).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Acme Admin' })).toBeNull();
      expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull();
    });

    it('defaults the overview subtitle to the canonical site name', () => {
      render(<AdminDashboard config={{ collections: [], globals: [] } as never} />);
      expect(screen.getByRole('heading', { name: 'Overview' })).toBeDefined();
      expect(
        screen.getByText('Collections, globals, and system status for RevealUI.'),
      ).toBeDefined();
    });

    it('groups collections into the Operate / Build / Configure taxonomy', () => {
      const collections = [
        // versioned -> worked day to day -> Operate
        { slug: 'orders', fields: [], versions: { drafts: true } },
        // auth -> identity and access -> Configure
        { slug: 'users', fields: [], auth: {} },
        // no auth/versions -> catalog structure -> Build
        { slug: 'products', fields: [] },
      ];
      render(<AdminDashboard config={{ collections, globals: [] } as never} />);

      const operate = screen.getByRole('region', { name: 'Operate' });
      const build = screen.getByRole('region', { name: 'Build' });
      const configure = screen.getByRole('region', { name: 'Configure' });

      expect(within(operate).getByText('orders')).toBeDefined();
      expect(within(build).getByText('products')).toBeDefined();
      expect(within(configure).getByText('users')).toBeDefined();
    });

    it('omits empty taxonomy groups instead of rendering blank cards', () => {
      const collections = [{ slug: 'products', fields: [] }];
      render(<AdminDashboard config={{ collections, globals: [] } as never} />);

      expect(screen.getByRole('region', { name: 'Build' })).toBeDefined();
      expect(screen.queryByRole('region', { name: 'Operate' })).toBeNull();
      expect(screen.queryByRole('region', { name: 'Configure' })).toBeNull();
    });

    it('renders system status as a StatusDot-led card, not a prose sentence', () => {
      render(<AdminDashboard config={{ collections: [], globals: [] } as never} siteName="Acme" />);

      expect(screen.getByRole('heading', { name: 'System status' })).toBeDefined();
      expect(screen.getByRole('img', { name: 'System status: Healthy' })).toBeDefined();
      // The old hardcoded "{siteName} admin is running successfully" prose line is gone.
      expect(screen.queryByText(/admin is running successfully/)).toBeNull();
    });

    it('links the media collection to the media library, not the generic editor (GAP-452)', () => {
      const collections = [
        { slug: 'media', fields: [], upload: {} },
        { slug: 'products', fields: [] },
      ];
      render(<AdminDashboard config={{ collections, globals: [] } as never} />);

      const mediaLink = screen.getByRole('link', { name: 'media' });
      expect(mediaLink).toHaveAttribute('href', '/media');
      // Non-overridden collections stay in-app clickable rows, not links.
      expect(screen.getByRole('button', { name: 'products' })).toBeDefined();
      expect(screen.queryByRole('link', { name: 'products' })).toBeNull();
    });
  });

  describe('generatePageMetadata', () => {
    it('brands the title from REVEALUI_TENANT_NAME', () => {
      process.env.REVEALUI_TENANT_NAME = 'Acme';
      delete process.env.REVEALUI_BRAND_NAME;
      expect(generatePageMetadata().title).toBe('Acme Admin');
    });

    it('treats compose-injected empty strings as unset', () => {
      // Docker Compose `${VAR:-}` interpolation delivers unset vars as ''.
      process.env.REVEALUI_BRAND_NAME = '';
      process.env.REVEALUI_TENANT_NAME = 'Acme';
      expect(generatePageMetadata().title).toBe('Acme Admin');
    });

    it('defaults to the canonical title', () => {
      delete process.env.REVEALUI_BRAND_NAME;
      delete process.env.REVEALUI_TENANT_NAME;
      expect(generatePageMetadata().title).toBe('RevealUI Admin');
    });
  });
});
