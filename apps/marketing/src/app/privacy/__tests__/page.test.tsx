/**
 * Privacy Policy Page Tests
 *
 * Tests the privacy policy server component renders
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

const { default: PrivacyPolicyPage, metadata } = await import('../page');

describe('PrivacyPolicyPage', () => {
  it('exports a default function component', () => {
    expect(typeof PrivacyPolicyPage).toBe('function');
  });

  it('renders the page title', () => {
    const html = JSON.stringify(PrivacyPolicyPage());

    expect(html).toContain('Privacy Policy');
  });

  it('includes all required legal sections', () => {
    const html = JSON.stringify(PrivacyPolicyPage());

    expect(html).toContain('Information We Collect');
    expect(html).toContain('How We Use Your Information');
    expect(html).toContain('Data Sharing');
    expect(html).toContain('Data Retention');
    expect(html).toContain('Your Rights');
    expect(html).toContain('Security');
    expect(html).toContain('Cookies');
    expect(html).toContain('Children');
    expect(html).toContain('Changes');
    expect(html).toContain('Contact');
  });

  it('mentions GDPR and CCPA compliance', () => {
    const html = JSON.stringify(PrivacyPolicyPage());

    expect(html).toContain('GDPR');
    expect(html).toContain('CCPA');
  });

  it('lists data sharing partners', () => {
    const html = JSON.stringify(PrivacyPolicyPage());

    expect(html).toContain('Stripe');
    expect(html).toContain('NeonDB');
    expect(html).toContain('Vercel');
    expect(html).toContain('Google Workspace');
  });

  it('includes support contact email', () => {
    const html = JSON.stringify(PrivacyPolicyPage());

    expect(html).toContain('support@revealui.com');
  });

  it('includes last updated date', () => {
    const html = JSON.stringify(PrivacyPolicyPage());

    expect(html).toContain('Last updated');
    expect(html).toContain('March 4, 2026');
  });

  it('exports correct metadata', () => {
    expect(metadata.title).toBe('Privacy Policy | RevealUI');
    expect(metadata.description).toContain('Privacy policy');
  });
});
