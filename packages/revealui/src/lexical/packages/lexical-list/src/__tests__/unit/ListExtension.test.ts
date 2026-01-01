/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {buildEditorFromExtensions, defineExtension} from '../../../lexical/packages/lexical-extension/src/index';
import {
  $createListItemNode,
  $createListNode,
  $isListNode,
  CheckListExtension,
  ListExtension,
} from '../../../lexical/packages/lexical-list/src/index';
import {RichTextExtension} from '../../../lexical/packages/lexical-rich-text/src/index';
import {$createTextNode, $getRoot} from 'lexical';
import {describe, expect, it} from 'vitest';

// TODO: write more tests here
describe('ListExtension', () => {
  const extension = defineExtension({
    $initialEditorState: () => {
      $getRoot().append(
        $createListNode('number').append(
          $createListItemNode().append($createTextNode('item 1')),
          $createListItemNode().append($createTextNode('item 2')),
        ),
      );
    },
    dependencies: [ListExtension, RichTextExtension],
    name: '[root]',
  });
  it('Creates the list', () => {
    const editor = buildEditorFromExtensions(extension);
    editor.update(
      () => {
        const ol = $getRoot().getFirstChildOrThrow();
        expect($isListNode(ol)).toBe(true);
      },
      {discrete: true},
    );
    editor.dispose();
  });
});
describe('CheckListExtension', () => {
  const extension = defineExtension({
    $initialEditorState: () => {
      $getRoot().append(
        $createListNode('check').append(
          $createListItemNode(true).append($createTextNode('checked')),
          $createListItemNode(false).append($createTextNode('unchecked')),
        ),
      );
    },
    dependencies: [CheckListExtension, RichTextExtension],
    name: '[root]',
  });
  it('Creates the list', () => {
    const editor = buildEditorFromExtensions(extension);
    editor.update(
      () => {
        const ul = $getRoot().getFirstChildOrThrow();
        expect($isListNode(ul)).toBe(true);
      },
      {discrete: true},
    );
    editor.dispose();
  });
});
