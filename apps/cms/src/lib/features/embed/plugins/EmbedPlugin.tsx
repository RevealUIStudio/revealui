'use client';

import {
  $insertNodeToNearestRoot,
  mergeRegister,
  type PluginComponent,
  useLexicalComposerContext,
} from '@revealui/core/richtext/client';
import { FieldsDrawer, useModal } from '@revealui/core/ui';
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  type RangeSelection,
} from 'lexical';
import { useEffect, useState } from 'react';
import {
  $createEmbedNode,
  type EmbedNode,
  type EmbedNodeData,
  INSERT_EMBED_COMMAND,
  OPEN_EMBED_DRAWER_COMMAND,
} from '../nodes/EmbedNode';

const drawerSlug = 'lexical-embed-create';

export const EmbedPlugin: PluginComponent = () => {
  const [editor] = useLexicalComposerContext();
  const { closeModal, toggleModal } = useModal();
  const [lastSelection, setLastSelection] = useState<RangeSelection | null>(null);
  const [embedData, setEmbedData] = useState<EmbedNodeData>({ url: '' });
  const [targetNodeKey, setTargetNodeKey] = useState<string | null>(null);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        INSERT_EMBED_COMMAND,
        ({ url }) => {
          if (targetNodeKey) {
            // Replace existing embed node
            const node: EmbedNode = $getNodeByKey(targetNodeKey) as EmbedNode;
            if (!node) {
              return false;
            }
            node.setData({ url });

            setTargetNodeKey(null);
            return true;
          }

          let selection = $getSelection();

          if (!$isRangeSelection(selection)) {
            selection = lastSelection as RangeSelection | null;
            if (!$isRangeSelection(selection)) {
              return false;
            }
          }

          const focusNode = selection.focus.getNode();

          if (focusNode !== null) {
            const embedNode = $createEmbedNode({
              url,
            });
            $insertNodeToNearestRoot(embedNode);
          }

          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        OPEN_EMBED_DRAWER_COMMAND,
        (commandData) => {
          setEmbedData(commandData?.data ?? { url: '' });
          setTargetNodeKey(commandData?.nodeKey ?? null);

          if (commandData?.nodeKey) {
            toggleModal(drawerSlug);
            return true;
          }

          editor.getEditorState().read(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              setLastSelection(selection);
              toggleModal(drawerSlug);
            }
          });

          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor, lastSelection, targetNodeKey, toggleModal]);

  return (
    <FieldsDrawer
      data={embedData}
      drawerSlug={drawerSlug}
      drawerTitle="Create Embed"
      featureKey="embed"
      schemaPath="embed.fields"
      handleDrawerSubmit={(_fields, data) => {
        closeModal(drawerSlug);
        if (data.url) {
          editor.dispatchCommand(INSERT_EMBED_COMMAND, {
            url: data.url as string,
          });
        }
      }}
      schemaPathSuffix="fields"
    />
  );
};
