import '@testing-library/jest-dom/vitest';
import { Router, RouterProvider } from '@revealui/router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SITE } from '../../content/site';
import { HomePage } from '../HomePage';
import { PricingPage } from '../PricingPage';

afterEach(cleanup);

function renderRouted(ui: React.ReactElement) {
  return render(<RouterProvider router={new Router()}>{ui}</RouterProvider>);
}

function forbiddenOnPublicRoutes(root: HTMLElement): void {
  const text = root.textContent ?? '';
  const html = root.innerHTML;
  expect(text.includes('$25,000')).toBe(false);
  expect(text.includes('$50,000')).toBe(false);
  expect(text.includes('$8,499')).toBe(false);
  expect(text.includes('Starter Kit')).toBe(false);
  expect(text.includes('Agency Founding Kit')).toBe(false);
  expect(text.includes('Architecture Review')).toBe(false);
  expect(text.includes('Fleet from')).toBe(false);
  expect(text.includes('Custom from')).toBe(false);
  expect(html.includes('cal.com/revealuistudio')).toBe(false);
  expect(text.includes('Add up what you would otherwise rent')).toBe(false);
  expect(text.toLowerCase().includes('hipaa')).toBe(false);
  expect(text.toLowerCase().includes('soc 2')).toBe(false);
  expect(text.includes('24/7')).toBe(false);
}

describe('public product catalog routes', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve(null) }),
    );
  });

  it('home keeps the product hero, quote calculator, and catalog teaser', () => {
    const { container } = renderRouted(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    const startFree = screen.getAllByRole('link', { name: /start free/i });
    expect(startFree.length).toBeGreaterThan(0);
    expect(startFree.every((link) => link.getAttribute('href') === SITE.urls.signup)).toBe(true);
    expect(screen.getByRole('link', { name: 'See it on GitHub' })).toBeInTheDocument();
    const selfHost = screen.getByRole('radio', { name: /I will \(developer/i });
    expect(selfHost).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('$300')).toBeNull();
    expect(screen.queryByText('$3,500')).toBeNull();
    expect(screen.queryByText('$7,500')).toBeNull();
    forbiddenOnPublicRoutes(container);
  });

  it('pricing is the license catalog plus the quote calculator', async () => {
    const { container } = renderRouted(<PricingPage />);
    expect(await screen.findByRole('heading', { name: 'Pro' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'revealuistudio.com' })).toHaveAttribute(
      'href',
      SITE.urls.agency,
    );
    expect(screen.getByRole('radio', { name: /You will \(Studio\)/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /I will \(developer/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    forbiddenOnPublicRoutes(container);
  });

  it('footer is Docs, Pricing, Support plus a one-line legal strip', () => {
    renderRouted(<HomePage />);
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent ?? '').toContain('Docs');
    expect(footer.textContent ?? '').toContain('Pricing');
    expect(footer.textContent ?? '').toContain('Support');
    expect(footer.textContent ?? '').not.toContain('Legal');
    expect(footer.textContent ?? '').toContain('Privacy');
    expect(footer.textContent ?? '').toContain('Cookies');
    expect(footer.textContent ?? '').toContain('Terms');
    expect(footer.textContent ?? '').toContain('Refund');
    expect(footer.textContent ?? '').toContain('REVEALUI STUDIO L.L.C.');
    expect(footer.textContent ?? '').not.toContain('Built with RevealUI');
    expect(footer.textContent ?? '').not.toContain('HIPAA');
    expect(footer.textContent ?? '').not.toContain('Products');
    expect(footer.textContent ?? '').not.toContain('Services');
  });
});
