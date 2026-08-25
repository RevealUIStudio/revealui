import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
    expect(
      await screen.findByRole('heading', { level: 1, name: /Two ways to use/i }),
    ).toBeInTheDocument();
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
    const { container } = render(<PricingPage />);
    const pro = await screen.findByRole('link', { name: 'Buy Pro Perpetual' });
    expect(pro.getAttribute('href') ?? '').toContain('license=pro');
    expect(screen.queryByRole('heading', { name: 'Agency Perpetual' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Buy Agency Perpetual' })).toBeNull();
    expect((container.textContent ?? '').includes('$8,499')).toBe(false);
  });

  it('keeps Enterprise inquire-only, not a $1,499/month hosted buy', async () => {
    render(<PricingPage />);
    const heading = await screen.findByRole('heading', { name: 'Enterprise' });
    const card = heading.closest('div.relative') ?? heading.parentElement?.parentElement;
    const text = card?.textContent ?? '';
    expect(text.includes('$1,499')).toBe(false);
    expect(text.includes('/month')).toBe(false);
    expect(text.includes('$1,499/month')).toBe(false);
    const cta = screen
      .getAllByRole('link', { name: 'Contact sales' })
      .find((link) => card?.contains(link));
    expect(cta?.getAttribute('href')).toBe('https://revealui.com/contact');
    expect(cta?.getAttribute('href') ?? '').not.toContain('signup');
  });

  it('still hides Agency and Enterprise monthly buy when /api/pricing returns them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            subscriptions: [
              {
                id: 'enterprise',
                name: 'Enterprise',
                description: 'Full ecosystem access with scale, compliance, and agent payments.',
                features: ['Everything in Max'],
                cta: 'Contact sales',
                ctaHref: 'https://revealui.com/contact',
                highlighted: false,
                price: '$1,499',
                period: '/month',
              },
            ],
            credits: [],
            perpetual: [
              {
                name: 'Agency Perpetual',
                description: 'Agency license',
                features: ['All Max tier features'],
                cta: 'Buy Agency Perpetual',
                ctaHref: '/signup?license=agency',
                comingSoon: false,
                price: '$8,499',
              },
              {
                name: 'Pro Perpetual',
                description: 'Pro features, forever. No subscription required.',
                features: ['All Pro tier features'],
                cta: 'Buy Pro Perpetual',
                ctaHref: '/signup?license=pro',
                comingSoon: false,
                price: '$1,499',
              },
            ],
            services: [],
          }),
      }),
    );

    const { container } = render(<PricingPage />);
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Free (OSS)' })).toBeNull();
    });
    await screen.findByRole('link', { name: 'Buy Pro Perpetual' });
    expect(screen.queryByRole('heading', { name: 'Agency Perpetual' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Buy Agency Perpetual' })).toBeNull();
    expect((container.textContent ?? '').includes('$8,499')).toBe(false);

    const heading = screen.getByRole('heading', { name: 'Enterprise' });
    const card = heading.closest('div.relative') ?? heading.parentElement?.parentElement;
    const text = card?.textContent ?? '';
    expect(text.includes('$1,499')).toBe(false);
    expect(text.includes('/month')).toBe(false);
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
