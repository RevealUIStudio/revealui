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
  $createLabelNode,
  INSERT_LABEL_COMMAND,
  type LabelNode,
  type LabelNodeData,
  OPEN_LABEL_DRAWER_COMMAND,
} from '../nodes/LabelNode';

const drawerSlug = 'lexical-Label-create';

export const LabelPlugin: PluginComponent = () => {
  const [editor] = useLexicalComposerContext();
  const { closeModal, toggleModal } = useModal();
  const [lastSelection, setLastSelection] = useState<RangeSelection | null>(null);
  const [labelData, setLabelData] = useState<LabelNodeData>({ url: '' }); // Initialize with a default structure
  const [targetNodeKey, setTargetNodeKey] = useState<string | null>(null);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        INSERT_LABEL_COMMAND,
        ({ url }: { url: string }) => {
          if (targetNodeKey) {
            const node = $getNodeByKey(targetNodeKey) as LabelNode | null;
            if (node) {
              node.setData({ url });
              setTargetNodeKey(null);
              return true;
            }
          }

          const selection = $getSelection();

          if ($isRangeSelection(selection)) {
            const focusNode = selection.focus.getNode();
            if (focusNode) {
              const labelNode = $createLabelNode({ url });
              $insertNodeToNearestRoot(labelNode);
              return true;
            }
          } else if (lastSelection && $isRangeSelection(lastSelection)) {
            const labelNode = $createLabelNode({ url });
            $insertNodeToNearestRoot(labelNode);
            return true;
          }

          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand(
        OPEN_LABEL_DRAWER_COMMAND,
        (labelData: { data?: LabelNodeData; nodeKey?: string }) => {
          setLabelData(labelData?.data ?? { url: '' }); // Ensure the data structure matches LabelNodeData
          setTargetNodeKey(labelData?.nodeKey ?? null);

          if (labelData?.nodeKey) {
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
      data={labelData}
      drawerSlug={drawerSlug}
      drawerTitle="Create Label"
      schemaPath="label.fields"
      featureKey="label"
      handleDrawerSubmit={(_fields, data) => {
        closeModal(drawerSlug);
        if (data.url) {
          editor.dispatchCommand(INSERT_LABEL_COMMAND, {
            url: data.url as string,
          });
        }
      }}
      schemaPathSuffix="fields"
    />
  );
};
