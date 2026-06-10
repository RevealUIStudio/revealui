import { AdminDashboard, generatePageMetadata } from '@revealui/core/admin';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminSidebarLayout } from '../AdminSidebarLayout';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// The admin chrome must show the kit's brand, never the framework name,
// when tenant identity is configured (canonical default otherwise).

const ENV_KEYS = ['REVEALUI_BRAND_NAME', 'REVEALUI_TENANT_NAME'] as const;
const saved: Record<string, string | undefined> = {};

describe('admin chrome white-label branding', () => {
  beforeEach(() => {
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

    it('keeps the canonical wordmark by default', () => {
      render(<AdminSidebarLayout>content</AdminSidebarLayout>);
      expect(screen.getByText('RevealUI')).toBeDefined();
      expect(screen.getByText('RevealUI Admin')).toBeDefined();
    });
  });

  describe('AdminDashboard', () => {
    it('brands the top-bar heading and status copy from the siteName prop', () => {
      render(<AdminDashboard config={{ collections: [], globals: [] } as never} siteName="Acme" />);
      expect(screen.getByRole('heading', { name: 'Acme Admin' })).toBeDefined();
      expect(screen.queryByText(/RevealUI/)).toBeNull();
    });

    it('defaults to the canonical heading', () => {
      render(<AdminDashboard config={{ collections: [], globals: [] } as never} />);
      expect(screen.getByRole('heading', { name: 'RevealUI Admin' })).toBeDefined();
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
