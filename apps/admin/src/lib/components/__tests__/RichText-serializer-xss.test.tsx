/**
 * Stored-XSS regression tests for the admin CMS rich-text render path.
 *
 * Author-controlled Lexical JSON must be neutralized end-to-end:
 *  - javascript:/vbscript:/data: link URLs — inline links AND CTA/hero
 *    buttons all funnel through the CMSLink chokepoint;
 *  - forged heading/list tags — a "script" tag must never render a live
 *    <script> element;
 *  - upload URLs — sanitized in @revealui/core before any renderer sees them.
 *
 * No regex authored (fleet posture): assertions use attribute equality.
 */
import { render } from '@testing-library/react';
import type { ImgHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({ fill: _fill, priority: _priority, ...rest }: Record<string, unknown>) => {
    // biome-ignore lint/performance/noImgElement: test stand-in for next/image
    // biome-ignore lint/a11y/useAltText: alt is forwarded via rest when present
    return <img {...(rest as ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

// Block components pull heavy dependencies (providers, Media, logger). The
// serializer wiring is what is under test, so stub them.
vi.mock('@/lib/blocks/Banner/Component', () => ({
  BannerBlock: () => <div data-testid="banner-block" />,
}));
vi.mock('@/lib/blocks/CallToAction/Component', () => ({
  CallToActionBlock: () => <div data-testid="cta-block" />,
}));
vi.mock('@/lib/blocks/Code/Component', () => ({
  CodeBlock: () => <div data-testid="code-block" />,
}));
vi.mock('@/lib/blocks/MediaBlock/Component', () => ({
  MediaBlock: () => <div data-testid="media-block" />,
}));

import type { Page } from '@revealui/core/types/admin';
import { CMSLink } from '../Link/index';
import RichText, { type RichTextContent } from '../RichText/index';

function content(children: unknown[]): RichTextContent {
  return {
    root: {
      type: 'root',
      children,
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  } as unknown as RichTextContent;
}

function textNode(text: string) {
  return { type: 'text', text, format: 0, version: 1 };
}

function linkNode(url: string, label: string) {
  return {
    type: 'link',
    version: 1,
    fields: { url, linkType: 'custom', newTab: false },
    children: [textNode(label)],
  };
}

describe('CMSLink — URL chokepoint', () => {
  it('collapses a javascript: url to "#" (inline)', () => {
    const { container } = render(<CMSLink label="evil" url="javascript:alert(1)" />);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('#');
  });

  it('collapses a vbscript: url to "#"', () => {
    const { container } = render(<CMSLink label="evil" url="vbscript:MsgBox(1)" />);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('#');
  });

  it('collapses a data:text/html url to "#"', () => {
    const { container } = render(
      <CMSLink label="evil" url="data:text/html,<script>alert(1)</script>" />,
    );
    expect(container.querySelector('a')?.getAttribute('href')).toBe('#');
  });

  it('preserves an https url', () => {
    const { container } = render(<CMSLink label="ok" url="https://example.com/pricing" />);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com/pricing');
  });

  it('preserves a mailto: url', () => {
    const { container } = render(<CMSLink label="ok" url="mailto:hi@example.com" />);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('mailto:hi@example.com');
  });

  it('collapses a javascript: url on the button appearance (CTA/hero path)', () => {
    const { container } = render(
      <CMSLink appearance="default" label="Buy" url="javascript:alert(document.cookie)" />,
    );
    expect(container.querySelector('a')?.getAttribute('href')).toBe('#');
  });

  it('builds reference hrefs from the document slug', () => {
    const { container } = render(
      <CMSLink
        label="About"
        reference={{ relationTo: 'pages', value: { slug: 'about' } as unknown as Page }}
        type="reference"
      />,
    );
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/about');
  });

  it('renders nothing without a url', () => {
    const { container } = render(<CMSLink label="empty" />);
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('RichText — hardened serializer render path', () => {
  it('neutralizes a javascript: inline link', () => {
    const { container } = render(
      <RichText
        content={content([
          {
            type: 'paragraph',
            version: 1,
            children: [linkNode('javascript:alert(document.cookie)', 'steal')],
          },
        ])}
      />,
    );
    expect(container.querySelector('a')?.getAttribute('href')).toBe('#');
  });

  it('preserves a safe inline link', () => {
    const { container } = render(
      <RichText
        content={content([
          {
            type: 'paragraph',
            version: 1,
            children: [linkNode('https://example.com', 'ok')],
          },
        ])}
      />,
    );
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
  });

  it('renders a script-tagged heading as h1, never as <script>', () => {
    const { container } = render(
      <RichText
        content={content([
          { type: 'heading', tag: 'script', version: 1, children: [textNode('alert(1)')] },
        ])}
      />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('h1')?.textContent).toBe('alert(1)');
  });

  it('renders a script-tagged list as ul (tag derived from listType)', () => {
    const { container } = render(
      <RichText
        content={content([
          {
            type: 'list',
            listType: 'bullet',
            tag: 'script',
            version: 1,
            children: [{ type: 'listitem', version: 1, children: [textNode('one')] }],
          },
        ])}
      />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('ul')).not.toBeNull();
  });

  it('sanitizes a javascript: upload url to "#"', () => {
    const { container } = render(
      <RichText
        content={content([
          {
            type: 'upload',
            version: 1,
            relationTo: 'media',
            value: { url: 'javascript:alert(1)', alt: 'x', width: 10, height: 10 },
          },
        ])}
      />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe('#');
  });

  it('preserves a safe upload url', () => {
    const { container } = render(
      <RichText
        content={content([
          {
            type: 'upload',
            version: 1,
            relationTo: 'media',
            value: { url: 'https://cdn.example.com/a.png', alt: 'a', width: 10, height: 10 },
          },
        ])}
      />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example.com/a.png',
    );
  });

  it('routes cta blocks to the app block renderer', () => {
    const { getByTestId } = render(
      <RichText
        content={content([{ type: 'block', version: 1, fields: { blockType: 'cta', id: '1' } }])}
      />,
    );
    expect(getByTestId('cta-block')).toBeTruthy();
  });

  it('renders plain paragraph text (parity smoke)', () => {
    const { getByText } = render(
      <RichText
        content={content([{ type: 'paragraph', version: 1, children: [textNode('hello world')] }])}
      />,
    );
    expect(getByText('hello world')).toBeTruthy();
  });
});
