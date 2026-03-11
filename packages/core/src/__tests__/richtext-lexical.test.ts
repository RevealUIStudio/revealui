/**
 * Rich Text Editor - Lexical Module Tests
 *
 * Tests the lexicalEditor() factory and all feature factories.
 */

import { describe, expect, it } from 'vitest';
import {
  AlignFeature,
  BlockquoteFeature,
  BlocksFeature,
  BoldFeature,
  ChecklistFeature,
  CodeBlockFeature,
  CodeFeature,
  FixedToolbarFeature,
  FloatingToolbarFeature,
  HeadingFeature,
  HistoryFeature,
  HorizontalRuleFeature,
  IndentFeature,
  InlineCodeFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  ListFeature,
  lexicalEditor,
  OrderedListFeature,
  ParagraphFeature,
  QuoteFeature,
  RelationshipFeature,
  StrikethroughFeature,
  SubscriptFeature,
  SuperscriptFeature,
  TreeViewFeature,
  UnderlineFeature,
  UnorderedListFeature,
  UploadFeature,
} from '../richtext/lexical.js';

describe('lexicalEditor factory', () => {
  it('creates editor with default features when no config provided', () => {
    const editor = lexicalEditor();
    expect(editor.editorType).toBe('lexical');
    expect(editor.features).toBeDefined();
    expect(editor.features.length).toBeGreaterThan(0);
    expect(editor.outputFormat).toBe('html');
    expect(editor.sanitize).toBe(true);
    expect(editor.validate).toBe(true);
  });

  it('accepts features as an array', () => {
    const editor = lexicalEditor({
      features: [BoldFeature(), ItalicFeature()],
    });
    expect(editor.features).toHaveLength(2);
    expect(editor.features.map((f) => f.key)).toEqual(['bold', 'italic']);
  });

  it('accepts features as a function', () => {
    const editor = lexicalEditor({
      features: ({ defaultFeatures }) => [...defaultFeatures, FixedToolbarFeature()],
    });
    expect(editor.features.length).toBeGreaterThan(1);
    expect(editor.features.some((f) => f.key === 'fixed-toolbar')).toBe(true);
  });

  it('provides defaultFeatures and rootFeatures to feature function', () => {
    let receivedDefault: unknown[] = [];
    let receivedRoot: unknown[] = [];

    lexicalEditor({
      features: ({ defaultFeatures, rootFeatures }) => {
        receivedDefault = defaultFeatures;
        receivedRoot = rootFeatures;
        return defaultFeatures;
      },
    });

    expect(receivedDefault.length).toBeGreaterThan(0);
    expect(receivedRoot.length).toBeGreaterThan(0);
  });
});

describe('Mark features', () => {
  it.each([
    ['bold', BoldFeature, 'strong'],
    ['italic', ItalicFeature, 'em'],
    ['underline', UnderlineFeature, 'u'],
    ['strikethrough', StrikethroughFeature, 's'],
    ['code', CodeFeature, 'code'],
    ['subscript', SubscriptFeature, 'sub'],
    ['superscript', SuperscriptFeature, 'sup'],
    ['inline-code', InlineCodeFeature, 'code'],
  ] as const)('%s feature', (key, factory, tag) => {
    const feature = factory();
    expect(feature.key).toBe(key);
    expect(feature.type).toBe('mark');
    expect(feature.tag).toBe(tag);
  });
});

describe('Block features', () => {
  it('creates heading feature with default sizes', () => {
    const feature = HeadingFeature();
    expect(feature.key).toBe('heading');
    expect(feature.type).toBe('block');
    expect(feature.options?.enabledHeadingSizes).toEqual(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  });

  it('creates heading feature with custom sizes', () => {
    const feature = HeadingFeature({ enabledHeadingSizes: ['h1', 'h2'] });
    expect(feature.options?.enabledHeadingSizes).toEqual(['h1', 'h2']);
  });

  it('creates paragraph feature', () => {
    const feature = ParagraphFeature();
    expect(feature.key).toBe('paragraph');
    expect(feature.type).toBe('block');
    expect(feature.tag).toBe('p');
  });

  it('creates list feature with defaults', () => {
    const feature = ListFeature();
    expect(feature.key).toBe('list');
    expect(feature.options?.ordered).toBe(true);
    expect(feature.options?.unordered).toBe(true);
  });

  it('creates list feature with custom options', () => {
    const feature = ListFeature({ ordered: false });
    expect(feature.options?.ordered).toBe(false);
    expect(feature.options?.unordered).toBe(true);
  });

  it('creates quote and blockquote (alias)', () => {
    const quote = QuoteFeature();
    const blockquote = BlockquoteFeature();
    expect(quote.key).toBe(blockquote.key);
    expect(quote.tag).toBe('blockquote');
  });

  it('creates code block feature', () => {
    expect(CodeBlockFeature().tag).toBe('pre');
  });

  it('creates horizontal rule feature', () => {
    expect(HorizontalRuleFeature().tag).toBe('hr');
  });

  it('creates checklist feature', () => {
    expect(ChecklistFeature().key).toBe('checklist');
  });

  it('creates ordered/unordered list features', () => {
    expect(OrderedListFeature().tag).toBe('ol');
    expect(UnorderedListFeature().tag).toBe('ul');
  });
});

describe('Inline features', () => {
  it('creates link feature with defaults', () => {
    const feature = LinkFeature();
    expect(feature.key).toBe('link');
    expect(feature.type).toBe('inline');
    expect(feature.options?.allowExternalLinks).toBe(true);
  });

  it('creates link feature with custom options', () => {
    const feature = LinkFeature({
      enabledCollections: ['pages'],
      allowExternalLinks: false,
    });
    expect(feature.options?.enabledCollections).toEqual(['pages']);
    expect(feature.options?.allowExternalLinks).toBe(false);
  });

  it('creates upload feature', () => {
    const feature = UploadFeature();
    expect(feature.key).toBe('upload');
    expect(feature.type).toBe('inline');
  });

  it('creates relationship feature', () => {
    const feature = RelationshipFeature({ enabledCollections: ['posts'] });
    expect(feature.options?.enabledCollections).toEqual(['posts']);
  });
});

describe('Toolbar features', () => {
  it('creates fixed toolbar', () => {
    const feature = FixedToolbarFeature();
    expect(feature.key).toBe('fixed-toolbar');
    expect(feature.type).toBe('toolbar');
    expect(feature.position).toBe('fixed');
  });

  it('creates floating toolbar', () => {
    const feature = FloatingToolbarFeature();
    expect(feature.position).toBe('floating');
  });

  it('creates inline toolbar', () => {
    const feature = InlineToolbarFeature();
    expect(feature.position).toBe('inline');
  });
});

describe('Utility features', () => {
  it('creates tree view feature', () => {
    expect(TreeViewFeature().type).toBe('utility');
  });

  it('creates history feature', () => {
    expect(HistoryFeature().key).toBe('history');
  });

  it('creates indent feature', () => {
    expect(IndentFeature().key).toBe('indent');
  });

  it('creates align feature', () => {
    expect(AlignFeature().key).toBe('align');
  });

  it('creates blocks feature', () => {
    expect(BlocksFeature().key).toBe('blocks');
  });
});
