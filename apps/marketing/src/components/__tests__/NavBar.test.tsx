import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: Record<string, unknown>) =>
    createElement('a', { href: href as string, ...props }, children as string),
}));

// Mock @revealui/presentation
vi.mock('@revealui/presentation', () => ({
  ButtonCVA: ({ children, ...props }: Record<string, unknown>) =>
    createElement(
      'button',
      { type: 'button', 'data-testid': 'button', ...props },
      children as string,
    ),
}));

// Mock react useState for server-side rendering
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: (initial: unknown) => [initial, vi.fn()],
  };
});

import { NavBar } from '../NavBar';

describe('NavBar', () => {
  it('is exported as a named function', () => {
    expect(typeof NavBar).toBe('function');
    expect(NavBar.name).toBe('NavBar');
  });

  it('renders a header element', () => {
    const result = NavBar();
    expect(result).toBeDefined();
    expect(result.type).toBe('header');
  });

  it('contains the RevealUI brand link', () => {
    const result = NavBar();
    const html = JSON.stringify(result);
    expect(html).toContain('RevealUI');
  });

  it('contains navigation links for Docs, Pricing, and Contact', () => {
    const result = NavBar();
    const html = JSON.stringify(result);
    expect(html).toContain('Docs');
    expect(html).toContain('https://docs.revealui.com');
    expect(html).toContain('Pricing');
    expect(html).toContain('/pricing');
    expect(html).toContain('Contact');
    expect(html).toContain('/contact');
  });

  it('contains the GitHub link', () => {
    const result = NavBar();
    const html = JSON.stringify(result);
    expect(html).toContain('github.com/RevealUIStudio/revealui');
  });

  it('contains the CTA button linking to signup', () => {
    const result = NavBar();
    const html = JSON.stringify(result);
    expect(html).toContain('Get Started');
    expect(html).toContain('https://admin.revealui.com/signup');
    expect(html).toContain('Log in');
    expect(html).toContain('https://admin.revealui.com/login');
  });

  it('contains the Blog nav link', () => {
    const result = NavBar();
    const html = JSON.stringify(result);
    expect(html).toContain('Blog');
    expect(html).toContain('/blog');
  });

  it('contains a mobile menu hamburger button', () => {
    const result = NavBar();
    const html = JSON.stringify(result);
    expect(html).toContain('Open menu');
  });
});
