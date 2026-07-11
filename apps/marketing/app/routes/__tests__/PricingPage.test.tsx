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
});
