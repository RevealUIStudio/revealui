'use client'

/**
 * RevealUI Rich Text Editor - Toolbar Plugin
 *
 * A comprehensive toolbar with formatting commands for the Lexical editor.
 */

import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  type HeadingTagType,
} from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $findMatchingParent, $getNearestNodeOfType, mergeRegister } from '@lexical/utils'

import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
} from 'lexical'
import { useCallback, useEffect, useState } from 'react'
import type { RichTextFeature } from '../../../core/richtext-lexical.js'
import { ImageUploadButton } from '../components/ImageUploadButton.js'

// ============================================
// TYPES
// ============================================

type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'quote'
  | 'bullet'
  | 'number'
  | 'check'

interface ToolbarState {
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
  isStrikethrough: boolean
  isCode: boolean
  isSubscript: boolean
  isSuperscript: boolean
  isLink: boolean
  blockType: BlockType
  canUndo: boolean
  canRedo: boolean
}

// ============================================
// TOOLBAR PLUGIN COMPONENT
// ============================================

export interface ToolbarPluginProps {
  features: RichTextFeature[]
  variant?: 'fixed' | 'inline' | 'floating'
}

export function ToolbarPlugin({ features, variant = 'fixed' }: ToolbarPluginProps) {
  const [editor] = useLexicalComposerContext()

  const [state, setState] = useState<ToolbarState>({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    isCode: false,
    isSubscript: false,
    isSuperscript: false,
    isLink: false,
    blockType: 'paragraph',
    canUndo: false,
    canRedo: false,
  })

  // Update toolbar state based on selection
  const updateToolbar = useCallback(() => {
    const selection = $getSelection()

    if ($isRangeSelection(selection)) {
      // Text formatting
      setState((prev) => ({
        ...prev,
        isBold: selection.hasFormat('bold'),
        isItalic: selection.hasFormat('italic'),
        isUnderline: selection.hasFormat('underline'),
        isStrikethrough: selection.hasFormat('strikethrough'),
        isCode: selection.hasFormat('code'),
        isSubscript: selection.hasFormat('subscript'),
        isSuperscript: selection.hasFormat('superscript'),
      }))

      // Block type
      const anchorNode = selection.anchor.getNode()
      let element =
        anchorNode.getKey() === 'root'
          ? anchorNode
          : $findMatchingParent(anchorNode, (e) => {
              const parent = e.getParent()
              return parent !== null && $isRootOrShadowRoot(parent)
            })

      if (element === null) {
        element = anchorNode.getTopLevelElementOrThrow()
      }

      const elementKey = element.getKey()
      const elementDOM = editor.getElementByKey(elementKey)

      if (elementDOM !== null) {
        // Check list type
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode)
          const type = parentList ? parentList.getListType() : (element as ListNode).getListType()

          setState((prev) => ({
            ...prev,
            blockType: type === 'bullet' ? 'bullet' : type === 'number' ? 'number' : 'check',
          }))
        } else {
          // Check heading type
          const type = $isHeadingNode(element) ? element.getTag() : element.getType()

          if (type === 'paragraph' || type === 'root') {
            setState((prev) => ({ ...prev, blockType: 'paragraph' }))
          } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(type)) {
            setState((prev) => ({ ...prev, blockType: type as BlockType }))
          } else if (type === 'quote') {
            setState((prev) => ({ ...prev, blockType: 'quote' }))
          }
        }
      }

      // Link state
      const node = selection.anchor.getNode()
      const parent = node.getParent()
      setState((prev) => ({
        ...prev,
        isLink: $isLinkNode(parent) || $isLinkNode(node),
      }))
    }
  }, [editor])

  // Register listeners
  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar()
        })
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar()
          return false
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setState((prev) => ({ ...prev, canUndo: payload }))
          return false
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setState((prev) => ({ ...prev, canRedo: payload }))
          return false
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    )
  }, [editor, updateToolbar])

  // Format commands
  const formatBold = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')
  const formatItalic = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')
  const formatUnderline = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')
  const formatStrikethrough = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')
  const formatCode = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')
  const formatSubscript = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript')
  const formatSuperscript = () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript')

  const undo = () => editor.dispatchCommand(UNDO_COMMAND, undefined)
  const redo = () => editor.dispatchCommand(REDO_COMMAND, undefined)

  // Block type commands
  const formatParagraph = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode())
      }
    })
  }

  const formatHeading = (tag: HeadingTagType) => {
    if (state.blockType !== tag) {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(tag))
        }
      })
    }
  }

  const formatQuote = () => {
    if (state.blockType !== 'quote') {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode())
        }
      })
    }
  }

  const formatBulletList = () => {
    if (state.blockType !== 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    }
  }

  const formatNumberedList = () => {
    if (state.blockType !== 'number') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    }
  }

  const insertLink = () => {
    if (!state.isLink) {
      const url = prompt('Enter URL:')
      if (url) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
      }
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
    }
  }

  // Check which features are enabled
  const hasFeature = (key: string) => features.some((f) => f.key === key)

  // Check if fixed toolbar should be shown (don't show for floating/inline)
  const showToolbar = features.some((f) => {
    // Check by feature key first (more reliable)
    if (variant === 'fixed') {
      return f.key === 'fixedToolbar' || f.key === 'fixed-toolbar'
    }
    // For inline/floating variants, check toolbar type (but skip fixed toolbar)
    if (variant === 'inline' || variant === 'floating') {
      if (f.type === 'toolbar' || (f as any).type === 'toolbar') {
        return (f as any).position === variant || !(f as any).position
      }
    }
    return false
  })

  if (!showToolbar) return null

  return (
    <div className={`editor-toolbar editor-toolbar--${variant}`}>
      {/* History */}
      {hasFeature('history') && (
        <div className="toolbar-group">
          <button
            type="button"
            disabled={!state.canUndo}
            onClick={undo}
            className="toolbar-btn"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            ↶
          </button>
          <button
            type="button"
            disabled={!state.canRedo}
            onClick={redo}
            className="toolbar-btn"
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            ↷
          </button>
        </div>
      )}

      {/* Block formatting */}
      {hasFeature('heading') && (
        <div className="toolbar-group">
          <select
            className="toolbar-select"
            value={state.blockType}
            onChange={(e) => {
              const value = e.target.value as BlockType
              if (value === 'paragraph') formatParagraph()
              else if (value.startsWith('h')) formatHeading(value as HeadingTagType)
              else if (value === 'quote') formatQuote()
            }}
          >
            <option value="paragraph">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
          </select>
        </div>
      )}

      {/* Text formatting */}
      <div className="toolbar-group">
        {hasFeature('bold') && (
          <button
            type="button"
            onClick={formatBold}
            className={`toolbar-btn ${state.isBold ? 'active' : ''}`}
            title="Bold (Ctrl+B)"
            aria-label="Bold"
            aria-pressed={state.isBold}
          >
            <strong>B</strong>
          </button>
        )}
        {hasFeature('italic') && (
          <button
            type="button"
            onClick={formatItalic}
            className={`toolbar-btn ${state.isItalic ? 'active' : ''}`}
            title="Italic (Ctrl+I)"
            aria-label="Italic"
            aria-pressed={state.isItalic}
          >
            <em>I</em>
          </button>
        )}
        {hasFeature('underline') && (
          <button
            type="button"
            onClick={formatUnderline}
            className={`toolbar-btn ${state.isUnderline ? 'active' : ''}`}
            title="Underline (Ctrl+U)"
            aria-label="Underline"
            aria-pressed={state.isUnderline}
          >
            <span style={{ textDecoration: 'underline' }}>U</span>
          </button>
        )}
        {hasFeature('strikethrough') && (
          <button
            type="button"
            onClick={formatStrikethrough}
            className={`toolbar-btn ${state.isStrikethrough ? 'active' : ''}`}
            title="Strikethrough"
            aria-label="Strikethrough"
            aria-pressed={state.isStrikethrough}
          >
            <span style={{ textDecoration: 'line-through' }}>S</span>
          </button>
        )}
        {hasFeature('code') && (
          <button
            type="button"
            onClick={formatCode}
            className={`toolbar-btn ${state.isCode ? 'active' : ''}`}
            title="Inline Code"
            aria-label="Inline Code"
            aria-pressed={state.isCode}
          >
            {'</>'}
          </button>
        )}
        {hasFeature('subscript') && (
          <button
            type="button"
            onClick={formatSubscript}
            className={`toolbar-btn ${state.isSubscript ? 'active' : ''}`}
            title="Subscript"
            aria-label="Subscript"
            aria-pressed={state.isSubscript}
          >
            X<sub>2</sub>
          </button>
        )}
        {hasFeature('superscript') && (
          <button
            type="button"
            onClick={formatSuperscript}
            className={`toolbar-btn ${state.isSuperscript ? 'active' : ''}`}
            title="Superscript"
            aria-label="Superscript"
            aria-pressed={state.isSuperscript}
          >
            X<sup>2</sup>
          </button>
        )}
      </div>

      {/* List formatting */}
      {(hasFeature('list') || hasFeature('orderedList') || hasFeature('unorderedList')) && (
        <div className="toolbar-group">
          <button
            type="button"
            onClick={formatBulletList}
            className={`toolbar-btn ${state.blockType === 'bullet' ? 'active' : ''}`}
            title="Bullet List"
            aria-label="Bullet List"
          >
            •
          </button>
          <button
            type="button"
            onClick={formatNumberedList}
            className={`toolbar-btn ${state.blockType === 'number' ? 'active' : ''}`}
            title="Numbered List"
            aria-label="Numbered List"
          >
            1.
          </button>
        </div>
      )}

      {/* Link */}
      {hasFeature('link') && (
        <div className="toolbar-group">
          <button
            type="button"
            onClick={insertLink}
            className={`toolbar-btn ${state.isLink ? 'active' : ''}`}
            title="Insert Link"
            aria-label="Insert Link"
            aria-pressed={state.isLink}
          >
            🔗
          </button>
        </div>
      )}

      {/* Quote */}
      {hasFeature('quote') && (
        <div className="toolbar-group">
          <button
            type="button"
            onClick={formatQuote}
            className={`toolbar-btn ${state.blockType === 'quote' ? 'active' : ''}`}
            title="Block Quote"
            aria-label="Block Quote"
          >
            "
          </button>
        </div>
      )}

      {/* Image Upload */}
      {hasFeature('upload') && (
        <div className="toolbar-group">
          <ImageUploadButton />
        </div>
      )}
    </div>
  )
}

export default ToolbarPlugin
