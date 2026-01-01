/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {JSX} from 'react';

import {registerCodeHighlighting} from '../../../lexical/packages/lexical-code/src/index';
import {useLexicalComposerContext} from '../../../lexical/packages/lexical-react/src/index';
import {useEffect} from 'react';

export default function CodeHighlightPrismPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return registerCodeHighlighting(editor);
  }, [editor]);

  return null;
}
