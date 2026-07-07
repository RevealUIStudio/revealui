/**
 * Content Validation Tests — dangerous URL protocols + element-tag allow-list
 *
 * The write API (pages/posts routes) rejects a payload when this validator
 * reports it invalid, so these tests pin the ingress contract:
 *  - javascript:/vbscript:/data: URLs in url/src/href fields are rejected;
 *  - heading/list nodes may only carry allow-listed tags (a "script" tag
 *    would render as a live <script> element downstream);
 *  - `tag` fields on non-element nodes are NOT rejected (no false positives
 *    on block data that happens to use the field name).
 */

import { describe, expect, it } from 'vitest';
import { validateBlocks, validateContent } from '../content-validation.js';

function headingContent(tag: string) {
  return {
    root: {
      type: 'root',
      children: [{ type: 'heading', tag, version: 1, children: [{ type: 'text', text: 'hi' }] }],
    },
  };
}

function listContent(tag: string, listType = 'bullet') {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'list',
          listType,
          tag,
          version: 1,
          children: [{ type: 'listitem', version: 1, children: [{ type: 'text', text: 'one' }] }],
        },
      ],
    },
  };
}

describe('validateContent — dangerous URL protocols (regression)', () => {
  it('rejects a javascript: link url', () => {
    const result = validateContent({
      root: {
        type: 'root',
        children: [{ type: 'link', fields: { url: 'javascript:alert(1)' } }],
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toContain('Dangerous URL protocol');
  });

  it('accepts an https link url', () => {
    const result = validateContent({
      root: {
        type: 'root',
        children: [{ type: 'link', fields: { url: 'https://example.com' } }],
      },
    });
    expect(result.valid).toBe(true);
  });
});

describe('validateContent — element tag allow-list', () => {
  it.each(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])('accepts heading tag %s', (tag) => {
    expect(validateContent(headingContent(tag)).valid).toBe(true);
  });

  it('accepts an uppercase heading tag (case-normalized)', () => {
    expect(validateContent(headingContent('H2')).valid).toBe(true);
  });

  it('rejects a script-tagged heading', () => {
    const result = validateContent(headingContent('script'));
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toContain('Disallowed element tag');
    expect(result.errors?.[0]).toContain('script');
  });

  it.each(['iframe', 'style', 'img', 'object', 'embed'])('rejects heading tag %s', (tag) => {
    expect(validateContent(headingContent(tag)).valid).toBe(false);
  });

  it.each(['ol', 'ul'])('accepts list tag %s', (tag) => {
    expect(validateContent(listContent(tag)).valid).toBe(true);
  });

  it('rejects a script-tagged list', () => {
    const result = validateContent(listContent('script'));
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toContain('Disallowed element tag');
  });

  it('ignores tag fields on non-element nodes', () => {
    const result = validateContent({
      blocks: [{ type: 'productCard', tag: 'featured' }],
    });
    expect(result.valid).toBe(true);
  });

  it('ignores tag fields on objects without a type', () => {
    expect(validateContent({ tag: 'anything-at-all' }).valid).toBe(true);
  });
});

describe('validateBlocks — write-API surface', () => {
  it('rejects a blocks array carrying a script-tagged heading', () => {
    const blocks = [
      {
        blockType: 'content',
        richText: {
          root: {
            type: 'root',
            children: [{ type: 'heading', tag: 'script', version: 1, children: [] }],
          },
        },
      },
    ];
    expect(validateBlocks(blocks).valid).toBe(false);
  });

  it('accepts a clean blocks array', () => {
    const blocks = [
      {
        blockType: 'content',
        richText: {
          root: {
            type: 'root',
            children: [{ type: 'heading', tag: 'h2', version: 1, children: [] }],
          },
        },
      },
    ];
    expect(validateBlocks(blocks).valid).toBe(true);
  });
});

describe('validateContent — data:image/ on image src (render-contract parity)', () => {
  function imageContent(src: string) {
    return {
      root: {
        type: 'root',
        children: [{ type: 'image', src, version: 1 }],
      },
    };
  }

  it('accepts a data:image/png src (the renderer allows it via sanitizeUrl image context)', () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
    expect(validateContent(imageContent(png)).valid).toBe(true);
  });

  it('rejects a data:text/html src (not an image data URI)', () => {
    const result = validateContent(imageContent('data:text/html,<script>alert(1)</script>'));
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toContain('Dangerous URL protocol');
  });

  it('rejects a javascript: src', () => {
    expect(validateContent(imageContent('javascript:alert(1)')).valid).toBe(false);
  });

  it('rejects data:image/ on a link url (link context, not image)', () => {
    const result = validateContent({
      root: {
        type: 'root',
        children: [{ type: 'link', fields: { url: 'data:image/png;base64,AAAA' } }],
      },
    });
    expect(result.valid).toBe(false);
  });

  it('rejects data:image/ on an href field (link context, not image)', () => {
    const result = validateContent({
      root: {
        type: 'root',
        children: [{ type: 'link', href: 'data:image/png;base64,AAAA' }],
      },
    });
    expect(result.valid).toBe(false);
  });
});
