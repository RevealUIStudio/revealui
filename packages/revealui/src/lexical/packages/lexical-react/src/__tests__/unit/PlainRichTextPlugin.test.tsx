/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {HashtagNode} from '../../../lexical/packages/lexical-hashtag/src/index';
import {AutoLinkNode, LinkNode} from '../../../lexical/packages/lexical-link/src/index';
import {ListItemNode, ListNode} from '../../../lexical/packages/lexical-list/src/index';
import {OverflowNode} from '../../../lexical/packages/lexical-overflow/src/index';
import {LexicalComposer} from '../../../lexical/packages/lexical-react/src/index';
import {useLexicalComposerContext} from '../../../lexical/packages/lexical-react/src/index';
import {ContentEditable} from '../../../lexical/packages/lexical-react/src/index';
import {LexicalErrorBoundary} from '../../../lexical/packages/lexical-react/src/index';
import {PlainTextPlugin} from '../../../lexical/packages/lexical-react/src/index';
import {RichTextPlugin} from '../../../lexical/packages/lexical-react/src/index';
import {HeadingNode, QuoteNode} from '../../../lexical/packages/lexical-rich-text/src/index';
import {TableCellNode, TableNode, TableRowNode} from '../../../lexical/packages/lexical-table/src/index';
import {$rootTextContent} from '../../../lexical/packages/lexical-text/src/index';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  LexicalEditor,
} from 'lexical';
import * as React from 'react';
import {createRoot, Root} from 'react-dom/client';
import * as ReactTestUtils from 'shared/react-test-utils';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const RICH_TEXT_NODES = [
  HeadingNode,
  ListNode,
  ListItemNode,
  QuoteNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  HashtagNode,
  AutoLinkNode,
  LinkNode,
  OverflowNode,
];

describe('LexicalNodeHelpers tests', () => {
  let container: HTMLDivElement | null = null;
  let reactRoot: Root;

  beforeEach(() => {
    container = document.createElement('div');
    reactRoot = createRoot(container);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container!);
    container = null;

    vi.restoreAllMocks();
  });

  for (const plugin of ['PlainTextPlugin', 'RichTextPlugin']) {
    it(`${plugin} custom initialEditorState`, async () => {
      let editor;

      function GrabEditor() {
        [editor] = useLexicalComposerContext();
        return null;
      }

      const $initialEditorState = () => {
        $getRoot().append(
          $createParagraphNode().append($createTextNode('foo')),
        );
      };

      function App() {
        return (
          <LexicalComposer
            initialConfig={{
              editorState: $initialEditorState,
              namespace: '',
              nodes: plugin === 'PlainTextPlugin' ? [] : RICH_TEXT_NODES,
              onError: (err) => {
                throw err;
              },
              theme: {},
            }}>
            <GrabEditor />
            {plugin === 'PlainTextPlugin' ? (
              <PlainTextPlugin
                contentEditable={<ContentEditable />}
                placeholder={null}
                ErrorBoundary={LexicalErrorBoundary}
              />
            ) : (
              <RichTextPlugin
                contentEditable={<ContentEditable />}
                placeholder={null}
                ErrorBoundary={LexicalErrorBoundary}
              />
            )}
          </LexicalComposer>
        );
      }

      await ReactTestUtils.act(async () => {
        reactRoot.render(<App />);
      });

      const text = editor!.getEditorState().read($rootTextContent);
      expect(text).toBe('foo');
    });
  }

  for (const plugin of ['PlainTextPlugin', 'RichTextPlugin']) {
    it(`${plugin} custom initialEditorState`, async () => {
      let editor;
      const initialEditorStateJson = `
      {"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"foo","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}
      `;

      function GrabEditor() {
        [editor] = useLexicalComposerContext();
        return null;
      }

      function App() {
        return (
          <LexicalComposer
            initialConfig={{
              editorState: initialEditorStateJson,
              namespace: '',
              nodes: plugin === 'PlainTextPlugin' ? [] : RICH_TEXT_NODES,
              onError: (err) => {
                throw err;
              },
              theme: {},
            }}>
            <GrabEditor />
            {plugin === 'PlainTextPlugin' ? (
              <PlainTextPlugin
                contentEditable={<ContentEditable />}
                placeholder={null}
                ErrorBoundary={LexicalErrorBoundary}
              />
            ) : (
              <RichTextPlugin
                contentEditable={<ContentEditable />}
                placeholder={null}
                ErrorBoundary={LexicalErrorBoundary}
              />
            )}
          </LexicalComposer>
        );
      }

      await ReactTestUtils.act(async () => {
        reactRoot.render(<App />);
      });

      await editor!.focus();

      await editor!.getEditorState().read(() => {
        expect($rootTextContent()).toBe('foo');

        const selection = $getSelection();

        if (!$isRangeSelection(selection)) {
          return;
        }

        expect(selection.anchor.getNode().getTextContent()).toBe('foo');
        expect(selection.focus.getNode().getTextContent()).toBe('foo');
      });
    });
  }

  for (const plugin of ['PlainTextPlugin', 'RichTextPlugin']) {
    it(`${plugin} can hide placeholder when non-editable`, async () => {
      let editor: LexicalEditor;

      function GrabEditor() {
        [editor] = useLexicalComposerContext();
        return null;
      }

      function App() {
        return (
          <LexicalComposer
            initialConfig={{
              namespace: '',
              nodes: plugin === 'PlainTextPlugin' ? [] : RICH_TEXT_NODES,
              onError: (err) => {
                throw err;
              },
              theme: {},
            }}>
            <GrabEditor />
            {plugin === 'PlainTextPlugin' ? (
              <PlainTextPlugin
                contentEditable={<ContentEditable />}
                placeholder={(isEditable) =>
                  isEditable ? (
                    <span className="placeholder">My placeholder</span>
                  ) : null
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            ) : (
              <RichTextPlugin
                contentEditable={<ContentEditable />}
                placeholder={(isEditable) =>
                  isEditable ? (
                    <span className="placeholder">My placeholder</span>
                  ) : null
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            )}
          </LexicalComposer>
        );
      }

      await ReactTestUtils.act(async () => {
        reactRoot.render(<App />);
      });

      function placeholderText() {
        const placeholderContainer = container!.querySelector('.placeholder');
        return placeholderContainer && placeholderContainer.textContent;
      }

      expect(placeholderText()).toBe('My placeholder');
      await ReactTestUtils.act(async () => {
        editor.setEditable(false);
        reactRoot.render(<App />);
      });
      expect(placeholderText()).toBe(null);
    });
  }
});
