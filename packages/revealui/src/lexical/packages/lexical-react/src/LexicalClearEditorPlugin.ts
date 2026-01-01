/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {JSX} from 'react';

import {registerClearEditor} from '../../../lexical/packages/lexical-extension/src/index';
import {useLexicalComposerContext} from '../../../lexical/packages/lexical-react/src/index';
import useLayoutEffect from 'shared/useLayoutEffect';

type Props = Readonly<{
  onClear?: () => void;
}>;

export function ClearEditorPlugin({onClear}: Props): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  useLayoutEffect(
    () => registerClearEditor(editor, onClear),
    [editor, onClear],
  );
  return null;
}
