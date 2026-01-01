/* eslint-disable perfectionist/sort-exports */
'use client'

export { slashMenuBasicGroupWithItems } from '../../features/shared/slashMenu/basicGroup'

export { AlignFeatureClient } from '../../features/align/client/index'
export { BlockquoteFeatureClient } from '../../features/blockquote/client/index'
export { BlocksFeatureClient } from '../../features/blocks/client/index'
export {
  INSERT_BLOCK_COMMAND,
  INSERT_INLINE_BLOCK_COMMAND,
} from '../../features/blocks/client/plugin/commands'

export { TestRecorderFeatureClient } from '../../features/debug/testRecorder/client/index'
export { TreeViewFeatureClient } from '../../features/debug/treeView/client/index'
export { BoldFeatureClient } from '../../features/format/bold/feature.client'
export { InlineCodeFeatureClient } from '../../features/format/inlineCode/feature.client'
export { ItalicFeatureClient } from '../../features/format/italic/feature.client'
export { StrikethroughFeatureClient } from '../../features/format/strikethrough/feature.client'
export { SubscriptFeatureClient } from '../../features/format/subscript/feature.client'
export { SuperscriptFeatureClient } from '../../features/format/superscript/feature.client'
export { UnderlineFeatureClient } from '../../features/format/underline/feature.client'
export { TextStateFeatureClient } from '../../features/textState/feature.client'
export { HeadingFeatureClient } from '../../features/heading/client/index'
export { HorizontalRuleFeatureClient } from '../../features/horizontalRule/client/index'
export { IndentFeatureClient } from '../../features/indent/client/index'
export { LinkFeatureClient } from '../../features/link/client/index'
export { ChecklistFeatureClient } from '../../features/lists/checklist/client/index'
export { OrderedListFeatureClient } from '../../features/lists/orderedList/client/index'
export { UnorderedListFeatureClient } from '../../features/lists/unorderedList/client/index'
export { LexicalPluginToLexicalFeatureClient } from '../../features/migrations/lexicalPluginToLexical/feature.client'
export { SlateToLexicalFeatureClient } from '../../features/migrations/slateToLexical/feature.client'
export { ParagraphFeatureClient } from '../../features/paragraph/client/index'
export { DebugJsxConverterFeatureClient } from '../../features/debug/jsxConverter/client/index'
export { defaultColors } from '../../features/textState/defaultColors'

export { RelationshipFeatureClient } from '../../features/relationship/client/index'

export { toolbarFormatGroupWithItems } from '../../features/format/shared/toolbarFormatGroup'
export { toolbarAddDropdownGroupWithItems } from '../../features/shared/toolbar/addDropdownGroup'
export { toolbarFeatureButtonsGroupWithItems } from '../../features/shared/toolbar/featureButtonsGroup'
export { toolbarTextDropdownGroupWithItems } from '../../features/shared/toolbar/textDropdownGroup'
export { FixedToolbarFeatureClient } from '../../features/toolbars/fixed/client/index'
export { InlineToolbarFeatureClient } from '../../features/toolbars/inline/client/index'
export { ToolbarButton } from '../../features/toolbars/shared/ToolbarButton/index'
export { TableFeatureClient } from '../../features/experimental_table/client/index'

export { ToolbarDropdown } from '../../features/toolbars/shared/ToolbarDropdown/index'
export { UploadFeatureClient } from '../../features/upload/client/index'

export { RichTextField } from '../../field/index'
export {
  EditorConfigProvider,
  useEditorConfigContext,
} from '../../lexical/config/client/EditorConfigProvider'
export { defaultEditorLexicalConfig } from '../../lexical/config/client/default'

export {
  sanitizeClientEditorConfig,
  sanitizeClientFeatures,
} from '../../lexical/config/client/sanitize'
export { CAN_USE_DOM } from '../../lexical/utils/canUseDOM'
export { getDOMRangeRect } from '../../lexical/utils/getDOMRangeRect'
export { getSelectedNode } from '../../lexical/utils/getSelectedNode'
export { isHTMLElement } from '../../lexical/utils/guard'
export { joinClasses } from '../../lexical/utils/joinClasses'

export { createBlockNode } from '../../lexical/utils/markdown/createBlockNode'
export { isPoint, Point } from '../../lexical/utils/point'
export { Rect } from '../../lexical/utils/rect'
export { setFloatingElemPosition } from '../../lexical/utils/setFloatingElemPosition'
export { setFloatingElemPositionForLinkEditor } from '../../lexical/utils/setFloatingElemPositionForLinkEditor'

export {
  addSwipeDownListener,
  addSwipeLeftListener,
  addSwipeRightListener,
  addSwipeUpListener,
} from '../../lexical/utils/swipe'
export { createClientFeature } from '../../utilities/createClientFeature'

export {
  DETAIL_TYPE_TO_DETAIL,
  DOUBLE_LINE_BREAK,
  ELEMENT_FORMAT_TO_TYPE,
  ELEMENT_TYPE_TO_FORMAT,
  IS_ALL_FORMATTING,
  LTR_REGEX,
  NodeFormat,
  NON_BREAKING_SPACE,
  RTL_REGEX,
  TEXT_MODE_TO_TYPE,
  TEXT_TYPE_TO_FORMAT,
  TEXT_TYPE_TO_MODE,
} from '../../lexical/utils/nodeFormat'

export { ENABLE_SLASH_MENU_COMMAND } from '../../lexical/plugins/SlashMenu/LexicalTypeaheadMenuPlugin/index'

export { getEnabledNodes } from '../../lexical/nodes/index'

export {
  $createUploadNode,
  $isUploadNode,
  UploadNode,
} from '../../features/upload/client/nodes/UploadNode'

export {
  $createRelationshipNode,
  $isRelationshipNode,
  RelationshipNode,
} from '../../features/relationship/client/nodes/RelationshipNode'

export {
  $createLinkNode,
  $isLinkNode,
  LinkNode,
  TOGGLE_LINK_COMMAND,
} from '../../features/link/nodes/LinkNode'

export {
  $createAutoLinkNode,
  $isAutoLinkNode,
  AutoLinkNode,
} from '../../features/link/nodes/AutoLinkNode'

export {
  $createBlockNode,
  $isBlockNode,
  BlockNode,
} from '../../features/blocks/client/nodes/BlocksNode'

export {
  $createInlineBlockNode,
  $isInlineBlockNode,
  InlineBlockNode,
} from '../../features/blocks/client/nodes/InlineBlocksNode'

export {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from '../../features/horizontalRule/client/nodes/HorizontalRuleNode'

export { FieldsDrawer } from '../../utilities/fieldsDrawer/Drawer'
export { useLexicalDocumentDrawer } from '../../utilities/fieldsDrawer/useLexicalDocumentDrawer'
export { useLexicalDrawer } from '../../utilities/fieldsDrawer/useLexicalDrawer'
export { useLexicalListDrawer } from '../../utilities/fieldsDrawer/useLexicalListDrawer'

export { InlineBlockEditButton } from '../../features/blocks/client/componentInline/components/InlineBlockEditButton'
export { InlineBlockRemoveButton } from '../../features/blocks/client/componentInline/components/InlineBlockRemoveButton'
export { InlineBlockLabel } from '../../features/blocks/client/componentInline/components/InlineBlockLabel'
export { InlineBlockContainer } from '../../features/blocks/client/componentInline/components/InlineBlockContainer'
export { useInlineBlockComponentContext } from '../../features/blocks/client/componentInline/index'
export { BlockCollapsible } from '../../features/blocks/client/component/components/BlockCollapsible'
export { BlockEditButton } from '../../features/blocks/client/component/components/BlockEditButton'
export { BlockRemoveButton } from '../../features/blocks/client/component/components/BlockRemoveButton'
export { useBlockComponentContext } from '../../features/blocks/client/component/BlockContent'
export { getRestPopulateFn } from '../../features/converters/utilities/restPopulateFn'
export { codeConverterClient } from '../../features/blocks/premade/CodeBlock/converterClient'
export { CodeComponent } from '../../features/blocks/premade/CodeBlock/Component/Code'
export { CodeBlockBlockComponent } from '../../features/blocks/premade/CodeBlock/Component/Block'

export { RenderLexical } from '../../field/RenderLexical/index'
export { buildDefaultEditorState, buildEditorState } from '../../utilities/buildEditorState'
