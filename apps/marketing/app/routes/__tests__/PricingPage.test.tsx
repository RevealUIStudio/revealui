import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PRICING_AGENT_A2A,
  PRICING_AGENT_MCP,
  PRICING_AGENT_X402,
  PRICING_AGENTS_SECTION,
} from '../../content/pricing';
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
      screen.getByRole('heading', { name: 'Who runs it. What you need. One price.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /I self-host/i })).toHaveAttribute(
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

  it('keeps Max monthly display at $99 when /api/pricing returns stale $299', async () => {
    let resolveJson: ((value: unknown) => void) | undefined;
    const jsonPromise = new Promise((resolve) => {
      resolveJson = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => jsonPromise,
      }),
    );

    render(<PricingPage />);
    const heading = await screen.findByRole('heading', { name: 'Max' });
    expect(resolveJson).toBeDefined();

    await act(async () => {
      resolveJson?.({
        subscriptions: [
          {
            id: 'free',
            name: 'Free',
            description: 'stale',
            features: [],
            cta: 'Get Started Free',
            ctaHref: '/signup',
            highlighted: false,
            price: '$0',
          },
          {
            id: 'pro',
            name: 'Pro',
            description: 'stale',
            features: [],
            cta: 'Start your 7-day free trial',
            ctaHref: '/signup?plan=pro',
            highlighted: true,
            price: '$49',
            period: '/month',
            annualPrice: '$399',
            annualPeriod: '/year',
          },
          {
            id: 'max',
            name: 'Max',
            description: 'stale',
            features: [],
            cta: 'Start your 7-day free trial',
            ctaHref: '/signup?plan=max',
            highlighted: false,
            price: '$299',
            period: '/month',
            annualPrice: '$799',
            annualPeriod: '/year',
          },
          {
            id: 'enterprise',
            name: 'Enterprise',
            description: 'stale',
            features: [],
            cta: 'Contact sales',
            ctaHref: 'https://revealui.com/contact',
            highlighted: false,
            price: '$1,499',
            period: '/month',
          },
        ],
        credits: [],
        perpetual: [],
        services: [],
      });
    });

    const card = heading.closest('div.relative') ?? heading.parentElement?.parentElement;
    const text = card?.textContent ?? '';
    expect(text.includes('$99')).toBe(true);
    expect(text.includes('$299')).toBe(false);
    const trial = screen
      .getAllByRole('link', { name: 'Start your 7-day free trial' })
      .find((link) => card?.contains(link));
    expect(trial?.getAttribute('href')).toBe('https://admin.revealui.com/signup?plan=max');
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

  it('asks What is RevealFleet and does not sell parked fleet SKUs', async () => {
    render(<PricingPage />);
    expect(await screen.findByText('What is RevealFleet?')).toBeInTheDocument();
    expect(screen.queryByText('What is RevFleet?')).toBeNull();
    const answer = screen.getByText('RevealUI Studio ships RevealFleet', { exact: false });
    const text = answer.textContent ?? '';
    expect(text.includes('seven products')).toBe(false);
    expect(text.includes('RevForge')).toBe(false);
    expect(text.includes('RevKit')).toBe(false);
    expect(text.includes('RevDev')).toBe(false);
    expect(text.includes('RevCon')).toBe(false);
    expect(text.includes('RevSkills')).toBe(false);
    expect(text.includes('RevMarket')).toBe(false);
    expect(text.includes('RevVault is encrypted secret management inside Pro')).toBe(true);
  });

  it('keeps Coming soon on the x402 card only, not the Agents band', async () => {
    render(<PricingPage />);
    const sectionHeading = await screen.findByRole('heading', {
      name: PRICING_AGENTS_SECTION.heading,
    });
    const header = sectionHeading.closest('.text-center') ?? sectionHeading.parentElement;
    expect(header?.textContent?.includes('Coming soon')).toBe(false);
    expect(header?.textContent?.includes('in development')).toBe(false);
    expect(header?.textContent?.includes('X402_ENABLED off')).toBe(true);

    const a2a = screen.getByRole('heading', { name: PRICING_AGENT_A2A.heading });
    const x402 = screen.getByRole('heading', { name: PRICING_AGENT_X402.heading });
    const mcp = screen.getByRole('heading', { name: PRICING_AGENT_MCP.heading });
    const a2aCard = a2a.closest('div.rounded-2xl') ?? a2a.parentElement;
    const x402Card = x402.closest('div.rounded-2xl') ?? x402.parentElement;
    const mcpCard = mcp.closest('div.rounded-2xl') ?? mcp.parentElement;

    const comingSoonBadges = screen.getAllByText('Coming soon', { exact: true });
    expect(comingSoonBadges).toHaveLength(1);
    const comingSoonBadge = comingSoonBadges[0] ?? null;
    expect(comingSoonBadge).not.toBeNull();
    expect(x402Card?.contains(comingSoonBadge)).toBe(true);
    expect(a2aCard?.contains(comingSoonBadge)).toBe(false);
    expect(mcpCard?.contains(comingSoonBadge)).toBe(false);
    expect(a2aCard?.textContent?.includes('Coming soon')).toBe(false);
    expect(mcpCard?.textContent?.includes('Coming soon')).toBe(false);
    expect(mcpCard?.textContent?.includes('Discovery via marketplace.json')).toBe(true);
    expect(mcpCard?.textContent?.includes('third-party catalog')).toBe(true);
    expect(PRICING_AGENT_X402.badge).toBe('Coming soon');
    expect('badge' in PRICING_AGENTS_SECTION).toBe(false);
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
    expect(text.includes('RevKit')).toBe(false);
    expect(text.includes('x402 agent payments (USDC, coming soon)')).toBe(false);
    expect(text.includes('Email support (24h weekday / 4h if unusable)')).toBe(true);
    expect(text.includes('$1,499')).toBe(true);
    expect(text.includes('Not included today: x402 agent payments')).toBe(true);
    expect(text.includes('Not included today: advanced inference configuration')).toBe(false);
  });
});
