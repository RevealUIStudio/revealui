/**
 * RevealUI Rich Text Editor - Client Components
 * 
 * Provides React components for the Lexical editor.
 * Uses vanilla @lexical/react packages.
 */

'use client'

// Re-export from @lexical/react
export { LexicalComposer } from '@lexical/react/LexicalComposer'
export { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'

export { ContentEditable } from '@lexical/react/LexicalContentEditable'
export { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
export { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
export { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
export { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
export { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'

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
export const slashMenuBasicGroupWithItems = () => ({})
export const toolbarAddDropdownGroupWithItems = () => ({})

// Editor component types
export interface EditorConfig {
  namespace: string
  theme?: Record<string, string>
  onError?: (error: Error) => void
  nodes?: unknown[]
}
