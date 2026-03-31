import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock @revealui/presentation
vi.mock('@revealui/presentation', () => ({
  Button: ({ children, href, ...props }: Record<string, unknown>) =>
    createElement('a', { href: href as string, ...props }, children as string),
}));

import { ValueProposition } from '../ValueProposition';

describe('ValueProposition', () => {
  it('is exported as a named function', () => {
    expect(typeof ValueProposition).toBe('function');
    expect(ValueProposition.name).toBe('ValueProposition');
  });

  it('renders a section element', () => {
    const result = ValueProposition();
    expect(result).toBeDefined();
    expect(result.type).toBe('section');
  });

  it('contains the section heading', () => {
    const result = ValueProposition();
    const html = JSON.stringify(result);
    expect(html).toContain('Why RevealUI');
    expect(html).toContain('Stop stitching tools together');
  });

  it('contains all three value proposition cards', () => {
    const result = ValueProposition();
    const html = JSON.stringify(result);
    expect(html).toContain('Sovereign by Default');
    expect(html).toContain('Adaptive Intelligence');
    expect(html).toContain('Unified Truth');
  });

  it('contains feature descriptions', () => {
    const result = ValueProposition();
    const html = JSON.stringify(result);
    expect(html).toContain('MIT-licensed core');
    expect(html).toContain('AI agents, MCP servers');
    expect(html).toContain('One Zod schema defines the contract');
  });

  it('contains links to documentation', () => {
    const result = ValueProposition();
    const html = JSON.stringify(result);
    expect(html).toContain('https://docs.revealui.com/docs/QUICK_START');
    expect(html).toContain('https://docs.revealui.com/docs/AI_AGENTS');
    expect(html).toContain('https://docs.revealui.com/docs/REFERENCE');
  });

  it('contains Learn more CTAs', () => {
    const result = ValueProposition();
    const html = JSON.stringify(result);
    // The component renders "Learn more →" for each feature
    const learnMoreCount = (html.match(/Learn more/g) || []).length;
    expect(learnMoreCount).toBe(3);
  });
});
