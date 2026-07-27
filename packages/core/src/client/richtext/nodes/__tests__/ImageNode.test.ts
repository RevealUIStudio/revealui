// @vitest-environment jsdom
/**
 * ImageNode createDOM/updateDOM tests
 *
 * DecoratorBlockNode (the shared base for ImageNode and the admin app's
 * custom feature nodes) extends Lexical's DecoratorNode without overriding
 * createDOM/updateDOM. Lexical's DecoratorNode inherits the throwing base
 * implementations from LexicalNode, so any reconciliation of a
 * DecoratorBlockNode subclass throws Lexical invariant #70
 * ("createDOM: base method not extended") the first time it is rendered.
 * This package's default vitest environment is node (see
 * packages/dev/src/vitest/create-config.ts), so `document` is stubbed via
 * jsdom for this file only.
 */

import type { EditorConfig, LexicalEditor } from 'lexical';
import { createEditor } from 'lexical';
import { describe, expect, it } from 'vitest';
import { $createImageNode, ImageNode } from '../ImageNode.js';

const editorConfig: EditorConfig = { namespace: 'test', theme: {} };

function createTestEditor(): LexicalEditor {
  return createEditor({
    nodes: [ImageNode],
    onError: (error) => {
      throw error;
    },
  });
}

describe('ImageNode createDOM/updateDOM', () => {
  it('createDOM returns an HTMLElement instead of throwing invariant #70', () => {
    const editor = createTestEditor();
    let node: ImageNode | undefined;
    editor.update(
      () => {
        node = $createImageNode({ src: 'https://example.com/photo.png', alt: 'photo' });
      },
      { discrete: true },
    );

    expect(node).toBeDefined();
    const dom = (node as ImageNode).createDOM(editorConfig, editor);
    expect(dom).toBeInstanceOf(HTMLElement);
  });

  it('updateDOM returns false (never recreates the DOM element)', () => {
    const editor = createTestEditor();
    let node: ImageNode | undefined;
    editor.update(
      () => {
        node = $createImageNode({ src: 'https://example.com/photo.png', alt: 'photo' });
      },
      { discrete: true },
    );

    const imageNode = node as ImageNode;
    const dom = imageNode.createDOM(editorConfig, editor);
    expect(imageNode.updateDOM(imageNode, dom, editorConfig)).toBe(false);
  });
});
