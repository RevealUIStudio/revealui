import '@testing-library/jest-dom/vitest';
import { Router, RouterProvider } from '@revealui/router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QUOTE_CALCULATOR } from '../../content/quote-calculator';
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
  expect(html.includes('https://calendar.google.com/')).toBe(true);
  expect(text.includes('Fleet from')).toBe(false);
  expect(text.includes('Custom from')).toBe(false);
  expect(text.toLowerCase().includes('hipaa')).toBe(false);
  expect(text.toLowerCase().includes('soc 2')).toBe(false);
  expect(text.includes('24/7')).toBe(false);
}

describe('public product routes (founder weekend spec)', () => {
  it('home has one headline, the calculator defaulting to I will, Start free, GitHub, and a continuity sentence', () => {
    const { container } = renderRouted(<HomePage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: QUOTE_CALCULATOR.questions.who.options[0].label }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('link', { name: /start free/i })).toHaveAttribute(
      'href',
      SITE.urls.signup,
    );
    expect(screen.getByRole('link', { name: 'See it on GitHub' })).toBeInTheDocument();
    expect(container.textContent ?? '').toContain('npx');
    forbiddenOnPublicRoutes(container);
  });

  it('pricing is the same calculator with both exits and no leftover storefront', () => {
    const { container } = renderRouted(<PricingPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Pricing' })).toBeInTheDocument();
    expect(screen.getByText(QUOTE_CALCULATOR.questions.who.label)).toBeInTheDocument();
    expect(screen.getByText(QUOTE_CALCULATOR.questions.what.label)).toBeInTheDocument();
    expect(screen.getByText(QUOTE_CALCULATOR.questions.places.label)).toBeInTheDocument();
    expect(screen.getByText(QUOTE_CALCULATOR.selfHost.free)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Get Started Free' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Request the RevealUI Starter Kit' })).toBeNull();
    forbiddenOnPublicRoutes(container);
  });

  it('footer is Docs, Pricing, Support, Legal', () => {
    renderRouted(<HomePage />);
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent ?? '').toContain('Docs');
    expect(footer.textContent ?? '').toContain('Pricing');
    expect(footer.textContent ?? '').toContain('Support');
    expect(footer.textContent ?? '').toContain('Legal');
    expect(footer.textContent ?? '').not.toContain('HIPAA');
    expect(footer.textContent ?? '').not.toContain('Products');
    expect(footer.textContent ?? '').not.toContain('Services');
  });
});
