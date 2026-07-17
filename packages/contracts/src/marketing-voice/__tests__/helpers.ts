import type { LexicalNodeLike, MarketingBlock } from '../blocks.js';

// Dependency-free Lexical builders. The engine targets the REAL shipped block
// shape (blockType + richText editor state), so tests construct that shape
// directly rather than parsing markdown.

export function text(value: string): LexicalNodeLike {
  return { type: 'text', text: value };
}

export function paragraph(...children: LexicalNodeLike[]): LexicalNodeLike {
  return { type: 'paragraph', children };
}

/** A paragraph holding a single text run — the common case. */
export function prose(value: string): LexicalNodeLike {
  return paragraph(text(value));
}

export function heading(tag: string, value: string): LexicalNodeLike {
  return { type: 'heading', tag, children: [text(value)] };
}

export function code(value: string): LexicalNodeLike {
  return { type: 'code', children: [text(value)] };
}

export function link(url: string, value: string): LexicalNodeLike {
  return { type: 'link', url, children: [text(value)] };
}

export function listItem(value: string): LexicalNodeLike {
  return { type: 'listitem', children: [text(value)] };
}

export function list(...items: LexicalNodeLike[]): LexicalNodeLike {
  return { type: 'list', listType: 'bullet', children: items };
}

export function root(...children: LexicalNodeLike[]): {
  root: { type: 'root'; children: LexicalNodeLike[] };
} {
  return { root: { type: 'root', children } };
}

export function heroBlock(...children: LexicalNodeLike[]): MarketingBlock {
  return { blockType: 'hero', richText: root(...children) };
}

export function contentBlock(...children: LexicalNodeLike[]): MarketingBlock {
  return { blockType: 'content', richText: root(...children) };
}
