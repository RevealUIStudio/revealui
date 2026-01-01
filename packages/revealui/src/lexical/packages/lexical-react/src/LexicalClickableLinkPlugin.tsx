/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {namedSignals} from '../../../lexical/packages/lexical-extension/src/index';
import {registerClickableLink} from '../../../lexical/packages/lexical-link/src/index';
import {useLexicalComposerContext} from '../../../lexical/packages/lexical-react/src/index';
import {useEffect} from 'react';

export function ClickableLinkPlugin({
  newTab = true,
  disabled = false,
}: {
  newTab?: boolean;
  disabled?: boolean;
}): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return registerClickableLink(editor, namedSignals({disabled, newTab}));
  }, [editor, newTab, disabled]);

  return null;
}
