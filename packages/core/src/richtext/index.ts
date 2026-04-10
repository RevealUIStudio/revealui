/**
 * RevealUI Rich Text Editor - Lexical Integration
 *
 * Uses vanilla Lexical npm packages for rich text editing.
 * Provides an admin-compatible API for configuring the editor.
 */

export type {
  EditorState,
  LexicalEditor,
  LexicalNode,
  SerializedEditorState,
  SerializedLexicalNode,
} from 'lexical';
// Re-export from vanilla Lexical packages
export {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  CLEAR_EDITOR_COMMAND,
  CLEAR_HISTORY_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  createEditor,
  FORMAT_TEXT_COMMAND,
} from 'lexical';
export type {
  RichTextContent,
  RscEntryLexicalCell,
  RscEntryLexicalField,
} from './exports/server/rsc.js';

export { serializeLexicalState } from './exports/server/rsc.js';
// Feature type definitions
export interface RichTextFeature {
  name: string;
  key: string;
  type: 'mark' | 'block' | 'inline' | 'toolbar' | 'utility';
  tag?: string;
  position?: string;
  options?: Record<string, unknown>;
}

export interface RichTextEditor {
  editorType: 'lexical';
  features: RichTextFeature[];
  outputFormat?: 'html' | 'json';
  sanitize?: boolean;
  validate?: boolean;
}

// Feature factories
export const BoldFeature = (): RichTextFeature => ({
  name: 'bold',
  key: 'bold',
  type: 'mark',
  tag: 'strong',
});

export const ItalicFeature = (): RichTextFeature => ({
  name: 'italic',
  key: 'italic',
  type: 'mark',
  tag: 'em',
});

export const UnderlineFeature = (): RichTextFeature => ({
  name: 'underline',
  key: 'underline',
  type: 'mark',
  tag: 'u',
});

export const StrikethroughFeature = (): RichTextFeature => ({
  name: 'strikethrough',
  key: 'strikethrough',
  type: 'mark',
  tag: 's',
});

export const CodeFeature = (): RichTextFeature => ({
  name: 'code',
  key: 'code',
  type: 'mark',
  tag: 'code',
});

export const SubscriptFeature = (): RichTextFeature => ({
  name: 'subscript',
  key: 'subscript',
  type: 'mark',
  tag: 'sub',
});

export const SuperscriptFeature = (): RichTextFeature => ({
  name: 'superscript',
  key: 'superscript',
  type: 'mark',
  tag: 'sup',
});

// Toolbar features
export const FixedToolbarFeature = (): RichTextFeature => ({
  name: 'fixed-toolbar',
  key: 'fixed-toolbar',
  type: 'toolbar',
  position: 'fixed',
});

export const InlineToolbarFeature = (): RichTextFeature => ({
  name: 'inline-toolbar',
  key: 'inline-toolbar',
  type: 'toolbar',
  position: 'inline',
});

export const FloatingToolbarFeature = (): RichTextFeature => ({
  name: 'floating-toolbar',
  key: 'floating-toolbar',
  type: 'toolbar',
  position: 'floating',
});

// Structural features
export const HeadingFeature = (options?: { enabledHeadingSizes?: string[] }): RichTextFeature => ({
  name: 'heading',
  key: 'heading',
  type: 'block',
  options: {
    enabledHeadingSizes: options?.enabledHeadingSizes || ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  },
});

export const ParagraphFeature = (): RichTextFeature => ({
  name: 'paragraph',
  key: 'paragraph',
  type: 'block',
  tag: 'p',
});

export const ListFeature = (options?: {
  ordered?: boolean;
  unordered?: boolean;
}): RichTextFeature => ({
  name: 'list',
  key: 'list',
  type: 'block',
  options: {
    ordered: options?.ordered ?? true,
    unordered: options?.unordered ?? true,
  },
});

export const QuoteFeature = (): RichTextFeature => ({
  name: 'quote',
  key: 'quote',
  type: 'block',
  tag: 'blockquote',
});

export const BlockquoteFeature = QuoteFeature;

export const CodeBlockFeature = (): RichTextFeature => ({
  name: 'code-block',
  key: 'code-block',
  type: 'block',
  tag: 'pre',
});

// Link feature
export const LinkFeature = (options?: {
  enabledCollections?: string[];
  fields?: unknown[];
  allowExternalLinks?: boolean;
}): RichTextFeature => ({
  name: 'link',
  key: 'link',
  type: 'inline',
  options: {
    enabledCollections: options?.enabledCollections || [],
    fields: options?.fields || [],
    allowExternalLinks: options?.allowExternalLinks ?? true,
  },
});

// Upload feature
export const UploadFeature = (options?: {
  collections?: Record<string, boolean>;
}): RichTextFeature => ({
  name: 'upload',
  key: 'upload',
  type: 'inline',
  options: {
    collections: options?.collections || {},
  },
});

// Utility features
export const TreeViewFeature = (): RichTextFeature => ({
  name: 'tree-view',
  key: 'tree-view',
  type: 'utility',
});

export const HistoryFeature = (): RichTextFeature => ({
  name: 'history',
  key: 'history',
  type: 'utility',
});

// Relationship feature
export const RelationshipFeature = (options?: {
  enabledCollections?: string[];
  allowMultiple?: boolean;
}): RichTextFeature => ({
  name: 'relationship',
  key: 'relationship',
  type: 'inline',
  options: {
    enabledCollections: options?.enabledCollections || [],
    allowMultiple: options?.allowMultiple ?? true,
  },
});

// Blocks feature
export const BlocksFeature = (options?: { blocks?: unknown[] }): RichTextFeature => ({
  name: 'blocks',
  key: 'blocks',
  type: 'block',
  options: {
    blocks: options?.blocks || [],
  },
});

// Horizontal rule
export const HorizontalRuleFeature = (): RichTextFeature => ({
  name: 'horizontal-rule',
  key: 'horizontal-rule',
  type: 'block',
  tag: 'hr',
});

// Checklist feature
export const ChecklistFeature = (): RichTextFeature => ({
  name: 'checklist',
  key: 'checklist',
  type: 'block',
});

export const OrderedListFeature = (): RichTextFeature => ({
  name: 'ordered-list',
  key: 'ordered-list',
  type: 'block',
  tag: 'ol',
});

export const UnorderedListFeature = (): RichTextFeature => ({
  name: 'unordered-list',
  key: 'unordered-list',
  type: 'block',
  tag: 'ul',
});

export const IndentFeature = (): RichTextFeature => ({
  name: 'indent',
  key: 'indent',
  type: 'utility',
});

export const AlignFeature = (): RichTextFeature => ({
  name: 'align',
  key: 'align',
  type: 'utility',
});

export const InlineCodeFeature = (): RichTextFeature => ({
  name: 'inline-code',
  key: 'inline-code',
  type: 'mark',
  tag: 'code',
});

// Default features
const defaultFeatures: RichTextFeature[] = [
  BoldFeature(),
  ItalicFeature(),
  UnderlineFeature(),
  ParagraphFeature(),
  HeadingFeature(),
  ListFeature(),
  LinkFeature(),
  HistoryFeature(),
];

const rootFeatures: RichTextFeature[] = [
  ParagraphFeature(),
  HeadingFeature(),
  ListFeature(),
  QuoteFeature(),
  CodeBlockFeature(),
  UploadFeature(),
];

/**
 * Creates a Lexical editor configuration
 */
export const lexicalEditor = (config?: {
  features?:
    | ((args: {
        defaultFeatures: RichTextFeature[];
        rootFeatures: RichTextFeature[];
      }) => RichTextFeature[])
    | RichTextFeature[];
}): RichTextEditor => {
  let features: RichTextFeature[];

  if (typeof config?.features === 'function') {
    features = config.features({ defaultFeatures, rootFeatures });
  } else if (Array.isArray(config?.features)) {
    features = config.features;
  } else {
    features = defaultFeatures;
  }

  return {
    editorType: 'lexical',
    features,
    outputFormat: 'html',
    sanitize: true,
    validate: true,
  };
};

// Serialization types for compatibility
export interface SerializedBlockNode<T = Record<string, unknown>> {
  type: string;
  blockType?: string;
  version: number;
  fields?: T;
}

// Default serialized node types
export interface SerializedTextNode {
  type: 'text';
  text: string;
  format: number;
  version: number;
}

export interface SerializedParagraphNode {
  type: 'paragraph';
  children: SerializedTextNode[];
  version: number;
}

export interface SerializedHeadingNode {
  type: 'heading';
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  children: SerializedTextNode[];
  version: number;
}

export interface SerializedListNode {
  type: 'list';
  listType: 'bullet' | 'number' | 'check';
  children: SerializedListItemNode[];
  version: number;
}

export interface SerializedListItemNode {
  type: 'listitem';
  children: SerializedTextNode[];
  version: number;
}

export interface SerializedQuoteNode {
  type: 'quote';
  children: SerializedTextNode[];
  version: number;
}

export interface SerializedCodeNode {
  type: 'code';
  children: SerializedTextNode[];
  version: number;
}

export interface SerializedLinkNode {
  type: 'link';
  url: string;
  children: SerializedTextNode[];
  version: number;
  fields?: {
    url?: string;
    newTab?: boolean;
    linkType?: 'internal' | 'external';
    doc?: { value: string; relationTo: string };
  };
}

export interface SerializedLinebreakNode {
  type: 'linebreak';
  version: number;
}

export interface SerializedUploadNode {
  type: 'upload';
  relationTo: string;
  value: unknown;
  version: number;
}

export type DefaultNodeTypes =
  | SerializedTextNode
  | SerializedParagraphNode
  | SerializedHeadingNode
  | SerializedListNode
  | SerializedListItemNode
  | SerializedQuoteNode
  | SerializedCodeNode
  | SerializedLinkNode
  | SerializedLinebreakNode
  | SerializedUploadNode;

// Server feature creation utilities
export interface ServerFeatureConfig {
  feature: {
    ClientFeature?: string | React.ComponentType<unknown>;
    nodes?: Array<{
      node: unknown;
    }>;
    generateSchemaMap?: () => Map<string, unknown>;
  };
  key: string;
}

export const createServerFeature = (config: ServerFeatureConfig) => {
  return config;
};
