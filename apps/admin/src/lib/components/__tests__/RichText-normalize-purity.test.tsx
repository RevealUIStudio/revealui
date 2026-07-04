/**
 * Purity regression for the RichText checklist normalizer.
 *
 * `normalizeChecklists` fills the `checked: false` that Lexical omits on
 * unchecked check-list items. It must do so on a COPY — the caller's `content`
 * object may be shared or memoized across renders, so an in-place mutation would
 * leak into other consumers and make a second render observe the first render's
 * side effect.
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
vi.mock('@/lib/blocks/Banner/Component', () => ({ BannerBlock: () => <div /> }));
vi.mock('@/lib/blocks/CallToAction/Component', () => ({ CallToActionBlock: () => <div /> }));
vi.mock('@/lib/blocks/Code/Component', () => ({ CodeBlock: () => <div /> }));
vi.mock('@/lib/blocks/MediaBlock/Component', () => ({ MediaBlock: () => <div /> }));

import RichText, { type RichTextContent } from '../RichText/index';

/** A check list with one checked item and one unchecked item (no `checked` key). */
function checklistContent(): RichTextContent {
  return {
    root: {
      type: 'root',
      direction: null,
      format: '',
      indent: 0,
      version: 1,
      children: [
        {
          type: 'list',
          listType: 'check',
          tag: 'ul',
          version: 1,
          children: [
            {
              type: 'listitem',
              version: 1,
              checked: true,
              children: [{ type: 'text', text: 'done', format: 0, version: 1 }],
            },
            {
              // Unchecked item: Lexical omits `checked` entirely here.
              type: 'listitem',
              version: 1,
              children: [{ type: 'text', text: 'todo', format: 0, version: 1 }],
            },
          ],
        },
      ],
    },
  } as unknown as RichTextContent;
}

describe('RichText checklist normalization purity', () => {
  it('does not mutate the caller content object', () => {
    const content = checklistContent();
    const before = structuredClone(content);

    render(<RichText content={content} />);

    // The input tree is untouched — the unchecked item still has no `checked`.
    expect(content).toEqual(before);
    const list = (content.root as unknown as { children: Array<{ children: unknown[] }> })
      .children[0];
    const uncheckedItem = list?.children[1] as Record<string, unknown> | undefined;
    expect(uncheckedItem).toBeDefined();
    expect(uncheckedItem).not.toHaveProperty('checked');
  });

  it('renders a shared content object identically across two renders', () => {
    const content = checklistContent();

    const first = render(<RichText content={content} />).container.innerHTML;
    const second = render(<RichText content={content} />).container.innerHTML;

    expect(second).toBe(first);
  });
});
