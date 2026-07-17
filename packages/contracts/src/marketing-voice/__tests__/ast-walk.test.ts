import { describe, expect, it } from 'vitest';
import {
  findAdrCiteInBlock,
  getProseContainers,
  getProseSlots,
  type MarketingBlock,
  UnmappedBlockTypeError,
  walkLexicalAst,
} from '../blocks.js';
import {
  code,
  contentBlock,
  heading,
  heroBlock,
  link,
  list,
  listItem,
  paragraph,
  text,
} from './helpers.js';

describe('walkLexicalAst', () => {
  it('yields heading + paragraph + text nodes from a seed-shaped hero block', () => {
    const block = heroBlock(heading('h1', 'RevealUI'), paragraph(text('People and agents.')));
    const types = [...walkLexicalAst(block)].map((n) => n.type);
    expect(types).toContain('heading');
    expect(types).toContain('paragraph');
    expect(types.filter((t) => t === 'text')).toHaveLength(2);
  });

  it('prunes code subtrees — a text node inside a code node is never yielded', () => {
    const block = contentBlock(paragraph(text('intro')), code('RVC at $0.001'));
    const nodes = [...walkLexicalAst(block)];
    expect(nodes.some((n) => n.type === 'code')).toBe(false);
    // The code node's inner text ("RVC at $0.001") must not surface either.
    expect(nodes.some((n) => n.type === 'text' && n.text === 'RVC at $0.001')).toBe(false);
    expect(nodes.some((n) => n.type === 'text' && n.text === 'intro')).toBe(true);
  });

  it('yields link nodes (so findAdrCiteInBlock can consume them)', () => {
    const block = contentBlock(
      paragraph(text('see '), link('../docs/decisions/2026-05-12-x.md', 'ADR')),
    );
    const links = [...walkLexicalAst(block)].filter((n) => n.type === 'link');
    expect(links).toHaveLength(1);
    expect(links[0]?.url).toBe('../docs/decisions/2026-05-12-x.md');
  });

  it('does not throw on deeply nested trees (depth-bound)', () => {
    let node = text('deep');
    for (let i = 0; i < 40; i++) node = { type: 'paragraph', children: [node] };
    const block = contentBlock(node);
    expect(() => [...walkLexicalAst(block)]).not.toThrow();
  });
});

describe('getProseSlots', () => {
  it('normalizes a plain-string slot to one synthetic paragraph', () => {
    const block: MarketingBlock = { blockType: 'hero', richText: 'Just a string headline' };
    const containers = getProseContainers(block);
    expect(containers).toHaveLength(1);
    expect(containers[0]?.nodeType).toBe('paragraph');
    expect(containers[0]?.text).toBe('Just a string headline');
  });

  it('throws UnmappedBlockTypeError for an unregistered blockType (fail-closed)', () => {
    const block: MarketingBlock = { blockType: 'mystery', richText: 'x' };
    expect(() => getProseSlots(block)).toThrow(UnmappedBlockTypeError);
  });
});

describe('getProseContainers', () => {
  it('does not double-count a paragraph nested inside a quote', () => {
    const block = contentBlock({ type: 'quote', children: [paragraph(text('quoted line'))] });
    const containers = getProseContainers(block);
    expect(containers).toHaveLength(1);
    expect(containers[0]?.nodeType).toBe('quote');
    expect(containers[0]?.text).toBe('quoted line');
  });

  it('expands a list into one container per listitem', () => {
    const block = contentBlock(list(listItem('first'), listItem('second')));
    const containers = getProseContainers(block);
    expect(containers.map((c) => c.text)).toEqual(['first', 'second']);
    expect(containers.every((c) => c.nodeType === 'listitem')).toBe(true);
  });

  it('carries the heading tag through', () => {
    const block = heroBlock(heading('h2', 'Section'));
    const containers = getProseContainers(block);
    expect(containers[0]?.tag).toBe('h2');
  });
});

describe('findAdrCiteInBlock', () => {
  it('finds an ADR-cite link via node.url', () => {
    const block = contentBlock(
      paragraph(text('x '), link('../docs/decisions/2026-05-12-rvc.md', 'per ADR')),
    );
    expect(findAdrCiteInBlock(block)).not.toBeNull();
  });

  it('finds an ADR-cite link via fields.url', () => {
    const block = contentBlock(
      paragraph(text('x '), {
        type: 'link',
        fields: { url: '../docs/decisions/2026-05-12-rvc.md' },
        children: [text('per ADR')],
      }),
    );
    expect(findAdrCiteInBlock(block)).not.toBeNull();
  });

  it('returns null for a non-ADR link', () => {
    const block = contentBlock(paragraph(text('x '), link('../some-other-doc.md', 'foo')));
    expect(findAdrCiteInBlock(block)).toBeNull();
  });

  it('returns null for an invalid-date ADR filename (Date.parse rejects month 13)', () => {
    const block = contentBlock(paragraph(link('../docs/decisions/2026-13-99-bogus.md', 'foo')));
    expect(findAdrCiteInBlock(block)).toBeNull();
  });
});
