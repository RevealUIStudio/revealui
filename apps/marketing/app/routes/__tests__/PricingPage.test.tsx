import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PricingPage } from '../PricingPage';

afterEach(cleanup);

describe('PricingPage final CTA', () => {
  beforeEach(() => {
    // The page fetches live pricing on mount; force the fallback content path
    // so the test only exercises the static CTA hrefs under test.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve(null) }),
    );
  });

  it('links the final "Get Started Free" CTA straight to the absolute signup URL', async () => {
    render(<PricingPage />);
    const cta = await screen.findByRole('link', { name: 'Get Started Free' });
    // PRICING_FINAL_CTA_LINKS.getStarted.href is already absolute
    // (SITE.urls.signup); it must not be re-prefixed with ADMIN_URL.
    expect(cta).toHaveAttribute('href', 'https://admin.revealui.com/signup');
  });

  it('points the Pro Perpetual CTA at the self-serve checkout, prefixed with ADMIN_URL', async () => {
    render(<PricingPage />);
    const cta = await screen.findByRole('link', { name: 'Buy Pro Perpetual' });
    // PERPETUAL_TIERS ships a relative ctaHref ('/account/license'); the
    // perpetual tier map must apply the same ADMIN_URL guard as the
    // subscription tier map so it resolves off-site correctly.
    expect(cta).toHaveAttribute('href', 'https://admin.revealui.com/account/license');
  });

  // GAP-306: Agency and Enterprise Perpetual previously routed to
  // mailto:support@revealui.com — a perpetual licensee must be able to
  // purchase without email, matching the Pro Perpetual in-app pattern.
  it('points the Agency Perpetual CTA at the self-serve checkout, not a mailto link', async () => {
    render(<PricingPage />);
    const cta = await screen.findByRole('link', { name: 'Buy Agency Perpetual' });
    expect(cta).toHaveAttribute('href', 'https://admin.revealui.com/account/license');
  });

  it('points the Enterprise Perpetual CTA at contact sales, not self-serve checkout', async () => {
    render(<PricingPage />);
    expect(screen.queryByRole('link', { name: 'Buy Enterprise Perpetual' })).toBeNull();
    const perpetualHeading = await screen.findByRole('heading', { name: 'Enterprise Perpetual' });
    const card = perpetualHeading.closest('div');
    expect(card).not.toBeNull();
    const cta = card!.querySelector('a');
    expect(cta).toHaveTextContent('Contact sales');
    expect(cta).toHaveAttribute('href', 'https://revealui.com/contact');
    expect(cta?.getAttribute('href') ?? '').not.toContain('/account/license');
  });

  it('points the Enterprise subscription CTA at contact sales, not a trial signup', async () => {
    render(<PricingPage />);
    const ctas = await screen.findAllByRole('link', { name: 'Contact sales' });
    const hrefs = ctas.map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('https://revealui.com/contact');
    expect(hrefs.some((href) => href?.includes('signup'))).toBe(false);
    expect(hrefs.some((href) => href?.includes('plan=enterprise'))).toBe(false);
  });

  it('keeps Pro and Max trial CTAs on admin signup', async () => {
    render(<PricingPage />);
    const trialLinks = await screen.findAllByRole('link', {
      name: 'Start your 7-day free trial',
    });
    const hrefs = trialLinks.map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('https://admin.revealui.com/signup?plan=pro');
    expect(hrefs).toContain('https://admin.revealui.com/signup?plan=max');
    expect(hrefs.some((href) => href?.includes('plan=enterprise'))).toBe(false);
  });

  it('does not render the live Starter Kit Payment Link as a public Buy CTA', async () => {
    render(<PricingPage />);
    const cta = await screen.findByRole('link', { name: 'Request the RevealUI Starter Kit' });
    expect(cta).toHaveAttribute(
      'href',
      'mailto:founder@revealui.com?subject=RevealUI%20Starter%20Kit%20request',
    );
    expect(cta.getAttribute('href') ?? '').not.toContain('buy.stripe.com');
    expect(screen.queryByRole('link', { name: 'Buy the RevealUI Starter Kit' })).toBeNull();
  });
});
