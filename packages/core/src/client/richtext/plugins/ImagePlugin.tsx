'use client';

/**
 * RevealUI Rich Text Editor - Image Plugin
 *
 * Plugin for handling image insertion and management in the editor.
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $insertNodeToNearestRoot, mergeRegister } from '@lexical/utils';
import type { RangeSelection } from 'lexical';
import { $getNodeByKey, $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR } from 'lexical';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  $createImageNode,
  ImageNode,
  INSERT_IMAGE_COMMAND,
  OPEN_IMAGE_UPLOAD_COMMAND,
} from '../nodes/ImageNode.js';

export const ImagePlugin: React.FC = () => {
  const [editor] = useLexicalComposerContext();
  const [lastSelection, setLastSelection] = useState<RangeSelection | null>(null);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        INSERT_IMAGE_COMMAND,
        ({ src, alt, width, height, caption }) => {
          let selection = $getSelection();

          if (!$isRangeSelection(selection)) {
            selection = lastSelection;
            if (!$isRangeSelection(selection)) {
              // No selection, insert at root
              editor.update(() => {
                const imageNode = $createImageNode({
                  src,
                  alt,
                  width,
                  height,
                  caption,
                });
                $insertNodeToNearestRoot(imageNode);
              });
              return true;
            }
          }

          const focusNode = selection.focus.getNode();

          if (focusNode !== null) {
            editor.update(() => {
              const imageNode = $createImageNode({
                src,
                alt,
                width,
                height,
                caption,
              });
              $insertNodeToNearestRoot(imageNode);
            });
          }

          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        OPEN_IMAGE_UPLOAD_COMMAND,
        ({ data, nodeKey }) => {
          // Handle image editing/replacement
          if (nodeKey && data) {
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if (node && node instanceof ImageNode) {
                node.setData(data);
              }
            });
            return true;
          }

          // Handle new image upload - trigger file input
          // This will be handled by ImageUploadButton component
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            setLastSelection(selection);
          }
        });
      }),
    );
  }, [editor, lastSelection]);

  return null;
};
