import type { RichTextEditor, RichTextFeature, Field } from '../types/index';

// Core Lexical features
export const BoldFeature = (): RichTextFeature => ({
  name: 'bold',
  key: 'bold',
  type: 'mark',
  tag: 'strong'
});

export const ItalicFeature = (): RichTextFeature => ({
  name: 'italic',
  key: 'italic',
  type: 'mark',
  tag: 'em'
});

export const UnderlineFeature = (): RichTextFeature => ({
  name: 'underline',
  key: 'underline',
  type: 'mark',
  tag: 'u'
});

export const StrikethroughFeature = (): RichTextFeature => ({
  name: 'strikethrough',
  key: 'strikethrough',
  type: 'mark',
  tag: 's'
});

export const CodeFeature = (): RichTextFeature => ({
  name: 'code',
  key: 'code',
  type: 'mark',
  tag: 'code'
});

export const SubscriptFeature = (): RichTextFeature => ({
  name: 'subscript',
  key: 'subscript',
  type: 'mark',
  tag: 'sub'
});

export const SuperscriptFeature = (): RichTextFeature => ({
  name: 'superscript',
  key: 'superscript',
  type: 'mark',
  tag: 'sup'
});

// Toolbar features
export const FixedToolbarFeature = (): RichTextFeature => ({
  name: 'fixed-toolbar',
  key: 'fixed-toolbar',
  type: 'toolbar',
  position: 'fixed'
});

export const InlineToolbarFeature = (): RichTextFeature => ({
  name: 'inline-toolbar',
  key: 'inline-toolbar',
  type: 'toolbar',
  position: 'inline'
});

export const FloatingToolbarFeature = (): RichTextFeature => ({
  name: 'floating-toolbar',
  key: 'floating-toolbar',
  type: 'toolbar',
  position: 'floating'
});

// Structural features
export const HeadingFeature = (options?: {
  enabledHeadingSizes?: string[]
}): RichTextFeature => ({
  name: 'heading',
  key: 'heading',
  type: 'block',
  options: {
    enabledHeadingSizes: options?.enabledHeadingSizes || ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  }
});

export const ParagraphFeature = (): RichTextFeature => ({
  name: 'paragraph',
  key: 'paragraph',
  type: 'block',
  tag: 'p'
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
    unordered: options?.unordered ?? true
  }
});

export const QuoteFeature = (): RichTextFeature => ({
  name: 'quote',
  key: 'quote',
  type: 'block',
  tag: 'blockquote'
});

export const CodeBlockFeature = (): RichTextFeature => ({
  name: 'code-block',
  key: 'code-block',
  type: 'block',
  tag: 'pre'
});

// Link and relationship features
export const LinkFeature = (options?: {
  enabledCollections?: string[];
  fields?: Field[];
  allowExternalLinks?: boolean;
}): RichTextFeature => ({
  name: 'link',
  key: 'link',
  type: 'inline',
  options: {
    enabledCollections: options?.enabledCollections || [],
    fields: options?.fields || [],
    allowExternalLinks: options?.allowExternalLinks ?? true
  }
});

// Media features
export const UploadFeature = (options?: {
  collections?: {
    [key: string]: boolean;
  };
}): RichTextFeature => ({
  name: 'upload',
  key: 'upload',
  type: 'inline',
  options: {
    collections: options?.collections || {}
  }
});

// Utility features
export const TreeViewFeature = (): RichTextFeature => ({
  name: 'tree-view',
  key: 'tree-view',
  type: 'utility'
});

export const HistoryFeature = (): RichTextFeature => ({
  name: 'history',
  key: 'history',
  type: 'utility'
});

export const AutoSaveFeature = (options?: {
  interval?: number;
}): RichTextFeature => ({
  name: 'auto-save',
  key: 'auto-save',
  type: 'utility',
  options: {
    interval: options?.interval || 1000
  }
});

// Relationship features
export const RelationshipFeature = (options?: {
  enabledCollections?: string[];
  allowMultiple?: boolean;
}): RichTextFeature => ({
  name: 'relationship',
  key: 'relationship',
  type: 'inline',
  options: {
    enabledCollections: options?.enabledCollections || [],
    allowMultiple: options?.allowMultiple ?? true
  }
});

// Block features
export const BlocksFeature = (options?: {
  enabledBlocks?: string[];
}): RichTextFeature => ({
  name: 'blocks',
  key: 'blocks',
  type: 'block',
  options: {
    enabledBlocks: options?.enabledBlocks || []
  }
});

export const HorizontalRuleFeature = (): RichTextFeature => ({
  name: 'horizontal-rule',
  key: 'horizontal-rule',
  type: 'block',
  tag: 'hr'
});

// Embed features
export const EmbedFeature = (options?: {
  enabledEmbeds?: string[];
}): RichTextFeature => ({
  name: 'embed',
  key: 'embed',
  type: 'block',
  options: {
    enabledEmbeds: options?.enabledEmbeds || ['youtube', 'vimeo', 'twitter', 'instagram']
  }
});

// Default features
const defaultFeatures = [
  BoldFeature(),
  ItalicFeature(),
  UnderlineFeature(),
  ParagraphFeature(),
  HeadingFeature(),
  ListFeature(),
  LinkFeature(),
  HistoryFeature()
];

const rootFeatures = [
  ParagraphFeature(),
  HeadingFeature(),
  ListFeature(),
  QuoteFeature(),
  CodeBlockFeature(),
  UploadFeature()
];

export const lexicalEditor = (config: {
  features: (args: {
    defaultFeatures: RichTextFeature[];
    rootFeatures: RichTextFeature[]
  }) => RichTextFeature[]
}): RichTextEditor => {
  const features = config.features({ defaultFeatures, rootFeatures });

  return {
    editorType: 'lexical',
    features,
    // Additional configuration
    outputFormat: 'html',
    sanitize: true,
    validate: true
  };
};

