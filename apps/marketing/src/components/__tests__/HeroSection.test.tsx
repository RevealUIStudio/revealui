import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock @revealui/presentation — Badge and ButtonCVA are used
vi.mock('@revealui/presentation', () => ({
  Badge: ({ children, ...props }: Record<string, unknown>) =>
    createElement('span', { 'data-testid': 'badge', ...props }, children as string),
  ButtonCVA: ({ children, ...props }: Record<string, unknown>) =>
    createElement(
      'button',
      { type: 'button', 'data-testid': 'button', ...props },
      children as string,
    ),
}));

// Mock ProductMockup sub-component
vi.mock('../ProductMockup', () => ({
  ProductMockup: () => createElement('div', { 'data-testid': 'product-mockup' }),
}));

import { HeroSection } from '../HeroSection';

describe('HeroSection', () => {
  it('is exported as a named function', () => {
    expect(typeof HeroSection).toBe('function');
    expect(HeroSection.name).toBe('HeroSection');
  });

  it('returns a valid React element', () => {
    const element = createElement(HeroSection);
    expect(element).toBeDefined();
    expect(element.type).toBe(HeroSection);
  });

  it('renders without throwing', () => {
    // Calling the component function directly to verify it produces JSX
    const result = HeroSection();
    expect(result).toBeDefined();
    expect(result.type).toBe('section');
  });

  it('contains the brand tagline', () => {
    const result = HeroSection();
    const html = JSON.stringify(result);
    // Hero H1 splits "Ship Your SaaS, / Not Your / Infrastructure" across span blocks
    expect(html).toContain('Ship Your SaaS,');
    expect(html).toContain('Infrastructure');
    expect(html).toContain('Build your business, not your boilerplate.');
  });

  it('contains all five primitives', () => {
    const result = HeroSection();
    const html = JSON.stringify(result);
    const primitives = ['Users', 'Content', 'Products', 'Payments', 'Intelligence'];
    for (const primitive of primitives) {
      expect(html).toContain(primitive);
    }
  });

  it('contains CTA buttons with correct targets', () => {
    const result = HeroSection();
    const html = JSON.stringify(result);
    expect(html).toContain('https://admin.revealui.com/signup');
    expect(html).toContain('Get Started Free');
    expect(html).toContain('https://docs.revealui.com');
    expect(html).toContain('View docs');
  });

  it('contains the CLI quick-start command', () => {
    const result = HeroSection();
    const html = JSON.stringify(result);
    expect(html).toContain('create-revealui@latest');
    expect(html).toContain('my-app');
  });

  it('contains trust badges', () => {
    const result = HeroSection();
    const html = JSON.stringify(result);
    expect(html).toContain('MIT Licensed');
    expect(html).toContain('Self-Hostable');
    expect(html).toContain('No Vendor Lock-in');
    expect(html).toContain('AI Built In');
  });

  it('renders the Open Source badge', () => {
    const result = HeroSection();
    const html = JSON.stringify(result);
    expect(html).toContain('Open Source');
    expect(html).toContain('MIT Licensed');
  });
});
