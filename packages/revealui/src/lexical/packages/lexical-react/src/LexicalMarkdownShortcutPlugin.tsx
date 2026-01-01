/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {ElementTransformer, Transformer} from '../../../lexical/packages/lexical-markdown/src/index';
import type {LexicalNode} from 'lexical';

import {registerMarkdownShortcuts, TRANSFORMERS} from '../../../lexical/packages/lexical-markdown/src/index';
import {useLexicalComposerContext} from '../../../lexical/packages/lexical-react/src/index';
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from '../../../lexical/packages/lexical-react/src/index';
import {useEffect} from 'react';

const HR: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node: LexicalNode) => {
    return $isHorizontalRuleNode(node) ? '***' : null;
  },
  regExp: /^(---|\*\*\*|___)\s?$/,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createHorizontalRuleNode();

    // TODO: Get rid of isImport flag
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(line);
    } else {
      parentNode.insertBefore(line);
    }

    line.selectNext();
  },
  type: 'element',
};
export const DEFAULT_TRANSFORMERS = [HR, ...TRANSFORMERS];

export function MarkdownShortcutPlugin({
  transformers = DEFAULT_TRANSFORMERS,
}: Readonly<{
  transformers?: Array<Transformer>;
}>): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return registerMarkdownShortcuts(editor, transformers);
  }, [editor, transformers]);

  return null;
}
