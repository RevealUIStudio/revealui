/**
 * XSS-hardening tests for the editor-side EmbedNodeComponent.
 *
 * A generic embed URL is author-controlled and `new URL()` accepts
 * `javascript:`/`data:` schemes, so the rendered <a href> is the same URL
 * vector as the public render path. It must be neutralized through the shared
 * sanitizeUrl chokepoint. Legitimate http(s) and YouTube embeds are unaffected.
 *
 * No regex authored (fleet posture): assertions use attribute equality.
 */
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/richtext/client', () => ({
  useLexicalComposerContext: () => [{ update: vi.fn(), dispatchCommand: vi.fn() }],
}));

// Avoid pulling the lexical DecoratorBlockNode internals into the test; only the
// command symbol is referenced at runtime.
vi.mock('../../nodes/EmbedNode', () => ({
  OPEN_EMBED_DRAWER_COMMAND: { type: 'OPEN_EMBED_DRAWER_COMMAND' },
}));

import { EmbedNodeComponent } from '../EmbedNodeComponent';

const renderEmbed = (url: string) =>
  render(<EmbedNodeComponent data={{ url } as never} nodeKey="test-key" />);

describe('EmbedNodeComponent', () => {
  it('neutralizes a javascript: embed URL to # on the generic anchor', () => {
    const { container } = renderEmbed('javascript:alert(document.cookie)');
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('#');
  });

  it('neutralizes a data:text/html embed URL to #', () => {
    const { container } = renderEmbed('data:text/html,<script>alert(1)</script>');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('#');
  });

  it('preserves a legitimate https URL on the generic anchor', () => {
    const { container } = renderEmbed('https://example.com/article');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com/article');
  });

  it('renders a YouTube watch URL as a youtube.com/embed iframe', () => {
    const { container } = renderEmbed('https://www.youtube.com/watch?v=abc123');
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/abc123');
    // No anchor in the youtube branch.
    expect(container.querySelector('a')).toBeNull();
  });
});
