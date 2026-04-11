/**
 * RevealUI Rich Text Editor - React Client Components
 *
 * Provides client-side rendering components for Lexical content.
 * Converts Lexical JSON state to React elements without requiring a server.
 */

'use client';

import type { SerializedAutoLinkNode, SerializedLinkNode } from '@lexical/link';
import type { SerializedListItemNode, SerializedListNode } from '@lexical/list';
import type { SerializedHeadingNode } from '@lexical/rich-text';
import type { SerializedTableCellNode } from '@lexical/table';
import {
  IS_BOLD,
  IS_CODE,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_UNDERLINE,
  type SerializedEditorState,
  type SerializedElementNode,
  type SerializedLexicalNode,
  type SerializedTextNode,
} from 'lexical';
import { Fragment, type JSX } from 'react';

// ============================================
// TYPES
// ============================================

interface SerializedCodeHighlightNode extends SerializedElementNode {
  type: 'code-highlight';
  highlightType?: string;
}

interface SerializedImageNodeData {
  type: 'image';
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  caption?: string;
  fields?: {
    src?: string;
    alt?: string;
    width?: number;
    height?: number;
    caption?: string;
  };
}

interface SerializedBlockNode extends SerializedLexicalNode {
  type: 'block';
  fields?: Record<string, unknown>;
}

export interface ClientSerializeOptions {
  renderBlock?: (node: SerializedBlockNode, index: number) => JSX.Element | null;
  renderLink?: (
    node: SerializedLinkNode,
    children: JSX.Element | null,
    index: number,
  ) => JSX.Element;
  renderImage?: (
    data: {
      src?: string;
      alt?: string;
      width?: number;
      height?: number;
      caption?: string;
    },
    index: number,
  ) => JSX.Element | null;
}

// ============================================
// TEXT SERIALIZATION
// ============================================

function serializeTextNode(node: SerializedTextNode, index: number): JSX.Element {
  let text: JSX.Element = <Fragment key={index}>{node.text}</Fragment>;

  const format = node.format || 0;

  if (format & IS_BOLD) {
    text = <strong key={index}>{text}</strong>;
  }
  if (format & IS_ITALIC) {
    text = <em key={index}>{text}</em>;
  }
  if (format & IS_UNDERLINE) {
    text = (
      <span key={index} style={{ textDecoration: 'underline' }}>
        {text}
      </span>
    );
  }
  if (format & IS_STRIKETHROUGH) {
    text = (
      <span key={index} style={{ textDecoration: 'line-through' }}>
        {text}
      </span>
    );
  }
  if (format & IS_CODE) {
    text = <code key={index}>{node.text}</code>;
  }
  if (format & IS_SUBSCRIPT) {
    text = <sub key={index}>{text}</sub>;
  }
  if (format & IS_SUPERSCRIPT) {
    text = <sup key={index}>{text}</sup>;
  }

  return text;
}

// ============================================
// RECURSIVE SERIALIZATION
// ============================================

function serializeChildren(
  children: SerializedLexicalNode[] | undefined,
  options?: ClientSerializeOptions,
): JSX.Element | null {
  if (!children || children.length === 0) return null;
  return (
    <Fragment>{children.map((child, index) => serializeNode(child, index, options))}</Fragment>
  );
}

function serializeNode(
  node: SerializedLexicalNode,
  index: number,
  options?: ClientSerializeOptions,
): JSX.Element | null {
  if (!node) return null;

  const n = node as SerializedElementNode;

  // Text node
  if (node.type === 'text') {
    return serializeTextNode(node as SerializedTextNode, index);
  }

  // Linebreak
  if (node.type === 'linebreak') {
    return <br key={index} />;
  }

  // Tab
  if (node.type === 'tab') {
    return <span key={index}>{'{"\t"}'}</span>;
  }

  // Paragraph
  if (node.type === 'paragraph') {
    return <p key={index}>{serializeChildren(n.children, options)}</p>;
  }

  // Heading
  if (node.type === 'heading') {
    const headingNode = node as SerializedHeadingNode;
    const Tag = (headingNode.tag || 'h1') as keyof JSX.IntrinsicElements;
    return <Tag key={index}>{serializeChildren(n.children, options)}</Tag>;
  }

  // Quote
  if (node.type === 'quote') {
    return <blockquote key={index}>{serializeChildren(n.children, options)}</blockquote>;
  }

  // List
  if (node.type === 'list') {
    const listNode = node as SerializedListNode;
    const Tag = listNode.listType === 'number' ? 'ol' : 'ul';
    return <Tag key={index}>{serializeChildren(n.children, options)}</Tag>;
  }

  // List item
  if (node.type === 'listitem') {
    const listItemNode = node as SerializedListItemNode;
    return (
      <li key={index} value={listItemNode.value}>
        {serializeChildren(n.children, options)}
      </li>
    );
  }

  // Link
  if (node.type === 'link') {
    const linkNode = node as SerializedLinkNode;
    const children = serializeChildren(n.children, options);

    if (options?.renderLink) {
      return options.renderLink(linkNode, children, index);
    }

    const href = linkNode.url || '#';
    const target = linkNode.target ? '_blank' : undefined;
    const rel = linkNode.target ? 'noopener noreferrer' : undefined;

    return (
      <a key={index} href={href} target={target} rel={rel}>
        {children}
      </a>
    );
  }

  // Autolink
  if (node.type === 'autolink') {
    const autoLinkNode = node as SerializedAutoLinkNode;
    return (
      <a key={index} href={autoLinkNode.url || '#'}>
        {serializeChildren(n.children, options)}
      </a>
    );
  }

  // Image
  if (node.type === 'image') {
    const imageNode = node as unknown as SerializedImageNodeData;
    const src = imageNode.fields?.src || imageNode.src || '';
    const alt = imageNode.fields?.alt || imageNode.alt || '';
    const width = imageNode.fields?.width || imageNode.width;
    const height = imageNode.fields?.height || imageNode.height;
    const caption = imageNode.fields?.caption || imageNode.caption;

    if (options?.renderImage) {
      return options.renderImage({ src, alt, width, height, caption }, index);
    }

    return (
      <figure key={index} style={{ margin: '16px 0', textAlign: 'center' }}>
        {/* biome-ignore lint/performance/noImgElement: Client rendering doesn't require Next.js Image. */}
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
        />
        {caption && (
          <figcaption
            style={{ marginTop: '8px', fontSize: '14px', color: '#64748b', fontStyle: 'italic' }}
          >
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // Horizontal rule
  if (node.type === 'horizontalrule') {
    return <hr key={index} />;
  }

  // Code block
  if (node.type === 'code') {
    return (
      <pre key={index}>
        <code>{serializeChildren(n.children, options)}</code>
      </pre>
    );
  }

  // Code highlight
  if (node.type === 'code-highlight') {
    const codeHighlightNode = node as SerializedCodeHighlightNode;
    return (
      <span key={index} className={codeHighlightNode.highlightType}>
        {serializeChildren(n.children, options)}
      </span>
    );
  }

  // Block (custom block types)
  if (node.type === 'block') {
    if (options?.renderBlock) {
      return options.renderBlock(node as SerializedBlockNode, index);
    }
    return null;
  }

  // Table
  if (node.type === 'table') {
    return (
      <table key={index}>
        <tbody>{serializeChildren(n.children, options)}</tbody>
      </table>
    );
  }

  // Table row
  if (node.type === 'tablerow') {
    return <tr key={index}>{serializeChildren(n.children, options)}</tr>;
  }

  // Table cell
  if (node.type === 'tablecell') {
    const tableCellNode = node as SerializedTableCellNode;
    const isHeader = (tableCellNode.headerState ?? 0) !== 0;
    const Tag = isHeader ? 'th' : 'td';
    return (
      <Tag key={index} colSpan={tableCellNode.colSpan} rowSpan={tableCellNode.rowSpan}>
        {serializeChildren(n.children, options)}
      </Tag>
    );
  }

  // Unknown node type  -  try to render children
  if (n.children) {
    return <Fragment key={index}>{serializeChildren(n.children, options)}</Fragment>;
  }

  return null;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Serialize a Lexical editor state to React elements (client-side)
 */
export function serializeLexicalStateClient(
  data: SerializedEditorState | null | undefined,
  options?: ClientSerializeOptions,
): JSX.Element | null {
  if (!data?.root?.children) {
    return null;
  }

  return serializeChildren(data.root.children, options);
}

/**
 * Client-side RichText rendering component
 */
export function RichTextContent({
  data,
  className,
  ...options
}: {
  data: SerializedEditorState | null | undefined;
  className?: string;
} & ClientSerializeOptions): JSX.Element | null {
  if (!data) return null;

  const content = serializeLexicalStateClient(data, options);
  if (!content) return null;

  return <div className={className}>{content}</div>;
}
