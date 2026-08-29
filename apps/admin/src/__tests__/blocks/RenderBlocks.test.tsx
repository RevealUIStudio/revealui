/**
 * Tests for RenderBlocks component
 */

import type { Page } from '@revealui/core/types/admin';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RenderBlocks } from '@/lib/blocks/RenderBlocks';

// Mock block components
vi.mock('@/lib/blocks/CallToAction/Component', () => ({
  CallToActionBlock: ({ links }: { links?: Array<{ link: { label: string } }> }) => (
    <div data-testid="cta-block">
      {links?.map((l) => (
        <span key={l.link.label}>{l.link.label}</span>
      ))}
    </div>
  ),
}));

vi.mock('@/lib/blocks/Content/Component', () => ({
  ContentBlock: ({ columns }: { columns?: Array<{ richText?: unknown }> }) => (
    <div data-testid="content-block">{columns?.length || 0} columns</div>
  ),
}));

vi.mock('@/lib/blocks/Form/Component', () => ({
  FormBlock: ({ form }: { form: { title: string } }) => (
    <div data-testid="form-block">{form.title}</div>
  ),
}));

vi.mock('@/lib/blocks/ArchiveBlock/Component', () => ({
  ArchiveBlock: () => <div data-testid="archive-block">Archive</div>,
}));

vi.mock('@/lib/blocks/MediaBlock/Component', () => ({
  MediaBlock: () => <div data-testid="media-block">Media</div>,
}));

vi.mock('@/lib/blocks/Code/Component', () => ({
  CodeBlock: ({ code, language }: { code: string; language?: string | null }) => (
    <pre data-testid="code-block" data-language={language ?? ''}>
      {code}
    </pre>
  ),
}));

vi.mock('@/lib/blocks/Banner/Component', () => ({
  BannerBlock: ({ style }: { style: string }) => (
    <div data-testid="banner-block" data-style={style}>
      Banner
    </div>
  ),
}));

vi.mock('@/lib/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('RenderBlocks', () => {
  it('renders nothing when blocks array is empty', () => {
    const { container } = render(<RenderBlocks blocks={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when blocks is null', () => {
    const { container } = render(<RenderBlocks blocks={null as unknown as Page['blocks']} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders CTA block correctly', () => {
    const blocks: Page['blocks'] = [
      {
        blockType: 'cta',
        links: [
          {
            link: {
              label: 'Click here',
              url: 'https://example.com',
            },
          },
        ],
      },
    ];

    render(<RenderBlocks blocks={blocks} />);
    expect(screen.getByTestId('cta-block')).toBeInTheDocument();
    expect(screen.getByText('Click here')).toBeInTheDocument();
  });

  it('renders content block correctly', () => {
    const blocks: Page['blocks'] = [
      {
        blockType: 'content',
        columns: [
          {
            richText: {
              root: {
                type: 'root',
                children: [],
                direction: 'ltr',
                format: '',
                indent: 0,
                version: 1,
              },
            },
            size: 'full',
            enableLink: false,
            link: {
              type: null,
              url: null,
              label: '',
            },
          },
        ],
      },
    ];

    render(<RenderBlocks blocks={blocks} />);
    expect(screen.getByTestId('content-block')).toBeInTheDocument();
  });

  it('renders a code block offered by Pages.blocks', () => {
    const blocks: Page['blocks'] = [
      {
        blockType: 'code',
        code: 'const n = 1;',
        language: 'typescript',
      },
    ];

    render(<RenderBlocks blocks={blocks} />);
    expect(screen.getByTestId('code-block')).toBeInTheDocument();
    expect(screen.getByText('const n = 1;')).toBeInTheDocument();
  });

  it('renders a banner block offered by Pages.blocks', () => {
    const blocks: Page['blocks'] = [
      {
        blockType: 'banner',
        style: 'info',
        content: {
          root: {
            type: 'root',
            children: [],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
      },
    ];

    render(<RenderBlocks blocks={blocks} />);
    expect(screen.getByTestId('banner-block')).toBeInTheDocument();
  });

  it('handles unknown block types gracefully', () => {
    const blocks: Page['blocks'] = [
      {
        blockType: 'unknown' as 'cta',
        id: 'test',
      },
    ];

    const { container } = render(<RenderBlocks blocks={blocks} />);
    // Should not crash, but may not render anything
    expect(container).toBeTruthy();
  });
});
