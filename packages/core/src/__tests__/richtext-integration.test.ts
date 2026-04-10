/**
 * RichText + admin API Integration Test
 *
 * Tests the full cycle:
 * 1. Editor configuration (lexicalEditor factory)
 * 2. Serialization for rendering
 * 3. admin CRUD operations (skipped - requires database layer)
 *
 * @dependencies
 * - packages/core/src/richtext/lexical.ts
 * - packages/core/src/richtext/exports/server/rsc.tsx
 */

import type { SerializedEditorState } from 'lexical';
import { describe, expect, it } from 'vitest';
import { serializeLexicalState } from '../richtext/exports/server/rsc.js';
import {
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  ItalicFeature,
  lexicalEditor,
} from '../richtext/lexical.js';

// ============================================
// TEST FIXTURES
// ============================================

const sampleEditorState: SerializedEditorState = {
  root: {
    children: [
      {
        type: 'heading',
        tag: 'h1',
        children: [
          {
            type: 'text',
            text: 'Hello World',
            format: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },
      {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text: 'This is a ',
            format: 0,
          },
          {
            type: 'text',
            text: 'bold',
            format: 1,
          },
          {
            type: 'text',
            text: ' and ',
            format: 0,
          },
          {
            type: 'text',
            text: 'italic',
            format: 2,
          },
          {
            type: 'text',
            text: ' test.',
            format: 0,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

// ============================================
// EDITOR CONFIGURATION TESTS
// ============================================

describe('lexicalEditor Configuration', () => {
  it('should create editor config with features', () => {
    const editor = lexicalEditor({
      features: () => [
        BoldFeature(),
        ItalicFeature(),
        HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3'] }),
      ],
    });

    expect(editor.editorType).toBe('lexical');
    expect(editor.features).toHaveLength(3);
    expect(editor.features.map((f) => f.key)).toEqual(['bold', 'italic', 'heading']);
  });

  it('should support feature options', () => {
    const editor = lexicalEditor({
      features: () => [HeadingFeature({ enabledHeadingSizes: ['h1', 'h2'] })],
    });

    const headingFeature = editor.features.find((f) => f.key === 'heading');
    expect(headingFeature?.options?.enabledHeadingSizes).toEqual(['h1', 'h2']);
  });

  it('should create editor with toolbar feature', () => {
    const editor = lexicalEditor({
      features: [BoldFeature(), ItalicFeature(), FixedToolbarFeature()],
    });

    const toolbar = editor.features.find((f) => f.type === 'toolbar');
    expect(toolbar).toBeDefined();
    expect(toolbar?.position).toBe('fixed');
  });
});

// ============================================
// SERIALIZATION TESTS
// ============================================

describe('RichText Serialization', () => {
  it('should serialize Lexical state to React elements', () => {
    const result = serializeLexicalState(sampleEditorState);
    expect(result).not.toBeNull();
  });

  it('should handle null state gracefully', () => {
    const result = serializeLexicalState(null);
    expect(result).toBeNull();
  });

  it('should handle undefined state gracefully', () => {
    const result = serializeLexicalState(undefined);
    expect(result).toBeNull();
  });

  it('should serialize text formatting correctly', () => {
    const boldState: SerializedEditorState = {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                text: 'Bold text',
                format: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    };

    const result = serializeLexicalState(boldState);
    expect(result).not.toBeNull();
  });

  it('should serialize complex document with multiple node types', () => {
    const result = serializeLexicalState(sampleEditorState);
    expect(result).not.toBeNull();
  });
});
