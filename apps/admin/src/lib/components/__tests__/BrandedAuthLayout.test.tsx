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
