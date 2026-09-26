import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BrandedAuthLayout } from '../BrandedAuthLayout';

describe('BrandedAuthLayout', () => {
  afterEach(() => {
    delete process.env.REVEALUI_BRAND_LOGO_URL;
    delete process.env.REVEALUI_BRAND_NAME;
    delete process.env.REVEALUI_TENANT_NAME;
    delete process.env.REVEALUI_TENANT_HIDE_NAME;
    delete process.env.REVEALUI_TENANT_TAGLINE;
    delete process.env.REVEALUI_BRAND_PRIMARY_COLOR;
    delete process.env.REVEALUI_TENANT_BRAND;
    delete process.env.REVEALUI_SHOW_POWERED_BY;
  });

  it('renders the canonical circuit emblem when no tenant logo is set', () => {
    render(
      <BrandedAuthLayout>
        <p>form</p>
      </BrandedAuthLayout>,
    );
    const mark = document.querySelector('img[src="/revealui-logo.svg"]');
    expect(mark).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'RevealUI' })).toBeTruthy();
  });

  it('ignores an invalid brand color when choosing the brand surface', () => {
    process.env.REVEALUI_BRAND_PRIMARY_COLOR = '#fff; } body { background: red }';
    const { container } = render(
      <BrandedAuthLayout>
        <p>form</p>
      </BrandedAuthLayout>,
    );
    const panel = container.querySelector('aside');
    expect(panel?.getAttribute('data-theme')).toBe('dark');
    expect(panel?.className).toContain('bg-[var(--rvui-surface-0)]');
  });

  it('uses the tenant surface when the brand color is a valid hex', () => {
    process.env.REVEALUI_TENANT_BRAND = '#1a56db';
    const { container } = render(
      <BrandedAuthLayout>
        <p>form</p>
      </BrandedAuthLayout>,
    );
    const panel = container.querySelector('aside');
    expect(panel?.getAttribute('data-theme')).toBeNull();
    expect(panel?.className).toContain('bg-[var(--tenant-brand,var(--rvui-surface-3))]');
  });

  it('prefers a tenant logo URL when set', () => {
    process.env.REVEALUI_BRAND_LOGO_URL = 'https://cdn.example.com/acme.svg';
    process.env.REVEALUI_TENANT_NAME = 'Acme';
    render(
      <BrandedAuthLayout>
        <p>form</p>
      </BrandedAuthLayout>,
    );
    expect(screen.getByRole('img', { name: 'Acme' }).getAttribute('src')).toBe(
      'https://cdn.example.com/acme.svg',
    );
  });
});
