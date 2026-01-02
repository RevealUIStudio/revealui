/**
 * RevealUI Rich Text Editor - React Server Components
 * 
 * Provides server-side rendering components for Lexical content.
 * Converts Lexical JSON state to React elements without requiring a browser.
 */

import type { SerializedEditorState, SerializedLexicalNode } from 'lexical'
import React, { Fragment, type JSX } from 'react'

// Re-export SerializedEditorState for convenience
export type { SerializedEditorState }

// ============================================
// TEXT FORMAT CONSTANTS
// ============================================

const IS_BOLD = 1
const IS_ITALIC = 2
const IS_STRIKETHROUGH = 4
const IS_UNDERLINE = 8
const IS_CODE = 16
const IS_SUBSCRIPT = 32
const IS_SUPERSCRIPT = 64

// ============================================
// TYPES
// ============================================

interface SerializedTextNode extends SerializedLexicalNode {
  type: 'text'
  text: string
  format: number
  style?: string
}

interface SerializedElementNode extends SerializedLexicalNode {
  type: string
  children?: SerializedLexicalNode[]
  direction?: 'ltr' | 'rtl' | null
  format?: string | number
  indent?: number
  tag?: string
  listType?: 'bullet' | 'number' | 'check'
  checked?: boolean
  value?: number
}

interface SerializedLinkNode extends SerializedElementNode {
  type: 'link'
  fields?: {
    url?: string
    linkType?: 'custom' | 'internal'
    newTab?: boolean
    doc?: { value: string; relationTo: string }
  }
}

interface SerializedBlockNode extends SerializedLexicalNode {
  type: 'block'
  fields?: Record<string, unknown>
}

export interface DefaultNodeTypes {
  type: string
  children?: DefaultNodeTypes[]
  format?: number
  text?: string
  tag?: string
  listType?: string
  checked?: boolean
  value?: number
  fields?: Record<string, unknown>
}

export interface SerializedBlockNodeGeneric<T = Record<string, unknown>> extends SerializedLexicalNode {
  type: 'block'
  fields: T & { blockType: string }
}

// ============================================
// RSC PROPS
// ============================================

export interface RscEntryLexicalCellProps {
  data?: SerializedEditorState | null
  className?: string
}

export interface RscEntryLexicalFieldProps {
  data?: SerializedEditorState | null
  className?: string
}

// ============================================
// NODE SERIALIZATION
// ============================================

interface SerializeOptions {
  /** Custom block renderer */
  renderBlock?: (node: SerializedBlockNode, index: number) => JSX.Element | null
  /** Custom link renderer */
  renderLink?: (node: SerializedLinkNode, children: JSX.Element | null, index: number) => JSX.Element
}

/**
 * Serialize a text node with formatting
 */
function serializeTextNode(node: SerializedTextNode, index: number): JSX.Element {
  let text: JSX.Element = <Fragment key={index}>{node.text}</Fragment>
  
  const format = node.format || 0
  
  if (format & IS_BOLD) {
    text = <strong key={index}>{text}</strong>
  }
  if (format & IS_ITALIC) {
    text = <em key={index}>{text}</em>
  }
  if (format & IS_UNDERLINE) {
    text = <span key={index} style={{ textDecoration: 'underline' }}>{text}</span>
  }
  if (format & IS_STRIKETHROUGH) {
    text = <span key={index} style={{ textDecoration: 'line-through' }}>{text}</span>
  }
  if (format & IS_CODE) {
    text = <code key={index}>{node.text}</code>
  }
  if (format & IS_SUBSCRIPT) {
    text = <sub key={index}>{text}</sub>
  }
  if (format & IS_SUPERSCRIPT) {
    text = <sup key={index}>{text}</sup>
  }
  
  return text
}

/**
 * Serialize children nodes recursively
 */
function serializeChildren(
  children: SerializedLexicalNode[] | undefined,
  options?: SerializeOptions
): JSX.Element | null {
  if (!children || children.length === 0) return null
  
  return (
    <Fragment>
      {children.map((child, index) => serializeNode(child, index, options))}
    </Fragment>
  )
}

/**
 * Serialize a single Lexical node to React elements
 */
function serializeNode(
  node: SerializedLexicalNode,
  index: number,
  options?: SerializeOptions
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
    return (
      <p key={index}>
        {serializeChildren(n.children, options)}
      </p>
    )
  }
  
  // Heading
  if (node.type === 'heading') {
    const Tag = (n.tag || 'h1') as keyof JSX.IntrinsicElements
    return (
      <Tag key={index}>
        {serializeChildren(n.children, options)}
      </Tag>
    )
  }
  
  // Quote
  if (node.type === 'quote') {
    return (
      <blockquote key={index}>
        {serializeChildren(n.children, options)}
      </blockquote>
    )
  }
  
  // List
  if (node.type === 'list') {
    const Tag = n.listType === 'number' ? 'ol' : 'ul'
    const listClass = n.listType === 'check' ? 'checklist' : undefined
    return (
      <Tag key={index} className={listClass}>
        {serializeChildren(n.children, options)}
      </Tag>
    )
  }
  
  // List item
  if (node.type === 'listitem') {
    if (n.checked !== undefined) {
      // Checklist item
      return (
        <li
          key={index}
          role="checkbox"
          aria-checked={n.checked}
          tabIndex={-1}
          className={n.checked ? 'checked' : 'unchecked'}
          value={n.value}
        >
          {serializeChildren(n.children, options)}
        </li>
      )
    }
    return (
      <li key={index} value={n.value}>
        {serializeChildren(n.children, options)}
      </li>
    )
  }
  
  // Link
  if (node.type === 'link') {
    const linkNode = node as SerializedLinkNode
    const children = serializeChildren(n.children, options)
    
    // Allow custom link renderer
    if (options?.renderLink) {
      return options.renderLink(linkNode, children, index)
    }
    
    // Default link rendering
    const href = linkNode.fields?.url || '#'
    const target = linkNode.fields?.newTab ? '_blank' : undefined
    const rel = linkNode.fields?.newTab ? 'noopener noreferrer' : undefined
    
    return (
      <a key={index} href={href} target={target} rel={rel}>
        {children}
      </a>
    )
  }
  
  // Autolink
  if (node.type === 'autolink') {
    const children = serializeChildren(n.children, options)
    return (
      <a key={index} href={(node as any).url || '#'}>
        {children}
      </a>
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
          {serializeChildren(n.children, options)}
        </code>
      </pre>
    )
  }
  
  // Code highlight
  if (node.type === 'code-highlight') {
    return (
      <span key={index} className={(node as any).highlightType}>
        {(node as any).text}
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
          {serializeChildren(n.children, options)}
        </tbody>
      </table>
    )
  }
  
  // Table row
  if (node.type === 'tablerow') {
    return (
      <tr key={index}>
        {serializeChildren(n.children, options)}
      </tr>
    )
  }
  
  // Table cell
  if (node.type === 'tablecell') {
    const isHeader = (node as any).headerState !== 0
    const Tag = isHeader ? 'th' : 'td'
    return (
      <Tag key={index} colSpan={(node as any).colSpan} rowSpan={(node as any).rowSpan}>
        {serializeChildren(n.children, options)}
      </Tag>
    )
  }
  
  // Unknown node type - try to render children if available
  if (n.children) {
    return (
      <Fragment key={index}>
        {serializeChildren(n.children, options)}
      </Fragment>
    )
  }
  
  return null
}

/**
 * Serialize a Lexical editor state to React elements
 */
export function serializeLexicalState(
  data: SerializedEditorState | null | undefined,
  options?: SerializeOptions
): JSX.Element | null {
  if (!data || !data.root || !data.root.children) {
    return null
  }
  
  return serializeChildren(data.root.children as SerializedLexicalNode[], options)
}

/**
 * Generate HTML string from Lexical nodes (server-side)
 * 
 * This is a placeholder that should be replaced with actual implementation
 * using ReactDOMServer.renderToString in production
 */
export function $generateHtmlFromNodes(
  data: SerializedEditorState | null | undefined
): string {
  // In a real implementation, this would use ReactDOMServer
  // For now, return a simple extraction of text content
  if (!data || !data.root) return ''
  
  const extractText = (nodes: SerializedLexicalNode[]): string => {
    return nodes.map(node => {
      if (node.type === 'text') {
        return (node as SerializedTextNode).text
      }
      if ((node as SerializedElementNode).children) {
        return extractText((node as SerializedElementNode).children!)
      }
      return ''
    }).join('')
  }
  
  return extractText(data.root.children as SerializedLexicalNode[])
}

// ============================================
// RSC COMPONENTS
// ============================================

/**
 * Server component for rendering Lexical content in table cells
 */
export function RscEntryLexicalCell({ data, className }: RscEntryLexicalCellProps) {
  if (!data) {
    return null
  }
  
  const content = serializeLexicalState(data)
  
  if (!content) {
    return null
  }
  
  return (
    <div className={className}>
      {content}
    </div>
  )
}

/**
 * Server component for rendering Lexical content in form fields
 */
export function RscEntryLexicalField({ data, className }: RscEntryLexicalFieldProps) {
  if (!data) {
    return null
  }
  
  const content = serializeLexicalState(data)
  
  if (!content) {
    return null
  }
  
  return (
    <div className={className}>
      {content}
    </div>
  )
}

/**
 * Generic RSC component for rendering Lexical content
 */
export interface RichTextContentProps {
  data: SerializedEditorState | null | undefined
  className?: string
  renderBlock?: (node: SerializedBlockNode, index: number) => JSX.Element | null
  renderLink?: (node: SerializedLinkNode, children: JSX.Element | null, index: number) => JSX.Element
}

export function RichTextContent({ 
  data, 
  className,
  renderBlock,
  renderLink 
}: RichTextContentProps) {
  if (!data) {
    return null
  }
  
  const content = serializeLexicalState(data, { renderBlock, renderLink })
  
  if (!content) {
    return null
  }
  
  return (
    <div className={className}>
      {content}
    </div>
  )
}

export default RichTextContent
