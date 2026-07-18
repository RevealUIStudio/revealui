import type { Block } from '@revealui/contracts/content';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RenderBlocks } from '../../blocks/RenderBlocks.js';

const pageBlocks: Block[] = [
  {
    id: 'hero-1',
    type: 'hero',
    data: {
      eyebrow: 'RevealUI',
      title: 'Governed agents',
      subtitle: 'One roof for your business.',
      links: [{ label: 'Start', href: '/start', variant: 'primary' }],
    },
  },
  {
    id: 'sec-1',
    type: 'section',
    data: {
      heading: 'Questions',
      items: [
        { title: 'First', body: 'Body one.' },
        { label: 'Beat', body: 'Body two.' },
      ],
    },
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RenderBlocks — annotation contract', () => {
  it('emits data-rvui-doc/field on text-bearing elements when editable with a docId', () => {
    const { container } = render(<RenderBlocks blocks={pageBlocks} docId="page-42" editable />);

    const title = container.querySelector('[data-rvui-field="blocks.0.title"]');
    expect(title).not.toBeNull();
    expect(title?.getAttribute('data-rvui-doc')).toBe('page-42');
    expect(title?.textContent).toBe('Governed agents');

    // Nested repeater item field path uses items.<index>.<field>.
    const nestedBody = container.querySelector('[data-rvui-field="blocks.1.items.1.body"]');
    expect(nestedBody).not.toBeNull();
    expect(nestedBody?.getAttribute('data-rvui-doc')).toBe('page-42');
    expect(nestedBody?.textContent).toBe('Body two.');

    const nestedLabel = container.querySelector('[data-rvui-field="blocks.1.items.0.title"]');
    expect(nestedLabel?.textContent).toBe('First');
  });

  it('emits no data attributes when editable is false', () => {
    const { container } = render(<RenderBlocks blocks={pageBlocks} docId="page-42" />);
    expect(container.querySelector('[data-rvui-field]')).toBeNull();
    expect(container.querySelector('[data-rvui-doc]')).toBeNull();
  });

  it('emits no data attributes when editable is true but docId is absent', () => {
    const { container } = render(<RenderBlocks blocks={pageBlocks} editable />);
    expect(container.querySelector('[data-rvui-field]')).toBeNull();
  });
});

describe('RenderBlocks — unsupported + invalid blocks', () => {
  it('renders nothing and warns for a valid block type with no renderer', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const blocks: Block[] = [
      { id: 'code-1', type: 'code', data: { code: 'x', showLineNumbers: false } },
    ];

    const { container } = render(<RenderBlocks blocks={blocks} />);
    expect(container.textContent).toBe('');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unsupported block type: code'));
  });

  it('skips and warns for a block that fails schema validation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Missing required `title` — fails HeroBlockSchema.
    const blocks = [{ id: 'bad', type: 'hero', data: {} }] as unknown as Block[];

    const { container } = render(<RenderBlocks blocks={blocks} />);
    expect(container.textContent).toBe('');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('failed schema validation'));
  });
});

describe('RenderBlocks — cta section + primitive renderers', () => {
  it('renders a cta section with a display-only snippet and annotated fields', () => {
    const blocks: Block[] = [
      {
        id: 'cta-1',
        type: 'ctaSection',
        data: {
          heading: 'Deploy in one command',
          body: 'One roof.',
          links: [{ label: 'Install', href: '/install', variant: 'primary' }],
          snippet: { lines: ['npx create-revealui', 'cd app'], caption: 'That is it.' },
        },
      },
    ];

    const { container } = render(<RenderBlocks blocks={blocks} docId="d1" editable />);
    expect(container.querySelector('[data-rvui-field="blocks.0.heading"]')?.textContent).toBe(
      'Deploy in one command',
    );
    // Snippet renders as static text (both lines joined), never executed.
    const snippet = container.querySelector('[data-rvui-field="blocks.0.snippet.lines"]');
    expect(snippet?.textContent).toBe('npx create-revealui\ncd app');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/install');
  });

  it('renders each supported content primitive with correct field paths', () => {
    const blocks: Block[] = [
      { id: 't', type: 'text', data: { content: 'Body copy', format: 'plain' } },
      { id: 'h', type: 'heading', data: { text: 'A Heading', level: 'h2' } },
      { id: 'q', type: 'quote', data: { content: 'Quoted', attribution: 'Someone' } },
      {
        id: 'l',
        type: 'list',
        data: {
          variant: 'unordered',
          items: [
            { id: 'i0', content: 'One' },
            { id: 'i1', content: 'Two' },
          ],
        },
      },
      { id: 'd', type: 'divider', data: { variant: 'dashed' } },
      { id: 's', type: 'spacer', data: { height: '3rem' } },
    ];

    const { container } = render(<RenderBlocks blocks={blocks} docId="d2" editable />);

    expect(container.querySelector('[data-rvui-field="blocks.0.content"]')?.textContent).toBe(
      'Body copy',
    );
    const heading = container.querySelector('[data-rvui-field="blocks.1.text"]');
    expect(heading?.tagName).toBe('H2');
    expect(container.querySelector('[data-rvui-field="blocks.2.content"]')?.textContent).toBe(
      'Quoted',
    );
    expect(container.querySelector('[data-rvui-field="blocks.2.attribution"]')?.textContent).toBe(
      'Someone',
    );
    expect(
      container.querySelector('[data-rvui-field="blocks.3.items.1.content"]')?.textContent,
    ).toBe('Two');
    expect(container.querySelector('hr')).not.toBeNull();
  });
});
