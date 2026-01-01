/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {EntityMatch} from '../../../lexical/packages/lexical-text/src/index';
import type {Klass, TextNode} from 'lexical';

import {useLexicalComposerContext} from '../../../lexical/packages/lexical-react/src/index';
import {registerLexicalTextEntity} from '../../../lexical/packages/lexical-text/src/index';
import {mergeRegister} from '../../../lexical/packages/lexical-utils/src/index';
import {useEffect} from 'react';

export function useLexicalTextEntity<T extends TextNode>(
  getMatch: (text: string) => null | EntityMatch,
  targetNode: Klass<T>,
  createNode: (textNode: TextNode) => T,
): void {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      ...registerLexicalTextEntity(editor, getMatch, targetNode, createNode),
    );
  }, [createNode, editor, getMatch, targetNode]);
}
