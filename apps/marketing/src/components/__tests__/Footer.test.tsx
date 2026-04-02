import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: Record<string, unknown>) =>
    createElement('a', { href: href as string, ...props }, children as string),
}));

// Mock NewsletterSignup (uses client-side state)
vi.mock('../NewsletterSignup', () => ({
  NewsletterSignup: () => createElement('div', { 'data-testid': 'newsletter-signup' }),
}));

import { Footer } from '../Footer';

describe('Footer', () => {
  it('is exported as a named function', () => {
    expect(typeof Footer).toBe('function');
    expect(Footer.name).toBe('Footer');
  });

  it('renders a footer element', () => {
    const result = Footer();
    expect(result).toBeDefined();
    expect(result.type).toBe('footer');
  });

  it('contains the RevealUI brand name', () => {
    const result = Footer();
    const html = JSON.stringify(result);
    expect(html).toContain('RevealUI');
  });

  it('contains the copyright notice', () => {
    const result = Footer();
    const html = JSON.stringify(result);
    // Year is a separate JSX child (number), so check brand and notice separately
    expect(html).toContain('RevealUI Studio');
    expect(html).toContain('All rights reserved');
    expect(html).toContain(new Date().getFullYear());
  });

  it('contains Product section links', () => {
    const result = Footer();
    const html = JSON.stringify(result);
    expect(html).toContain('Product');
    expect(html).toContain('Features');
    expect(html).toContain('/pricing');
    expect(html).toContain('Documentation');
    expect(html).toContain('API Reference');
    expect(html).toContain('Blog');
  });

  it('contains Community section links', () => {
    const result = Footer();
    const html = JSON.stringify(result);
    expect(html).toContain('Community');
    expect(html).toContain('GitHub');
    expect(html).toContain('Discussions');
    expect(html).toContain('Sponsor');
    expect(html).toContain('Contact');
    expect(html).toContain('/contact');
  });

  it('contains social media links', () => {
    const result = Footer();
    const html = JSON.stringify(result);
    expect(html).toContain('github.com/RevealUIStudio/revealui');
    expect(html).toContain('x.com/revealui');
    expect(html).toContain('linkedin.com/company/revealui');
  });

  it('contains legal links', () => {
    const result = Footer();
    const html = JSON.stringify(result);
    expect(html).toContain('/privacy');
    expect(html).toContain('Privacy Policy');
    expect(html).toContain('/terms');
    expect(html).toContain('Terms of Service');
  });

  it('contains the brand description', () => {
    const result = Footer();
    const html = JSON.stringify(result);
    expect(html).toContain('Agentic business runtime');
    expect(html).toContain('pre-wired');
  });
});
