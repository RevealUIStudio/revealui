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

  it('renders the license catalog and the product-site quote calculator', async () => {
    render(<PricingPage />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'RevealUI pricing' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Three questions. A price you can read.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /I will \(developer/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
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

  it('keeps Pro Perpetual as a license and hides Agency Perpetual', async () => {
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
    await screen.findByRole('heading', { name: 'Free (OSS)' });
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

  it('does not render leftover Slack or coming-soon features from a stale /api/pricing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            subscriptions: [
              {
                id: 'pro',
                name: 'Pro',
                description: 'stale',
                features: ['Slack support (4h SLA)', '$118/yr for continued support'],
                cta: 'Start your 7-day free trial',
                ctaHref: '/signup?plan=pro',
                highlighted: true,
                price: '$49',
                period: '/month',
              },
              {
                id: 'max',
                name: 'Max',
                description: 'stale',
                features: [
                  'Advanced inference configuration (coming soon)',
                  'RevKit environment provisioning (coming soon)',
                ],
                cta: 'Start your 7-day free trial',
                ctaHref: '/signup?plan=max',
                highlighted: false,
                price: '$299',
                period: '/month',
              },
              {
                id: 'enterprise',
                name: 'Enterprise',
                description: 'stale',
                features: ['x402 agent payments (USDC, coming soon)', 'Slack support (4h SLA)'],
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
                name: 'Enterprise Perpetual',
                description: 'stale',
                features: ['Slack support'],
                cta: 'Contact sales',
                ctaHref: 'https://revealui.com/contact',
                comingSoon: false,
                price: '$42,999',
              },
            ],
            services: [],
          }),
      }),
    );

    const { container } = render(<PricingPage />);
    await screen.findByRole('heading', { name: 'Pro' });
    const text = container.textContent ?? '';
    expect(text.includes('Slack support')).toBe(false);
    expect(text.includes('$118/yr')).toBe(false);
    expect(text.includes('$42,999')).toBe(false);
    expect(text.includes('Advanced inference configuration (coming soon)')).toBe(false);
    expect(text.includes('RevKit environment provisioning (coming soon)')).toBe(false);
    expect(text.includes('x402 agent payments (USDC, coming soon)')).toBe(false);
    expect(text.includes('Email support (24h weekday / 4h if unusable)')).toBe(true);
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
    expect(container.innerHTML.includes('cal.com/revealuistudio')).toBe(false);
  });

  it('points to the studio site in one line, not a second money ladder', async () => {
    render(<PricingPage />);
    const studio = await screen.findByRole('link', { name: 'revealuistudio.com' });
    expect(studio).toHaveAttribute('href', SITE.urls.agency);
    expect(screen.queryByRole('link', { name: 'Book a discovery call' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Request the RevealUI Starter Kit' })).toBeNull();
  });

  it('does not promote RevealFleet or parked fleet SKUs', async () => {
    render(<PricingPage />);
    expect(screen.queryByText('What is RevealFleet?')).toBeNull();
    expect(screen.queryByText('What is RevFleet?')).toBeNull();
    const text =
      (await screen.findByRole('heading', { name: 'Frequently Asked Questions' })).closest(
        'section',
      )?.textContent ?? '';
    expect(text.includes('RevealUI Studio ships RevealFleet')).toBe(false);
    expect(text.includes('seven products')).toBe(false);
    expect(text.includes('RevForge')).toBe(false);
    expect(text.includes('RevKit')).toBe(false);
    expect(text.includes('RevDev')).toBe(false);
    expect(text.includes('RevCon')).toBe(false);
    expect(text.includes('RevSkills')).toBe(false);
    expect(text.includes('RevMarket')).toBe(false);
  });

  it('links the final Get Started Free CTA to admin signup', async () => {
    render(<PricingPage />);
    const cta = await screen.findByRole('link', { name: 'Get Started Free' });
    expect(cta).toHaveAttribute('href', SITE.urls.signup);
  });

  it('does not sell leftover catalog lies on the cards', async () => {
    const { container } = render(<PricingPage />);
    await screen.findByRole('heading', { level: 1, name: 'RevealUI pricing' });
    const text = container.textContent ?? '';
    expect(text.includes('Slack support')).toBe(false);
    expect(text.includes('4h SLA')).toBe(false);
    expect(text.includes('$118/yr')).toBe(false);
    expect(text.includes('$718/yr')).toBe(false);
    expect(text.includes('$42,999')).toBe(false);
    expect(text.includes('Agency Perpetual')).toBe(false);
    expect(text.includes('Two ways to use RevealUI')).toBe(false);
    expect(screen.queryByRole('heading', { name: 'Enterprise Perpetual' })).toBeNull();
    expect(text.includes('Advanced inference configuration (coming soon)')).toBe(false);
    expect(text.includes('RevKit environment provisioning (coming soon)')).toBe(false);
    expect(text.includes('x402 agent payments (USDC, coming soon)')).toBe(false);
    expect(text.includes('Email support (24h weekday / 4h if unusable)')).toBe(true);
    expect(text.includes('$1,499')).toBe(true);
    expect(text.includes('Not included today: x402 agent payments')).toBe(true);
    expect(text.includes('Not included today: advanced inference configuration')).toBe(false);
  });
});
