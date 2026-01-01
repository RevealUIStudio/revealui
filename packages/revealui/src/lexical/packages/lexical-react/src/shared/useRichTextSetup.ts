/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {LexicalEditor} from 'lexical';

import {registerDragonSupport} from '../../../lexical/packages/lexical-dragon/src/index';
import {registerRichText} from '../../../lexical/packages/lexical-rich-text/src/index';
import {mergeRegister} from '../../../lexical/packages/lexical-utils/src/index';
import useLayoutEffect from 'shared/useLayoutEffect';

export function useRichTextSetup(editor: LexicalEditor): void {
  useLayoutEffect(() => {
    return mergeRegister(
      registerRichText(editor),
      registerDragonSupport(editor),
    );

    // We only do this for init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);
}
