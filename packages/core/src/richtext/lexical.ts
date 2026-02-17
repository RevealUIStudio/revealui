/**
 * RevealUI Rich Text Editor - Lexical Module
 *
 * Barrel export for the Lexical editor integration.
 * Consumers import from '@revealui/core/richtext/lexical'.
 *
 * @example
 * ```ts
 * import {
 *   lexicalEditor,
 *   BoldFeature,
 *   ItalicFeature,
 *   HeadingFeature,
 *   FixedToolbarFeature,
 * } from '@revealui/core/richtext/lexical'
 * ```
 */

// Re-export core Lexical types
export type {
  EditorState,
  LexicalEditor,
  LexicalNode,
  SerializedEditorState,
  SerializedLexicalNode,
} from 'lexical'
export type {
  RichTextContent,
  RscEntryLexicalCell,
  RscEntryLexicalField,
} from './exports/server/rsc.js'
// Re-export serialization
export { serializeLexicalState } from './exports/server/rsc.js'
// Types
export type {
  DefaultNodeTypes,
  RichTextEditor,
  RichTextFeature,
  SerializedBlockNode,
  SerializedCodeNode,
  SerializedHeadingNode,
  SerializedLinebreakNode,
  SerializedLinkNode,
  SerializedListItemNode,
  SerializedListNode,
  SerializedParagraphNode,
  SerializedQuoteNode,
  SerializedTextNode,
  SerializedUploadNode,
  ServerFeatureConfig,
} from './index.js'
// Editor factory and all features
export {
  AlignFeature,
  BlockquoteFeature,
  BlocksFeature,
  // Mark features
  BoldFeature,
  ChecklistFeature,
  CodeBlockFeature,
  CodeFeature,
  // Server feature creation
  createServerFeature,
  // Toolbar features
  FixedToolbarFeature,
  FloatingToolbarFeature,
  // Block features
  HeadingFeature,
  HistoryFeature,
  HorizontalRuleFeature,
  IndentFeature,
  InlineCodeFeature,
  InlineToolbarFeature,
  ItalicFeature,
  // Inline features
  LinkFeature,
  ListFeature,
  // Factory
  lexicalEditor,
  OrderedListFeature,
  ParagraphFeature,
  QuoteFeature,
  RelationshipFeature,
  StrikethroughFeature,
  SubscriptFeature,
  SuperscriptFeature,
  // Utility features
  TreeViewFeature,
  UnderlineFeature,
  UnorderedListFeature,
  UploadFeature,
} from './index.js'
