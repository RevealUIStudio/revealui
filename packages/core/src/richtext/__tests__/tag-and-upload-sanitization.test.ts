/**
 * Tag + Upload Sanitization Tests for the Lexical RSC Renderer
 *
 * Heading `tag` values and upload `value.url` are author-controlled stored
 * JSON. Verifies:
 *  - heading tags render only from the h1-h6 allow-list (a "script" tag must
 *    never become a <script> element — React does not escape a script
 *    element's text children);
 *  - list tags derive from listType, never from the stored tag;
 *  - upload nodes render with sanitized URLs (default + custom renderer);
 *  - custom image renderers receive a sanitized src.
 */

import type { SerializedEditorState } from 'lexical';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { serializeLexicalState } from '../exports/server/rsc.js';

// ============================================
// HELPERS
// ============================================

function textNode(text: string) {
  return { type: 'text', text, format: 0, version: 1 };
}

function state(children: unknown[]): SerializedEditorState {
  return {
    root: { type: 'root', version: 1, children },
  } as unknown as SerializedEditorState;
}

function findElements(element: ReactElement | null, tagName: string): ReactElement[] {
  if (!element) return [];

  const results: ReactElement[] = [];

  if (element.type === tagName) {
    results.push(element);
  }

  const children = element.props?.children;
  if (children) {
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === 'object' && 'type' in child) {
          results.push(...findElements(child as ReactElement, tagName));
        }
      }
    } else if (typeof children === 'object' && 'type' in children) {
      results.push(...findElements(children as ReactElement, tagName));
    }
  }

  return results;
}

function heading(tag: string | undefined, text = 'title') {
  return { type: 'heading', tag, version: 1, children: [textNode(text)] };
}

function list(listType: string, tag: string) {
  return {
    type: 'list',
    listType,
    tag,
    version: 1,
    children: [{ type: 'listitem', version: 1, children: [textNode('one')] }],
  };
}

function upload(value: unknown) {
  return { type: 'upload', version: 1, relationTo: 'media', value };
}

// ============================================
// TESTS
// ============================================

describe('heading tag allow-list', () => {
  it.each(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])('renders %s headings', (tag) => {
    const el = serializeLexicalState(state([heading(tag)]));
    expect(findElements(el as ReactElement, tag)).toHaveLength(1);
  });

  it('renders a script-tagged heading as h1, never as <script>', () => {
    const el = serializeLexicalState(state([heading('script', 'alert(1)')]));
    expect(findElements(el as ReactElement, 'script')).toHaveLength(0);
    expect(findElements(el as ReactElement, 'h1')).toHaveLength(1);
  });

  it.each(['iframe', 'style', 'img', 'object'])('renders a %s-tagged heading as h1', (tag) => {
    const el = serializeLexicalState(state([heading(tag)]));
    expect(findElements(el as ReactElement, tag)).toHaveLength(0);
    expect(findElements(el as ReactElement, 'h1')).toHaveLength(1);
  });

  it('defaults a missing tag to h1', () => {
    const el = serializeLexicalState(state([heading(undefined)]));
    expect(findElements(el as ReactElement, 'h1')).toHaveLength(1);
  });
});

describe('list tag derivation', () => {
  it('renders a number list as ol regardless of the stored tag', () => {
    const el = serializeLexicalState(state([list('number', 'script')]));
    expect(findElements(el as ReactElement, 'ol')).toHaveLength(1);
    expect(findElements(el as ReactElement, 'script')).toHaveLength(0);
  });

  it('renders a bullet list as ul regardless of the stored tag', () => {
    const el = serializeLexicalState(state([list('bullet', 'script')]));
    expect(findElements(el as ReactElement, 'ul')).toHaveLength(1);
    expect(findElements(el as ReactElement, 'script')).toHaveLength(0);
  });
});

describe('upload nodes', () => {
  it('renders a safe upload url as an img src', () => {
    const el = serializeLexicalState(
      state([upload({ url: 'https://cdn.example.com/a.png', alt: 'a', width: 10, height: 10 })]),
    );
    const imgs = findElements(el as ReactElement, 'img');
    expect(imgs[0]?.props?.src).toBe('https://cdn.example.com/a.png');
  });

  it('sanitizes a javascript: upload url to "#"', () => {
    const el = serializeLexicalState(state([upload({ url: 'javascript:alert(1)', alt: 'x' })]));
    const imgs = findElements(el as ReactElement, 'img');
    expect(imgs[0]?.props?.src).toBe('#');
  });

  it('allows data:image/ upload urls (image context)', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
    const el = serializeLexicalState(state([upload({ url: dataUri, alt: 'x' })]));
    const imgs = findElements(el as ReactElement, 'img');
    expect(imgs[0]?.props?.src).toBe(dataUri);
  });

  it('blocks data:text/html upload urls', () => {
    const el = serializeLexicalState(
      state([upload({ url: 'data:text/html,<script>alert(1)</script>', alt: 'x' })]),
    );
    const imgs = findElements(el as ReactElement, 'img');
    expect(imgs[0]?.props?.src).toBe('#');
  });

  it('renders nothing for an unpopulated (string id) upload value', () => {
    const el = serializeLexicalState(state([upload('media-doc-id')]));
    expect(findElements(el as ReactElement, 'img')).toHaveLength(0);
    expect(findElements(el as ReactElement, 'figure')).toHaveLength(0);
  });

  it('passes the sanitized url to a custom renderUpload', () => {
    let received: string | undefined;
    serializeLexicalState(state([upload({ url: 'javascript:alert(1)', alt: 'x' })]), {
      renderUpload: (data) => {
        received = data.url;
        return null;
      },
    });
    expect(received).toBe('#');
  });
});

describe('custom image renderer', () => {
  it('receives a sanitized src', () => {
    let received: string | undefined;
    serializeLexicalState(
      state([{ type: 'image', version: 1, fields: { src: 'javascript:alert(1)', alt: 'x' } }]),
      {
        renderImage: (data) => {
          received = data.src;
          return null;
        },
      },
    );
    expect(received).toBe('#');
  });

  it('receives a safe src unchanged', () => {
    let received: string | undefined;
    serializeLexicalState(
      state([
        { type: 'image', version: 1, fields: { src: 'https://cdn.example.com/a.png', alt: 'x' } },
      ]),
      {
        renderImage: (data) => {
          received = data.src;
          return null;
        },
      },
    );
    expect(received).toBe('https://cdn.example.com/a.png');
  });
});
