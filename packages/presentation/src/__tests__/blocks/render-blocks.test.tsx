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

    // Every field path lives under `blocks.<index>.data.*`  -  the same
    // structure a session server's materialized draft carries.
    const title = container.querySelector('[data-rvui-field="blocks.0.data.title"]');
    expect(title).not.toBeNull();
    expect(title?.getAttribute('data-rvui-doc')).toBe('page-42');
    expect(title?.textContent).toBe('Governed agents');

    // Nested repeater item field path uses items.<index>.<field>.
    const nestedBody = container.querySelector('[data-rvui-field="blocks.1.data.items.1.body"]');
    expect(nestedBody).not.toBeNull();
    expect(nestedBody?.getAttribute('data-rvui-doc')).toBe('page-42');
    expect(nestedBody?.textContent).toBe('Body two.');

    const nestedLabel = container.querySelector('[data-rvui-field="blocks.1.data.items.0.title"]');
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
    expect(container.querySelector('[data-rvui-field="blocks.0.data.heading"]')?.textContent).toBe(
      'Deploy in one command',
    );
    // Snippet renders as static text (both lines joined), never executed.
    const snippet = container.querySelector('[data-rvui-field="blocks.0.data.snippet.lines"]');
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

    expect(container.querySelector('[data-rvui-field="blocks.0.data.content"]')?.textContent).toBe(
      'Body copy',
    );
    const heading = container.querySelector('[data-rvui-field="blocks.1.data.text"]');
    expect(heading?.tagName).toBe('H2');
    expect(container.querySelector('[data-rvui-field="blocks.2.data.content"]')?.textContent).toBe(
      'Quoted',
    );
    expect(
      container.querySelector('[data-rvui-field="blocks.2.data.attribution"]')?.textContent,
    ).toBe('Someone');
    expect(
      container.querySelector('[data-rvui-field="blocks.3.data.items.1.content"]')?.textContent,
    ).toBe('Two');
    expect(container.querySelector('hr')).not.toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Cross-seam contract: every emitted `data-rvui-field` path must be a VALID
// path into the page draft the session server actually materializes
// (`{ id, slug, blocks, ... }`  -  see apps/server's `materializePageDraft`).
// This is the test that would have caught the annotation-path bug: prior
// component-level tests only checked that RenderBlocks' output was
// self-consistent (the path it emits matches the path it emits), never that
// the path RESOLVES against the real draft shape. It didn't, because every
// block component reads its fields from `block.data.*`, but the path handed
// down stopped at the block index, landing patches as siblings of `data`
// instead of inside it.
// -----------------------------------------------------------------------------

/**
 * Plain segment-walk (no regex): resolves a dot-path against a value the same
 * way the session server's `setAtPath` (and the runtime's) would descend it.
 * Returns `undefined` on any missing/invalid step.
 */
function resolveDraftPath(root: unknown, path: string): unknown {
  let cursor: unknown = root;
  for (const segment of path.split('.')) {
    if (cursor === null || cursor === undefined) return undefined;
    if (Array.isArray(cursor)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      cursor = cursor[index];
    } else if (typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cursor;
}

describe('RenderBlocks — draft-path contract (cross-seam)', () => {
  // One of every block type RenderBlocks supports, including nested repeater
  // items, mirroring a real page's `blocks` array.
  const contractBlocks: Block[] = [
    {
      id: 'hero-1',
      type: 'hero',
      data: {
        eyebrow: 'RevealUI',
        title: 'Governed agents',
        subtitle: 'One roof for your business.',
        support: 'Self-hosted, open source.',
        links: [{ label: 'Start', href: '/start', variant: 'primary' }],
      },
    },
    {
      id: 'sec-1',
      type: 'section',
      data: {
        eyebrow: 'FAQ',
        heading: 'Questions',
        body: 'Answers to the common ones.',
        items: [{ label: 'Beat', title: 'First', body: 'Body one.' }, { body: 'Body two.' }],
      },
    },
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
    { id: 'text-1', type: 'text', data: { content: 'Body copy', format: 'plain' } },
    { id: 'heading-1', type: 'heading', data: { text: 'A Heading', level: 'h2' } },
    { id: 'quote-1', type: 'quote', data: { content: 'Quoted', attribution: 'Someone' } },
    {
      id: 'list-1',
      type: 'list',
      data: {
        variant: 'unordered',
        items: [
          { id: 'i0', content: 'One' },
          { id: 'i1', content: 'Two' },
        ],
      },
    },
    { id: 'divider-1', type: 'divider', data: { variant: 'dashed' } },
    { id: 'spacer-1', type: 'spacer', data: { height: '3rem' } },
  ];

  it('every emitted data-rvui-field path resolves to a defined string in the materialized draft', () => {
    // The exact shape `materializePageDraft` (apps/server) produces: a page
    // draft object with `blocks` as a top-level key.
    const draft = { blocks: contractBlocks };

    const { container } = render(<RenderBlocks blocks={contractBlocks} docId="page-1" editable />);
    const annotated = Array.from(container.querySelectorAll('[data-rvui-field]'));

    // Sanity: the fixture actually exercises annotation (would falsely pass a
    // regression that stopped emitting any attributes at all).
    expect(annotated.length).toBeGreaterThan(10);

    for (const el of annotated) {
      const path = el.getAttribute('data-rvui-field');
      expect(path).not.toBeNull();
      const resolved = resolveDraftPath(draft, path as string);
      // Almost every field is a scalar string; the CTA snippet's `.lines` is
      // the one legitimate array-of-strings leaf (displayed joined). Either
      // is a genuinely resolved leaf; `undefined` or a whole block/object
      // (the corruption signature: the path stopped short of the real field)
      // is not.
      const isValidLeaf =
        typeof resolved === 'string' ||
        (Array.isArray(resolved) && resolved.every((v) => typeof v === 'string'));
      expect(
        isValidLeaf,
        `path "${path}" did not resolve to a string or string[]: got ${JSON.stringify(resolved)}`,
      ).toBe(true);
    }
  });
});
