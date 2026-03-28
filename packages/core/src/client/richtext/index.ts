/**
 * RevealUI Rich Text Editor - Client Components
 *
 * Provides React components for the Lexical editor.
 * Uses vanilla @lexical/react packages.
 */

'use client';

export { CodeHighlightNode, CodeNode } from '@lexical/code';
export { AutoLinkNode, LinkNode } from '@lexical/link';
export { ListItemNode, ListNode } from '@lexical/list';
// Re-export from @lexical/react for advanced usage
export { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
export { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
export { LexicalComposer } from '@lexical/react/LexicalComposer';
export { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
export { ContentEditable } from '@lexical/react/LexicalContentEditable';
export { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
export { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
export { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
export { ListPlugin } from '@lexical/react/LexicalListPlugin';
export { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
export { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
// Re-export node types for custom implementations
export { HeadingNode, QuoteNode } from '@lexical/rich-text';
// Re-export from @lexical/utils
export { $insertNodeToNearestRoot, mergeRegister } from '@lexical/utils';
export { ImageNodeComponent } from './components/ImageNodeComponent.js';
export { ImageUploadButton } from './components/ImageUploadButton.js';
export type { ImageNodeData, SerializedImageNode } from './nodes/ImageNode.js';
// Image upload components
export {
  $createImageNode,
  $isImageNode,
  ImageNode,
  INSERT_IMAGE_COMMAND,
  OPEN_IMAGE_UPLOAD_COMMAND,
} from './nodes/ImageNode.js';
export type { CollaborationPluginProps } from './plugins/CollaborationPlugin.js';
export { CollaborationPlugin } from './plugins/CollaborationPlugin.js';
export type { FloatingToolbarPluginProps } from './plugins/FloatingToolbarPlugin.js';
export { FloatingToolbarPlugin } from './plugins/FloatingToolbarPlugin.js';
export { ImagePlugin } from './plugins/ImagePlugin.js';
export { PastePlugin } from './plugins/PastePlugin.js';
export type { ToolbarPluginProps } from './plugins/ToolbarPlugin.js';
// Toolbar plugins
export { ToolbarPlugin } from './plugins/ToolbarPlugin.js';
export type { RichTextEditorProps } from './RichTextEditor.js';
// Main editor component - production ready
export { RichTextEditor, richTextEditorStyles } from './RichTextEditor.js';

// Feature client components (implementations coming in Phase 2)
// These now return a minimal React component for tree-shaking
export const BoldFeatureClient = () => null;
export const ItalicFeatureClient = () => null;
export const UnderlineFeatureClient = () => null;
export const StrikethroughFeatureClient = () => null;
export const SubscriptFeatureClient = () => null;
export const SuperscriptFeatureClient = () => null;
export const InlineCodeFeatureClient = () => null;

export const HeadingFeatureClient = () => null;
export const ParagraphFeatureClient = () => null;
export const AlignFeatureClient = () => null;
export const IndentFeatureClient = () => null;

export const UnorderedListFeatureClient = () => null;
export const OrderedListFeatureClient = () => null;
export const ChecklistFeatureClient = () => null;

export const LinkFeatureClient = () => null;
export const RelationshipFeatureClient = () => null;
export const BlockquoteFeatureClient = () => null;
export const UploadFeatureClient = () => null;
export const HorizontalRuleFeatureClient = () => null;

export const InlineToolbarFeatureClient = () => null;
export const FixedToolbarFeatureClient = () => null;
export const TreeViewFeatureClient = () => null;
export const BlocksFeatureClient = () => null;

// Toolbar utilities
export const slashMenuBasicGroupWithItems = (items: unknown[]) => ({ items });
export const toolbarAddDropdownGroupWithItems = (items: unknown[]) => ({
  items,
});

// Feature creation utilities
export interface ClientFeatureConfig {
  plugins?: Array<{
    Component: React.ComponentType<unknown>;
    position?: 'normal' | 'bottom' | 'top';
  }>;
  nodes?: unknown[];
  toolbarFixed?: {
    groups?: unknown[];
  };
  toolbarInline?: {
    groups?: unknown[];
  };
  slashMenu?: {
    groups?: unknown[];
  };
}

export const createClientFeature = (config: ClientFeatureConfig) => {
  return config;
};

// Editor component types
export interface EditorConfig {
  namespace: string;
  theme?: Record<string, string>;
  onError?: (error: Error) => void;
  nodes?: unknown[];
}

// Re-export LexicalEditor type from lexical
export type { LexicalEditor } from 'lexical';

// Plugin component type for rich text features
export type PluginComponent<T = Record<string, unknown>> = React.FC<T>;

// DecoratorBlockNode - for block nodes in the editor
// Exported from separate file to avoid circular dependencies
export {
  DecoratorBlockNode,
  type SerializedDecoratorBlockNode,
} from './nodes/DecoratorBlockNode.js';
