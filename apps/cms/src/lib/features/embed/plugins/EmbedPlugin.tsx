/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import {
  $insertNodeToNearestRoot,
  mergeRegister,
  useLexicalComposerContext,
} from '@revealui/cms/richtext-lexical/client'
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  type RangeSelection,
} from 'lexical'
import { useEffect, useState } from 'react'
import {
  $createEmbedNode,
  type EmbedNode,
  type EmbedNodeData,
  INSERT_EMBED_COMMAND,
  OPEN_EMBED_DRAWER_COMMAND,
} from '../nodes/EmbedNode'

// Stub types for PayloadCMS compatibility
type PluginComponent = React.FC

// Stub useModal hook
const useModal = () => ({
  closeModal: (_slug: string) => {},
  toggleModal: (_slug: string) => {},
  isModalOpen: (_slug: string) => false,
})

// Stub FieldsDrawer component
const FieldsDrawer: React.FC<{
  data: any
  drawerSlug: string
  drawerTitle: string
  featureKey: string
  schemaPath: string
  handleDrawerSubmit: (fields: any, data: any) => void
  schemaPathSuffix: string
}> = () => null

const drawerSlug = 'lexical-embed-create'

export const EmbedPlugin: PluginComponent = () => {
  const [editor] = useLexicalComposerContext()
  const { closeModal, toggleModal } = useModal()
  const [lastSelection, setLastSelection] = useState<RangeSelection | null>()
  const [embedData, setEmbedData] = useState<EmbedNodeData | {}>({})
  const [targetNodeKey, setTargetNodeKey] = useState<string | null>(null)

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        INSERT_EMBED_COMMAND,
        ({ url }) => {
          if (targetNodeKey) {
            // Replace existing embed node
            const node: EmbedNode = $getNodeByKey(targetNodeKey) as EmbedNode
            if (!node) {
              return false
            }
            node.setData({ url })

            setTargetNodeKey(null)
            return true
          }

          let selection = $getSelection()

          if (!$isRangeSelection(selection)) {
            selection = lastSelection as RangeSelection | null
            if (!$isRangeSelection(selection)) {
              return false
            }
          }

          const focusNode = selection.focus.getNode()

          if (focusNode !== null) {
            const horizontalRuleNode = $createEmbedNode({
              url,
            })
            $insertNodeToNearestRoot(horizontalRuleNode)
          }

          return true
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand(
        OPEN_EMBED_DRAWER_COMMAND,
        (embedData) => {
          setEmbedData(embedData?.data ?? {})
          setTargetNodeKey(embedData?.nodeKey ?? null)

          if (embedData?.nodeKey) {
            toggleModal(drawerSlug)
            return true
          }

          let rangeSelection: RangeSelection | null = null

          editor.getEditorState().read(() => {
            const selection = $getSelection()
            if ($isRangeSelection(selection)) {
              rangeSelection = selection
            }
          })

          if (rangeSelection) {
            setLastSelection(rangeSelection)
            toggleModal(drawerSlug)
          }
          return true
        },
        COMMAND_PRIORITY_EDITOR
      )
    )
  }, [editor, lastSelection, targetNodeKey, toggleModal])

  return (
    <FieldsDrawer
      data={embedData}
      drawerSlug={drawerSlug}
      drawerTitle={'Create Embed'}
      featureKey="embed"
      schemaPath="embed.fields"
      handleDrawerSubmit={(_fields, data) => {
        closeModal(drawerSlug)
        if (!data.url) {
          return
        }

        editor.dispatchCommand(INSERT_EMBED_COMMAND, {
          url: data.url as string,
        })
      }}
      schemaPathSuffix="fields"
    />
  )
}
