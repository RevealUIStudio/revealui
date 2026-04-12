import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock @revealui/presentation
vi.mock('@revealui/presentation', () => ({
  Button: ({ children, href, ...props }: Record<string, unknown>) =>
    createElement('a', { href: href as string, ...props }, children as string),
}));

import { Audiences } from '../Audiences';

describe('Audiences', () => {
  it('is exported as a named function', () => {
    expect(typeof Audiences).toBe('function');
    expect(Audiences.name).toBe('Audiences');
  });

  it('renders a section element', () => {
    const result = Audiences();
    expect(result).toBeDefined();
    expect(result.type).toBe('section');
  });

  it('contains the section heading', () => {
    const result = Audiences();
    const html = JSON.stringify(result);
    expect(html).toContain("Who it's for");
    expect(html).toContain('Built for builders and their agents');
  });

  it('contains the retrofit card', () => {
    const result = Audiences();
    const html = JSON.stringify(result);
    expect(html).toContain('Retrofit your existing product');
    expect(html).toContain('Add billing and subscriptions without touching your core app');
    expect(html).toContain('Layer proper auth, RBAC, and sessions on top of what you ship');
    expect(html).toContain('Plug in a content engine so your team publishes without you');
    expect(html).toContain('Make every feature agent-accessible through MCP automatically');
  });

  it('contains the start fresh card', () => {
    const result = Audiences();
    const html = JSON.stringify(result);
    expect(html).toContain('Start fresh with everything');
    expect(html).toContain('One CLI command');
    expect(html).toContain('create-revealui');
    expect(html).toContain('my-app');
  });

  it('contains CLI output items in start fresh card', () => {
    const result = Audiences();
    const html = JSON.stringify(result);
    expect(html).toContain('Auth + sessions + RBAC');
    expect(html).toContain('Stripe billing + webhooks');
    expect(html).toContain('Content collections + REST API');
    expect(html).toContain('Admin dashboard + MCP servers');
    expect(html).toContain('Agent-ready from first deploy');
  });

  it('contains links to documentation', () => {
    const result = Audiences();
    const html = JSON.stringify(result);
    expect(html).toContain('https://docs.revealui.com');
    expect(html).toContain('https://docs.revealui.com/docs/QUICK_START');
  });
});
