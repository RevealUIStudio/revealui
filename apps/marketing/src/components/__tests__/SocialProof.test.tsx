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
    expect(html).toContain('30');
    expect(html).toContain('workspaces');
    expect(html).toContain('200K+');
    expect(html).toContain('lines of TypeScript');
    expect(html).toContain('10,700+');
    expect(html).toContain('tests');
    expect(html).toContain('7');
    expect(html).toContain('apps');
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
    expect(html).toContain('50+ Native UI Components');
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
    expect(html).toContain('Every layer of the stack, production-ready');
  });
});
