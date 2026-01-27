/**
 * RevealUI Rich Text Editor - React Client Components
 *
 * Provides client-side rendering components for Lexical content.
 * Converts Lexical JSON state to React elements without requiring a server.
 * @param data - The Lexical editor state to serialize
 * @param options - The options for the serializer
 * @returns The serialized React elements
 */

import type { SerializedCodeNode } from '@lexical/code'
import type { SerializedAutoLinkNode, SerializedLinkNode } from '@lexical/link'
import type { SerializedListItemNode, SerializedListNode } from '@lexical/list'
import type { SerializedHeadingNode, SerializedQuoteNode } from '@lexical/rich-text'
import type {
  SerializedTableCellNode,
  SerializedTableNode,
  SerializedTableRowNode,
} from '@lexical/table'
import type { SerializeOptions } from 'better-sqlite3'
import {
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  type SerializedEditorState,
  type SerializedElementNode,
  type SerializedLexicalNode,
  type SerializedParagraphNode,
  type SerializedTextNode,
} from 'lexical'
import type { JSX } from 'react'
import type { SerializedImageNode } from '../../../index.js'
import type { SerializedBlockNode } from '../../index.js'

type RenderOptions = {
  renderParagraph?: (node: SerializedParagraphNode, index: number) => JSX.Element | null
  renderHeading?: (node: SerializedHeadingNode, index: number) => JSX.Element | null
  renderQuote?: (node: SerializedQuoteNode, index: number) => JSX.Element | null
  renderList?: (node: SerializedListNode, index: number) => JSX.Element | null
  renderListItem?: (node: SerializedListItemNode, index: number) => JSX.Element | null
  renderBlock?: (node: SerializedBlockNode, index: number) => JSX.Element | null
}

type SerializedCodeHighlightNode = SerializedElementNode & {
  type: 'code-highlight'
  highlightType?: string
}

function serializeTextNode(node: SerializedTextNode, index: number): JSX.Element {
  let text: JSX.Element = <>{node.text}</>

  const format = node.format || 0

  if (format & IS_BOLD) {
    text = <strong key={index}>{text}</strong>
  }

  if (format & IS_ITALIC) {
    text = <em key={index}>{text}</em>
  }

  if (format & IS_STRIKETHROUGH) {
    text = (
      <span key={index} style={{ textDecoration: 'line-through' }}>
        {text}
      </span>
    )
  }

  return <>{text}</>
}

/**
 * Serialize a single Lexical node to React elements
 */
function serializeNode(
  node: SerializedLexicalNode,
  index: number,
  options?: {
    renderParagraph?: (node: SerializedParagraphNode, index: number) => JSX.Element | null
    renderHeading?: (node: SerializedHeadingNode, index: number) => JSX.Element | null
    renderQuote?: (node: SerializedQuoteNode, index: number) => JSX.Element | null
    renderList?: (node: SerializedListNode, index: number) => JSX.Element | null
    renderListItem?: (node: SerializedListItemNode, index: number) => JSX.Element | null
    renderBlock?: (node: SerializedBlockNode, index: number) => JSX.Element | null
    renderLink?: (
      node: SerializedLinkNode,
      children: JSX.Element | null,
      index: number,
    ) => JSX.Element
    renderImage?: (node: SerializedImageNode, index: number) => JSX.Element | null
    renderCode?: (
      node: SerializedCodeNode,
      children: JSX.Element | null,
      index: number,
    ) => JSX.Element | null
    renderCodeHighlight?: (node: SerializedCodeHighlightNode, index: number) => JSX.Element | null
    renderTable?: (node: SerializedTableNode, index: number) => JSX.Element | null
    renderTableRow?: (node: SerializedTableRowNode, index: number) => JSX.Element | null
    renderTableCell?: (node: SerializedTableCellNode, index: number) => JSX.Element | null
  },
): JSX.Element | null {
  if (!node) return null

  // Cast for property access
  const n = node as SerializedElementNode

  // Text node
  if (node.type === 'text') {
    return serializeTextNode(node as SerializedTextNode, index)
  }

  // Linebreak
  if (node.type === 'linebreak') {
    return <br key={index} />
  }

  // Tab
  if (node.type === 'tab') {
    return <span key={index}>{'\t'}</span>
  }

  // Paragraph
  if (node.type === 'paragraph') {
    return options?.renderParagraph
      ? options.renderParagraph(node as SerializedParagraphNode, index)
      : null
  }

  // Heading
  if (node.type === 'heading') {
    // const headingNode = node as SerializedHeadingNode
    // const Tag = (headingNode.tag || 'h1') as keyof JSX.IntrinsicElements
    return options?.renderHeading
      ? options.renderHeading(node as SerializedHeadingNode, index)
      : null
  }

  // Quote
  if (node.type === 'quote') {
    return options?.renderQuote ? options.renderQuote(node as SerializedQuoteNode, index) : null
  }

  // List
  if (node.type === 'list') {
    // const listNode = node as SerializedListNode
    // const Tag = listNode.listType === 'number' ? 'ol' : 'ul'
    // const listClass = listNode.listType === 'check' ? 'checklist' : undefined
    return options?.renderList ? options.renderList(node as SerializedListNode, index) : null
  }

  // List item
  if (node.type === 'listitem') {
    const listItemNode = node as SerializedListItemNode
    if (listItemNode.checked !== undefined) {
      // Checklist item
      return (
        <li
          key={index}
          // role="checkbox"
          // aria-checked={n.checked}
          tabIndex={-1}
          className={listItemNode.checked ? 'checked' : 'unchecked'}
          value={listItemNode.value}
        >
          {options?.renderListItem
            ? options.renderListItem(node as SerializedListItemNode, index)
            : null}
        </li>
      )
    }
    return (
      <li key={index} value={listItemNode.value}>
        {options?.renderListItem
          ? options.renderListItem(node as SerializedListItemNode, index)
          : null}
      </li>
    )
  }

  // Link
  if (node.type === 'link') {
    const linkNode = node as SerializedLinkNode
    const children = options?.renderLink
      ? options.renderLink(node as SerializedLinkNode, serializeChildren(n.children), index)
      : null

    return (
      <a
        key={index}
        href={linkNode.url || '#'}
        target={linkNode.target ? '_blank' : undefined}
        rel={linkNode.rel ? 'noopener noreferrer' : undefined}
      >
        {options?.renderLink
          ? options.renderLink(node as SerializedLinkNode, children, index)
          : null}
      </a>
    )
  }

  // Autolink
  if (node.type === 'autolink') {
    const autoLinkNode = node as SerializedAutoLinkNode
    return (
      <a key={index} href={autoLinkNode.url || '#'}>
        {serializeChildren(n.children)}
      </a>
    )
  }

  // Image (from upload feature)
  if (node.type === 'image') {
    const imageNode = node as SerializedImageNode & {
      fields?: {
        src?: string
        alt?: string
        width?: number
        height?: number
        caption?: string
      }
    }

    const src = imageNode.fields?.src || ''
    const alt = imageNode.fields?.alt || ''
    const width = imageNode.fields?.width
    const height = imageNode.fields?.height
    const caption = imageNode.fields?.caption

    // Allow custom image renderer
    if (options?.renderImage) {
      return (
        <figure key={index} style={{ margin: '16px 0', textAlign: 'center' }}>
          {/* biome-ignore lint/performance/noImgElement: SSR output doesn't require Next.js Image. */}
          <img
            src={imageNode.fields?.src || ''}
            alt={imageNode.fields?.alt || ''}
            width={imageNode.fields?.width}
            height={imageNode.fields?.height}
          />
        </figure>
      )
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
    )
  }

  // Horizontal rule
  if (node.type === 'horizontalrule') {
    return <hr key={index} />
  }

  // Code block
  if (node.type === 'code') {
    return (
      <pre key={index}>
        <code>
          {options?.renderCode
            ? options.renderCode(node as SerializedCodeNode, serializeChildren(n.children), index)
            : null}
        </code>
      </pre>
    )
  }

  // Code highlight
  if (node.type === 'code-highlight') {
    const codeHighlightNode = node as SerializedCodeHighlightNode
    return (
      <span key={index} className={codeHighlightNode.highlightType}>
        {options?.renderCodeHighlight
          ? options.renderCodeHighlight(node as SerializedCodeHighlightNode, index)
          : null}
      </span>
    )
  }

  // Block (custom block types)
  if (node.type === 'block') {
    const blockNode = node as SerializedBlockNode

    if (options?.renderBlock) {
      return options.renderBlock(blockNode, index)
    }

    // Default: render nothing for unknown blocks
    return null
  }

  // Table
  if (node.type === 'table') {
    return (
      <table key={index}>
        <tbody>
          {options?.renderTable ? options.renderTable(node as SerializedTableNode, index) : null}
        </tbody>
      </table>
    )
  }

  // Table row
  if (node.type === 'tablerow') {
    return (
      <tr key={index}>
        {options?.renderTableRow
          ? options.renderTableRow(node as SerializedTableRowNode, index)
          : null}
      </tr>
    )
  }

  // Table cell
  if (node.type === 'tablecell') {
    const tableCellNode = node as SerializedTableCellNode
    const isHeader = (tableCellNode.headerState ?? 0) !== 0
    const Tag = isHeader ? 'th' : 'td'
    return (
      <Tag key={index} colSpan={tableCellNode.colSpan} rowSpan={tableCellNode.rowSpan}>
        {options?.renderTableCell
          ? options.renderTableCell(node as SerializedTableCellNode, index)
          : null}
      </Tag>
    )
  }

  // Unknown node type - try to render children if available
  if (n.children) {
    return (
      <>{options?.renderBlock ? options.renderBlock(node as SerializedBlockNode, index) : null}</>
    )
  }

  return null
}

/**
 * Serialize children nodes recursively
 */
function serializeChildren(
  children: SerializedLexicalNode[] | undefined,
  options?: RenderOptions,
): JSX.Element | null {
  if (!children || children.length === 0) return null

  return <>{children.map((child, index) => serializeNode(child, index, options))}</>
}

/**
 * Serialize a Lexical editor state to React elements
 */
export function serializeLexicalStateClient(
  data: SerializedEditorState | null | undefined,
  options?: RenderOptions,
): JSX.Element | null {
  if (!data?.root?.children) {
    return null
  }

  return serializeChildren(data.root.children, options)
}

export const RichTextContent = ({ data }: { data: SerializedEditorState }) => {
  return <>{serializeLexicalStateClient(data)}</>
}
