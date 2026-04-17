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
    expect(html).toContain('5');
    expect(html).toContain('problems solved');
    expect(html).toContain('22');
    expect(html).toContain('npm packages');
    expect(html).toContain('11');
    expect(html).toContain('MCP servers');
    expect(html).toContain('MIT');
    expect(html).toContain('licensed');
  });

  it('contains the capability badges', () => {
    const result = SocialProof();
    const html = JSON.stringify(result);
    const capabilities = [
      'Content Management',
      'Auth & Sessions',
      'Payments & Billing',
      'AI Agents',
      'Real-Time Sync',
      'UI Components',
      'REST API',
      'Multi-Tenant',
    ];
    for (const cap of capabilities) {
      expect(html).toContain(cap);
    }
  });

  it('contains all six feature cards', () => {
    const result = SocialProof();
    const html = JSON.stringify(result);
    expect(html).toContain('Content Engine');
    expect(html).toContain('Native UI Components');
    expect(html).toContain('Real-Time Sync');
    expect(html).toContain('AI Agents (Pro)');
    expect(html).toContain('Stripe Billing Built In');
    expect(html).toContain('Multi-Tenant by Design');
  });

  it('contains feature descriptions', () => {
    const result = SocialProof();
    const html = JSON.stringify(result);
    expect(html).toContain('Schema-first collections');
    expect(html).toContain('Native components with zero external UI dependencies');
    expect(html).toContain('Live sync for editors, clients, and agents');
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
