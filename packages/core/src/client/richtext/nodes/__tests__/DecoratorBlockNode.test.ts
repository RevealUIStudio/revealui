// @vitest-environment jsdom
/**
 * DecoratorBlockNode isInline/canIndent tests
 *
 * DecoratorBlockNode extends Lexical's DecoratorNode without overriding
 * isInline(), so it inherits the DecoratorNode default of `true`.
 * $insertNodeToNearestRoot branches on isInline(): an inline node gets
 * wrapped in a paragraph before insertion. That means every
 * editor-inserted image persists as root > paragraph > image and renders
 * as <p><figure><img/></figure></p>, which is invalid HTML (a <figure> is
 * not permitted inside a <p>) and causes a hydration mismatch. Matching
 * @lexical/react's LexicalDecoratorBlockNode (isInline(): false), the
 * image node must land directly under the root.
 */

import { $insertNodeToNearestRoot } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import { $getRoot, createEditor } from 'lexical';
import { describe, expect, it } from 'vitest';
import { $createImageNode, ImageNode } from '../ImageNode.js';

function createTestEditor(): LexicalEditor {
  return createEditor({
    nodes: [ImageNode],
    onError: (error) => {
      throw error;
    },
  });
}

describe('DecoratorBlockNode isInline/canIndent', () => {
  it('inserts an ImageNode as a direct child of the root, not wrapped in a paragraph', () => {
    const editor = createTestEditor();

    editor.update(
      () => {
        $getRoot().selectEnd();
        const imageNode = $createImageNode({ src: 'x' });
        $insertNodeToNearestRoot(imageNode);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const imageNode = root
        .getChildren()
        .find((child): child is ImageNode => child instanceof ImageNode);

      expect(imageNode).toBeDefined();
      expect(imageNode?.getParent()).toBe(root);
    });
  });

  it('reports isInline() as false and canIndent() as false', () => {
    const editor = createTestEditor();
    let imageNode: ImageNode | undefined;

    editor.update(
      () => {
        imageNode = $createImageNode({ src: 'x' });
      },
      { discrete: true },
    );

    expect((imageNode as ImageNode).isInline()).toBe(false);
    expect((imageNode as ImageNode).canIndent()).toBe(false);
  });
});
