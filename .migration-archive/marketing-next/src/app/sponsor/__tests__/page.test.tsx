/**
 * Sponsor Page Tests
 *
 * Tests the sponsor page server component, including:
 * - Sponsorship tiers render correctly
 * - "Where Your Support Goes" section
 * - GitHub sponsors link
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

const { default: SponsorPage } = await import('../page');

describe('SponsorPage', () => {
  it('exports a default function component', () => {
    expect(typeof SponsorPage).toBe('function');
  });

  it('returns a valid React element', () => {
    const result = SponsorPage();

    expect(result).toBeDefined();
    expect(result.type).toBe('div');
  });

  it('renders the page heading', () => {
    const html = JSON.stringify(SponsorPage());

    expect(html).toContain('Sponsor');
    expect(html).toContain('RevealUI');
  });

  it('renders all four sponsorship tiers', () => {
    const html = JSON.stringify(SponsorPage());

    expect(html).toContain('Supporter');
    expect(html).toContain('Backer');
    expect(html).toContain('Gold Sponsor');
    expect(html).toContain('Platinum Sponsor');
  });

  it('renders tier prices', () => {
    const html = JSON.stringify(SponsorPage());

    expect(html).toContain('$5');
    expect(html).toContain('$25');
    expect(html).toContain('$100');
    expect(html).toContain('$500');
  });

  it('renders tier descriptions', () => {
    const html = JSON.stringify(SponsorPage());

    expect(html).toContain('Buy the maintainers a coffee');
    expect(html).toContain('Support ongoing development');
    expect(html).toContain('Fund a major feature every quarter');
    expect(html).toContain('Shape the future of RevealUI');
  });

  it('renders key benefits', () => {
    const html = JSON.stringify(SponsorPage());

    expect(html).toContain('Sponsor badge on GitHub profile');
    expect(html).toContain('Logo on README and docs site');
    expect(html).toContain('Dedicated Discourse channel');
    expect(html).toContain('Custom feature development priority');
  });

  it('links to GitHub Sponsors', () => {
    const html = JSON.stringify(SponsorPage());

    expect(html).toContain('github.com/sponsors/RevealUIStudio');
    expect(html).toContain('Sponsor on GitHub');
    expect(html).toContain('Become a Sponsor');
  });

  it('renders the "Where Your Support Goes" section', () => {
    const html = JSON.stringify(SponsorPage());

    expect(html).toContain('Where Your Support Goes');
    expect(html).toContain('Development');
    expect(html).toContain('Documentation');
    expect(html).toContain('Community');
  });

  it('includes the development support description', () => {
    const html = JSON.stringify(SponsorPage());

    expect(html).toContain('New features, bug fixes, and performance improvements');
  });
});
