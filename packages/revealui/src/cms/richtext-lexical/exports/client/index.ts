/**
 * RevealUI Rich Text Editor - Client Components
 *
 * Provides React components for the Lexical editor.
 * Uses vanilla @lexical/react packages.
 */

'use client'

export { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
// Re-export from @lexical/react
export { LexicalComposer } from '@lexical/react/LexicalComposer'
export { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
export { ContentEditable } from '@lexical/react/LexicalContentEditable'
export { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
export { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
export { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
export { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'

// Re-export from @lexical/utils
export { $insertNodeToNearestRoot, mergeRegister } from '@lexical/utils'

// Feature client components (stubs that export the same interface)
// These are placeholders that will be implemented with actual Lexical plugins

export const BoldFeatureClient = () => null
export const ItalicFeatureClient = () => null
export const UnderlineFeatureClient = () => null
export const StrikethroughFeatureClient = () => null
export const SubscriptFeatureClient = () => null
export const SuperscriptFeatureClient = () => null
export const InlineCodeFeatureClient = () => null

export const HeadingFeatureClient = () => null
export const ParagraphFeatureClient = () => null
export const AlignFeatureClient = () => null
export const IndentFeatureClient = () => null

export const UnorderedListFeatureClient = () => null
export const OrderedListFeatureClient = () => null
export const ChecklistFeatureClient = () => null

export const LinkFeatureClient = () => null
export const RelationshipFeatureClient = () => null
export const BlockquoteFeatureClient = () => null
export const UploadFeatureClient = () => null
export const HorizontalRuleFeatureClient = () => null

export const InlineToolbarFeatureClient = () => null
export const FixedToolbarFeatureClient = () => null
export const TreeViewFeatureClient = () => null
export const BlocksFeatureClient = () => null

// Toolbar utilities (stubs)
export const slashMenuBasicGroupWithItems = (items: unknown[]) => ({ items })
export const toolbarAddDropdownGroupWithItems = (items: unknown[]) => ({ items })

// Feature creation utilities (stubs)
export interface ClientFeatureConfig {
  plugins?: Array<{
    Component: React.ComponentType<any>
    position?: 'normal' | 'bottom' | 'top'
  }>
  nodes?: unknown[]
  toolbarFixed?: {
    groups?: unknown[]
  }
  toolbarInline?: {
    groups?: unknown[]
  }
  slashMenu?: {
    groups?: unknown[]
  }
}

export const createClientFeature = (config: ClientFeatureConfig) => {
  return config
}

// Editor component types
export interface EditorConfig {
  namespace: string
  theme?: Record<string, string>
  onError?: (error: Error) => void
  nodes?: unknown[]
}

// DecoratorBlockNode - stub for PayloadCMS compatibility
// This is a custom class that PayloadCMS uses for block nodes
import {
  DecoratorNode,
  type ElementFormatType,
  type LexicalEditor,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical'
import type { JSX } from 'react'

// Re-export LexicalEditor type
export type { LexicalEditor }

// Plugin component type for rich text features
export type PluginComponent<T = Record<string, unknown>> = React.FC<T>

export type SerializedDecoratorBlockNode<
  T extends Record<string, unknown> = Record<string, unknown>,
> = Spread<
  {
    format: ElementFormatType
    fields: T
  },
  SerializedLexicalNode
>

export abstract class DecoratorBlockNode<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends DecoratorNode<JSX.Element> {
  __format: ElementFormatType

  constructor(format?: ElementFormatType, key?: NodeKey) {
    super(key)
    this.__format = format || ''
  }

  getFormat(): ElementFormatType {
    return this.__format
  }

  setFormat(format: ElementFormatType): void {
    const writable = this.getWritable()
    writable.__format = format
  }

  exportJSON(): SerializedDecoratorBlockNode<T> {
    return {
      ...super.exportJSON(),
      format: this.__format,
      fields: {} as T,
    }
  }
}
