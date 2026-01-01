/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {registerCheckList} from '../../../lexical/packages/lexical-list/src/index';
import {useLexicalComposerContext} from '../../../lexical/packages/lexical-react/src/index';
import {useEffect} from 'react';

export function CheckListPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return registerCheckList(editor);
  }, [editor]);
  return null;
}
