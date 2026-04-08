import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock @revealui/presentation
vi.mock('@revealui/presentation', () => ({
  Badge: ({ children, ...props }: Record<string, unknown>) =>
    createElement('span', { 'data-testid': 'badge', ...props }, children as string),
}));

import { SocialProof } from '../SocialProof';

describe('SocialProof', () => {
  it('is exported as a named function', () => {
    expect(typeof SocialProof).toBe('function');
    expect(SocialProof.name).toBe('SocialProof');
  });

  it('renders a section element', () => {
    const result = SocialProof();
    expect(result).toBeDefined();
    expect(result.type).toBe('section');
  });

  it('contains all four stats', () => {
    const result = SocialProof();
    const html = JSON.stringify(result);
    expect(html).toContain('3 min');
    expect(html).toContain('to first deploy');
    expect(html).toContain('5');
    expect(html).toContain('business primitives');
    expect(html).toContain('52');
    expect(html).toContain('UI components');
    expect(html).toContain('MIT');
    expect(html).toContain('licensed');
  });

  it('contains the tech stack badges', () => {
    const result = SocialProof();
    const html = JSON.stringify(result);
    const techStack = [
      'TypeScript',
      'React 19',
      'Next.js 16',
      'Hono',
      'Drizzle ORM',
      'Stripe',
      'Tailwind v4',
      'ElectricSQL',
    ];
    for (const tech of techStack) {
      expect(html).toContain(tech);
    }
  });

  it('contains all six feature cards', () => {
    const result = SocialProof();
    const html = JSON.stringify(result);
    expect(html).toContain('Content Engine');
    expect(html).toContain('52 Native UI Components');
    expect(html).toContain('Real-Time Sync');
    expect(html).toContain('AI Agents (Pro)');
    expect(html).toContain('Stripe Billing Built In');
    expect(html).toContain('Multi-Tenant by Design');
  });

  it('contains feature descriptions', () => {
    const result = SocialProof();
    const html = JSON.stringify(result);
    expect(html).toContain('Schema-first collections');
    expect(html).toContain('Tailwind v4, zero external UI dependencies');
    expect(html).toContain('ElectricSQL-powered sync foundation');
    expect(html).toContain('A2A protocol agent system');
    expect(html).toContain('Checkout, subscriptions, webhook handling');
    expect(html).toContain('One deployment, many clients');
  });

  it('contains section heading', () => {
    const result = SocialProof();
    const html = JSON.stringify(result);
    expect(html).toContain("What's Included");
    expect(html).toContain('Every layer of the stack, already built');
  });
});
