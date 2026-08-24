import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SITE } from '../../content/site';
import { PricingPage } from '../PricingPage';

afterEach(cleanup);

describe('PricingPage product catalog', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve(null) }),
    );
  });

  it('renders the license catalog, not the studio quote calculator', async () => {
    render(<PricingPage />);
    expect(await screen.findByRole('heading', { name: /RevealUI/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /I will \(developer/i })).toBeNull();
    expect(screen.queryByText('Three questions. One price. No fleet math.')).toBeNull();
  });

  it('keeps subscription Free, Pro, Max, and Enterprise as a license', async () => {
    render(<PricingPage />);
    expect(await screen.findByRole('heading', { name: 'Free (OSS)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Max' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Enterprise' })).toBeInTheDocument();
    const trialLinks = screen.getAllByRole('link', { name: 'Start your 7-day free trial' });
    const hrefs = trialLinks.map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('https://admin.revealui.com/signup?plan=pro');
    expect(hrefs).toContain('https://admin.revealui.com/signup?plan=max');
    const sales = screen.getAllByRole('link', { name: 'Contact sales' });
    expect(sales.some((link) => link.getAttribute('href') === 'https://revealui.com/contact')).toBe(
      true,
    );
  });

  it('keeps Perpetual Pro as a license and hides Agency Perpetual', async () => {
    render(<PricingPage />);
    const pro = await screen.findByRole('link', { name: 'Buy Pro Perpetual' });
    expect(pro.getAttribute('href') ?? '').toContain('license=pro');
    expect(screen.queryByRole('heading', { name: 'Agency Perpetual' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Buy Agency Perpetual' })).toBeNull();
  });

  it('does not sell studio or leftover storefront rungs', async () => {
    const { container } = render(<PricingPage />);
    await screen.findByRole('link', { name: 'Get Started Free' });
    const text = container.textContent ?? '';
    expect(text.includes('Architecture Review')).toBe(false);
    expect(text.includes('Fleet from')).toBe(false);
    expect(text.includes('Custom from')).toBe(false);
    expect(text.includes('$25,000')).toBe(false);
    expect(text.includes('$50,000')).toBe(false);
    expect(text.includes('Starter Kit')).toBe(false);
    expect(text.includes('Agency Founding Kit')).toBe(false);
    expect(text.includes('$8,499')).toBe(false);
    expect(text.includes('Starter Kit $299')).toBe(false);
    expect(text.includes('Add up what you would otherwise rent')).toBe(false);
    expect(text.includes('The rented stack')).toBe(false);
    expect(text.includes('$300')).toBe(false);
    expect(text.includes('$3,500')).toBe(false);
    expect(text.includes('$7,500')).toBe(false);
    expect(text.includes('No holdback')).toBe(false);
    expect(container.innerHTML.includes('cal.com/revealuistudio')).toBe(false);
  });

  it('points to the studio site in one line, not a second money ladder', async () => {
    render(<PricingPage />);
    const studio = await screen.findByRole('link', { name: 'revealuistudio.com' });
    expect(studio).toHaveAttribute('href', SITE.urls.agency);
    expect(screen.queryByRole('link', { name: 'Book a discovery call' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Request the RevealUI Starter Kit' })).toBeNull();
  });

  it('links the final Get Started Free CTA to admin signup', async () => {
    render(<PricingPage />);
    const cta = await screen.findByRole('link', { name: 'Get Started Free' });
    expect(cta).toHaveAttribute('href', SITE.urls.signup);
  });
});
