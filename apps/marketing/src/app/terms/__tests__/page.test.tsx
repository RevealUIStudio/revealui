/**
 * Terms of Service Page Tests
 *
 * Tests the terms page server component renders
 * all required legal sections.
 */

import { describe, expect, it, vi } from 'vitest';

// Mock next/link
vi.mock('next/link', () => ({
  default: vi.fn(({ children, href, ...props }) => ({
    type: 'a',
    props: { href, ...props },
    children,
  })),
}));

// Mock Footer
vi.mock('@/components/Footer', () => ({
  Footer: vi.fn(() => ({ type: 'footer', props: {}, children: 'Footer' })),
}));

const { default: TermsOfServicePage, metadata } = await import('../page');

describe('TermsOfServicePage', () => {
  it('exports a default function component', () => {
    expect(typeof TermsOfServicePage).toBe('function');
  });

  it('renders the page title', () => {
    const html = JSON.stringify(TermsOfServicePage());

    expect(html).toContain('Terms of Service');
  });

  it('includes all required legal sections', () => {
    const html = JSON.stringify(TermsOfServicePage());

    expect(html).toContain('Service Description');
    expect(html).toContain('Accounts');
    expect(html).toContain('Free Tier');
    expect(html).toContain('Paid Tiers');
    expect(html).toContain('Commercial License');
    expect(html).toContain('Acceptable Use');
    expect(html).toContain('Data and Content');
    expect(html).toContain('Service Availability');
    expect(html).toContain('Limitation of Liability');
    expect(html).toContain('Changes to Terms');
    expect(html).toContain('Governing Law');
    expect(html).toContain('Contact');
  });

  it('mentions pricing tiers', () => {
    const html = JSON.stringify(TermsOfServicePage());

    expect(html).toContain('Pro');
    expect(html).toContain('Max');
    expect(html).toContain('Forge');
  });

  it('mentions MIT license for free tier', () => {
    const html = JSON.stringify(TermsOfServicePage());

    expect(html).toContain('MIT License');
  });

  it('mentions Stripe for payment processing', () => {
    const html = JSON.stringify(TermsOfServicePage());

    expect(html).toContain('Stripe');
  });

  it('includes support contact email', () => {
    const html = JSON.stringify(TermsOfServicePage());

    expect(html).toContain('support@revealui.com');
  });

  it('includes last updated date', () => {
    const html = JSON.stringify(TermsOfServicePage());

    expect(html).toContain('Last updated');
    expect(html).toContain('March 4, 2026');
  });

  it('mentions cancellation and refund policies', () => {
    const html = JSON.stringify(TermsOfServicePage());

    expect(html).toContain('Cancellation');
    expect(html).toContain('Refund');
  });

  it('exports correct metadata', () => {
    expect(metadata.title).toBe('Terms of Service | RevealUI');
    expect(metadata.description).toContain('Terms of service');
  });
});
