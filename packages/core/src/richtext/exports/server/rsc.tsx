/**
 * RevealUI Rich Text Editor - React Server Components
 *
 * Provides server-side rendering components for Lexical content.
 * Converts Lexical JSON state to React elements without requiring a browser.
 */

import { isSafeUrl, sanitizeUrl } from '@revealui/security';
import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';
import { Fragment, type JSX } from 'react';

// Re-export SerializedEditorState for convenience
export type { SerializedEditorState };

// URL sanitization is owned by @revealui/security (single source of truth
// for every untrusted-string sink across the Suite). Re-exported here so
// existing consumers keep working.
export { isSafeUrl, sanitizeUrl };

// ============================================
// TEXT FORMAT CONSTANTS
// ============================================

const IS_BOLD = 1;
const IS_ITALIC = 2;
const IS_STRIKETHROUGH = 4;
const IS_UNDERLINE = 8;
const IS_CODE = 16;
const IS_SUBSCRIPT = 32;
const IS_SUPERSCRIPT = 64;

// ============================================
// TYPES
// ============================================

interface SerializedTextNode extends SerializedLexicalNode {
  type: 'text';
  text: string;
  format: number;
  style?: string;
}

interface SerializedElementNode extends SerializedLexicalNode {
  type: string;
  children?: SerializedLexicalNode[];
  direction?: 'ltr' | 'rtl' | null;
  format?: string | number;
  indent?: number;
  tag?: string;
  listType?: 'bullet' | 'number' | 'check';
  checked?: boolean;
  value?: number;
}

interface SerializedLinkNode extends SerializedElementNode {
  type: 'link';
  fields?: {
    url?: string;
    linkType?: 'custom' | 'internal';
    newTab?: boolean;
    doc?: { value: string; relationTo: string };
  };
}

interface SerializedAutoLinkNode extends SerializedElementNode {
  type: 'autolink';
  url?: string;
}

interface SerializedCodeHighlightNode extends SerializedElementNode {
  type: 'code-highlight';
  highlightType?: string;
}

interface SerializedTableCellNode extends SerializedElementNode {
  type: 'tablecell';
  headerState?: number;
  colSpan?: number;
  rowSpan?: number;
}

interface SerializedBlockNode extends SerializedLexicalNode {
  type: 'block';
  fields?: Record<string, unknown>;
}

export interface DefaultNodeTypes {
  type: string;
  children?: DefaultNodeTypes[];
  format?: number;
  text?: string;
  tag?: string;
  listType?: string;
  checked?: boolean;
  value?: number;
  fields?: Record<string, unknown>;
}

export interface SerializedBlockNodeGeneric<T = Record<string, unknown>>
  extends SerializedLexicalNode {
  type: 'block';
  fields: T & { blockType: string };
}

// ============================================
// RSC PROPS
// ============================================

export interface RscEntryLexicalCellProps {
  data?: SerializedEditorState | null;
  className?: string;
}

export interface RscEntryLexicalFieldProps {
  data?: SerializedEditorState | null;
  className?: string;
}

// ============================================
// NODE SERIALIZATION
// ============================================

interface SerializeOptions {
  /** Custom block renderer */
  renderBlock?: (node: SerializedBlockNode, index: number) => JSX.Element | null;
  /** Custom link renderer */
  renderLink?: (
    node: SerializedLinkNode,
    children: JSX.Element | null,
    index: number,
  ) => JSX.Element;
  /** Custom image renderer */
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

/**
 * Serialize a text node with formatting
 */
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

/**
 * Serialize children nodes recursively
 */
function serializeChildren(
  children: SerializedLexicalNode[] | undefined,
  options?: SerializeOptions,
): JSX.Element | null {
  if (!children || children.length === 0) return null;

  return (
    <Fragment>{children.map((child, index) => serializeNode(child, index, options))}</Fragment>
  );
}

/**
 * Serialize a single Lexical node to React elements
 */
function serializeNode(
  node: SerializedLexicalNode,
  index: number,
  options?: SerializeOptions,
): JSX.Element | null {
  if (!node) return null;

  // Cast for property access
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
    return <span key={index}>{'\t'}</span>;
  }

  // Paragraph
  if (node.type === 'paragraph') {
    return <p key={index}>{serializeChildren(n.children, options)}</p>;
  }

  // Heading
  if (node.type === 'heading') {
    const Tag = (n.tag || 'h1') as keyof JSX.IntrinsicElements;
    return <Tag key={index}>{serializeChildren(n.children, options)}</Tag>;
  }

  // Quote
  if (node.type === 'quote') {
    return <blockquote key={index}>{serializeChildren(n.children, options)}</blockquote>;
  }

  // List
  if (node.type === 'list') {
    const Tag = n.listType === 'number' ? 'ol' : 'ul';
    const listClass = n.listType === 'check' ? 'checklist' : undefined;
    return (
      <Tag key={index} className={listClass}>
        {serializeChildren(n.children, options)}
      </Tag>
    );
  }

  // List item
  if (node.type === 'listitem') {
    if (n.checked !== undefined) {
      // Checklist item
      return (
        <li
          key={index}
          // role="checkbox"
          // aria-checked={n.checked}
          tabIndex={-1}
          className={n.checked ? 'checked' : 'unchecked'}
          value={n.value}
        >
          {serializeChildren(n.children, options)}
        </li>
      );
    }
    return (
      <li key={index} value={n.value}>
        {serializeChildren(n.children, options)}
      </li>
    );
  }

  // Link
  if (node.type === 'link') {
    const linkNode = node as SerializedLinkNode;
    const children = serializeChildren(n.children, options);

    // Allow custom link renderer
    if (options?.renderLink) {
      return options.renderLink(linkNode, children, index);
    }

    // Default link rendering with URL sanitization
    const href = sanitizeUrl(linkNode.fields?.url || '#', 'link');
    const target = linkNode.fields?.newTab ? '_blank' : undefined;
    const rel = linkNode.fields?.newTab ? 'noopener noreferrer' : undefined;

    return (
      <a key={index} href={href} target={target} rel={rel}>
        {children}
      </a>
    );
  }

  // Autolink
  if (node.type === 'autolink') {
    const children = serializeChildren(n.children, options);
    const autoLinkNode = node as SerializedAutoLinkNode;
    return (
      <a key={index} href={sanitizeUrl(autoLinkNode.url || '#', 'link')}>
        {children}
      </a>
    );
  }

  // Image (from upload feature)
  if (node.type === 'image') {
    const imageNode = node as SerializedBlockNode & {
      fields?: {
        src?: string;
        alt?: string;
        width?: number;
        height?: number;
        caption?: string;
      };
    };

    const src = sanitizeUrl(imageNode.fields?.src || '', 'image');
    const alt = imageNode.fields?.alt || '';
    const width = imageNode.fields?.width;
    const height = imageNode.fields?.height;
    const caption = imageNode.fields?.caption;

    // Allow custom image renderer
    if (options?.renderImage) {
      return options.renderImage(imageNode.fields || {}, index);
    }

    // Default image rendering
    return (
      <figure key={index} style={{ margin: '16px 0', textAlign: 'center' }}>
        {/* biome-ignore lint/performance/noImgElement: SSR output doesn't require Next.js Image. */}
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          style={{
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
          }}
        />
        {caption && (
          <figcaption
            style={{
              marginTop: '8px',
              fontSize: '14px',
              color: '#64748b',
              fontStyle: 'italic',
            }}
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
    const blockNode = node as SerializedBlockNode;

    if (options?.renderBlock) {
      return options.renderBlock(blockNode, index);
    }

    // Default: render nothing for unknown blocks
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

  // Unknown node type - try to render children if available
  if (n.children) {
    return <Fragment key={index}>{serializeChildren(n.children, options)}</Fragment>;
  }

  return null;
}

/**
 * Serialize a Lexical editor state to React elements
 */
export function serializeLexicalState(
  data: SerializedEditorState | null | undefined,
  options?: SerializeOptions,
): JSX.Element | null {
  if (!data?.root?.children) {
    return null;
  }

  return serializeChildren(data.root.children, options);
}

/**
 * Generate HTML string from Lexical nodes (server-side)
 *
 * @async
 * Uses ReactDOMServer.renderToString to convert React elements to HTML string.
 * Falls back to text extraction if ReactDOMServer is not available (e.g., edge runtime).
 *
 * @param data - Serialized Lexical editor state
 * @returns Promise resolving to HTML string
 */
export async function $generateHtmlFromNodes(
  data: SerializedEditorState | null | undefined,
): Promise<string> {
  if (!data?.root?.children) {
    return '';
  }

  // Serialize to React elements first
  const reactElement = serializeLexicalState(data);

  if (!reactElement) {
    return '';
  }

  // Try to use ReactDOMServer for full HTML rendering
  // This is the proper implementation for server-side HTML generation
  try {
    // Dynamic import to avoid bundling in client code
    const ReactDOMServer = await import('react-dom/server');

    if (ReactDOMServer && typeof ReactDOMServer.renderToString === 'function') {
      return ReactDOMServer.renderToString(reactElement);
    }
  } catch {
    // ReactDOMServer not available (e.g., edge runtime, client-side)
    // Fall back to simple text extraction for compatibility
  }

  // Fallback: Extract text content only (for edge runtime compatibility)
  const extractText = (nodes: SerializedLexicalNode[]): string => {
    return nodes
      .map((node) => {
        if (node.type === 'text') {
          return (node as SerializedTextNode).text;
        }
        const elementChildren = (node as SerializedElementNode).children;
        if (elementChildren) {
          return extractText(elementChildren);
        }
        return '';
      })
      .join('');
  };

  return extractText(data.root.children);
}

// ============================================
// RSC COMPONENTS
// ============================================

/**
 * Server component for rendering Lexical content in table cells
 */
export function RscEntryLexicalCell({ data, className }: RscEntryLexicalCellProps) {
  if (!data) {
    return null;
  }

  const content = serializeLexicalState(data);

  if (!content) {
    return null;
  }

  return <div className={className}>{content}</div>;
}

/**
 * Server component for rendering Lexical content in form fields
 */
export function RscEntryLexicalField({ data, className }: RscEntryLexicalFieldProps) {
  if (!data) {
    return null;
  }

  const content = serializeLexicalState(data);

  if (!content) {
    return null;
  }

  return <div className={className}>{content}</div>;
}

/**
 * Generic RSC component for rendering Lexical content
 */
export interface RichTextContentProps {
  data: SerializedEditorState | null | undefined;
  className?: string;
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

export function RichTextContent({
  data,
  className,
  renderBlock,
  renderLink,
  renderImage,
}: RichTextContentProps) {
  if (!data) {
    return null;
  }

  const content = serializeLexicalState(data, {
    renderBlock: renderBlock || undefined,
    renderLink: renderLink || undefined,
    renderImage: renderImage || undefined,
  });

  if (!content) {
    return null;
  }

  return <div className={className}>{content}</div>;
}

export default RichTextContent;
