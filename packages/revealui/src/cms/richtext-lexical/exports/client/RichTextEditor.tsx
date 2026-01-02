'use client'

/**
 * RevealUI Rich Text Editor
 * 
 * A production-ready Lexical-based rich text editor component.
 * Supports configurable features, onChange callbacks, and initial state.
 */

import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListNode, ListItemNode } from '@lexical/list'
import { LinkNode, AutoLinkNode } from '@lexical/link'
import { CodeNode, CodeHighlightNode } from '@lexical/code'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table'

import type { EditorState, LexicalEditor, SerializedEditorState } from 'lexical'
import type { RichTextFeature, RichTextEditor as RichTextEditorConfig } from '../../index'
import React, { useCallback, useMemo } from 'react'

// ============================================
// TYPES
// ============================================

export interface RichTextEditorProps {
  /** Editor configuration from lexicalEditor() */
  editorConfig?: RichTextEditorConfig
  /** Initial content (JSON serialized state) */
  initialValue?: SerializedEditorState | string | null
  /** Callback when content changes */
  onChange?: (state: EditorState, editor: LexicalEditor) => void
  /** Callback with serialized JSON on change */
  onSerializedChange?: (json: SerializedEditorState) => void
  /** Placeholder text */
  placeholder?: string
  /** Additional CSS class */
  className?: string
  /** Whether editor is editable */
  editable?: boolean
  /** Auto-focus on mount */
  autoFocus?: boolean
  /** Custom error handler */
  onError?: (error: Error, editor: LexicalEditor) => void
  /** Editor namespace (unique identifier) */
  namespace?: string
}

// ============================================
// THEME
// ============================================

const defaultTheme = {
  paragraph: 'editor-paragraph',
  quote: 'editor-quote',
  heading: {
    h1: 'editor-heading-h1',
    h2: 'editor-heading-h2',
    h3: 'editor-heading-h3',
    h4: 'editor-heading-h4',
    h5: 'editor-heading-h5',
    h6: 'editor-heading-h6',
  },
  list: {
    nested: {
      listitem: 'editor-nested-listitem',
    },
    ol: 'editor-list-ol',
    ul: 'editor-list-ul',
    listitem: 'editor-listitem',
    listitemChecked: 'editor-listitem-checked',
    listitemUnchecked: 'editor-listitem-unchecked',
  },
  link: 'editor-link',
  text: {
    bold: 'editor-text-bold',
    italic: 'editor-text-italic',
    underline: 'editor-text-underline',
    strikethrough: 'editor-text-strikethrough',
    code: 'editor-text-code',
    subscript: 'editor-text-subscript',
    superscript: 'editor-text-superscript',
  },
  code: 'editor-code',
  codeHighlight: {
    atrule: 'editor-tokenAttr',
    attr: 'editor-tokenAttr',
    boolean: 'editor-tokenProperty',
    builtin: 'editor-tokenSelector',
    cdata: 'editor-tokenComment',
    char: 'editor-tokenSelector',
    class: 'editor-tokenFunction',
    'class-name': 'editor-tokenFunction',
    comment: 'editor-tokenComment',
    constant: 'editor-tokenProperty',
    deleted: 'editor-tokenProperty',
    doctype: 'editor-tokenComment',
    entity: 'editor-tokenOperator',
    function: 'editor-tokenFunction',
    important: 'editor-tokenVariable',
    inserted: 'editor-tokenSelector',
    keyword: 'editor-tokenAttr',
    namespace: 'editor-tokenVariable',
    number: 'editor-tokenProperty',
    operator: 'editor-tokenOperator',
    prolog: 'editor-tokenComment',
    property: 'editor-tokenProperty',
    punctuation: 'editor-tokenPunctuation',
    regex: 'editor-tokenVariable',
    selector: 'editor-tokenSelector',
    string: 'editor-tokenSelector',
    symbol: 'editor-tokenProperty',
    tag: 'editor-tokenProperty',
    url: 'editor-tokenOperator',
    variable: 'editor-tokenVariable',
  },
}

// ============================================
// NODES CONFIGURATION
// ============================================

function getNodesFromFeatures(features: RichTextFeature[]): Array<any> {
  const nodeSet = new Set<any>()
  
  // Always include base nodes
  nodeSet.add(HeadingNode)
  nodeSet.add(QuoteNode)
  
  features.forEach(feature => {
    switch (feature.key) {
      case 'heading':
        nodeSet.add(HeadingNode)
        break
      case 'quote':
        nodeSet.add(QuoteNode)
        break
      case 'list':
      case 'orderedList':
      case 'unorderedList':
      case 'checklist':
        nodeSet.add(ListNode)
        nodeSet.add(ListItemNode)
        break
      case 'link':
        nodeSet.add(LinkNode)
        nodeSet.add(AutoLinkNode)
        break
      case 'code':
      case 'codeBlock':
        nodeSet.add(CodeNode)
        nodeSet.add(CodeHighlightNode)
        break
      case 'horizontalRule':
        nodeSet.add(HorizontalRuleNode)
        break
      case 'table':
        nodeSet.add(TableNode)
        nodeSet.add(TableCellNode)
        nodeSet.add(TableRowNode)
        break
    }
  })
  
  return Array.from(nodeSet)
}

// ============================================
// PLACEHOLDER COMPONENT
// ============================================

function Placeholder({ text }: { text: string }) {
  return (
    <div className="editor-placeholder">
      {text}
    </div>
  )
}

// ============================================
// TOOLBAR COMPONENT
// ============================================

// Import the full-featured toolbar plugin
import { ToolbarPlugin } from './plugins/ToolbarPlugin'
export { ToolbarPlugin }

// ============================================
// FEATURE PLUGINS COMPONENT
// ============================================

function FeaturePlugins({ features }: { features: RichTextFeature[] }) {
  const hasFeature = (key: string) => features.some(f => f.key === key)
  
  return (
    <>
      {(hasFeature('list') || hasFeature('orderedList') || hasFeature('unorderedList')) && (
        <ListPlugin />
      )}
      {hasFeature('checklist') && <CheckListPlugin />}
      {hasFeature('link') && <LinkPlugin />}
    </>
  )
}

// ============================================
// MAIN EDITOR COMPONENT
// ============================================

export function RichTextEditor({
  editorConfig,
  initialValue,
  onChange,
  onSerializedChange,
  placeholder = 'Start typing...',
  className = '',
  editable = true,
  autoFocus = false,
  onError,
  namespace = 'RevealUIEditor',
}: RichTextEditorProps) {
  
  const features = editorConfig?.features ?? []
  
  // Build initial editor state from value
  const initialEditorState = useMemo(() => {
    if (!initialValue) return undefined
    
    if (typeof initialValue === 'string') {
      try {
        return initialValue
      } catch {
        return undefined
      }
    }
    
    // SerializedEditorState - convert to string
    return JSON.stringify(initialValue)
  }, [initialValue])
  
  // Error handler
  const handleError = useCallback((error: Error, editor: LexicalEditor) => {
    console.error('[RichTextEditor Error]:', error)
    onError?.(error, editor)
  }, [onError])
  
  // Change handler
  const handleChange = useCallback((state: EditorState, editor: LexicalEditor) => {
    onChange?.(state, editor)
    
    if (onSerializedChange) {
      const json = state.toJSON()
      onSerializedChange(json)
    }
  }, [onChange, onSerializedChange])
  
  // Build nodes from features
  const nodes = useMemo(() => getNodesFromFeatures(features), [features])
  
  // Lexical config
  const initialConfig = useMemo(() => ({
    namespace,
    theme: defaultTheme,
    nodes,
    editable,
    editorState: initialEditorState,
    onError: handleError,
  }), [namespace, nodes, editable, initialEditorState, handleError])
  
  return (
    <div className={`revealui-rich-text-editor ${className}`}>
      <LexicalComposer initialConfig={initialConfig}>
        <ToolbarPlugin features={features} />
        <div className="editor-container">
          <RichTextPlugin
            contentEditable={
              <ContentEditable 
                className="editor-input"
                aria-placeholder={placeholder}
                placeholder={<Placeholder text={placeholder} />}
              />
            }
            placeholder={null}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <OnChangePlugin onChange={handleChange} />
          <FeaturePlugins features={features} />
          {autoFocus && <AutoFocusPlugin />}
        </div>
      </LexicalComposer>
    </div>
  )
}

// ============================================
// STYLES (CSS-in-JS for standalone usage)
// ============================================

export const richTextEditorStyles = `
.revealui-rich-text-editor {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
}

.editor-toolbar {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.toolbar-btn {
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s ease;
}

.toolbar-btn:hover {
  background: #f1f5f9;
}

.toolbar-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.editor-container {
  position: relative;
  min-height: 150px;
}

.editor-input {
  padding: 16px;
  outline: none;
  min-height: 150px;
}

.editor-placeholder {
  position: absolute;
  top: 16px;
  left: 16px;
  color: #94a3b8;
  pointer-events: none;
  user-select: none;
}

.editor-paragraph {
  margin: 0 0 8px 0;
}

.editor-heading-h1 { font-size: 2em; font-weight: bold; margin: 0 0 12px 0; }
.editor-heading-h2 { font-size: 1.5em; font-weight: bold; margin: 0 0 10px 0; }
.editor-heading-h3 { font-size: 1.25em; font-weight: bold; margin: 0 0 8px 0; }
.editor-heading-h4 { font-size: 1em; font-weight: bold; margin: 0 0 8px 0; }
.editor-heading-h5 { font-size: 0.875em; font-weight: bold; margin: 0 0 8px 0; }
.editor-heading-h6 { font-size: 0.75em; font-weight: bold; margin: 0 0 8px 0; }

.editor-quote {
  border-left: 4px solid #e2e8f0;
  padding-left: 16px;
  margin: 0 0 8px 0;
  color: #64748b;
}

.editor-list-ol { list-style: decimal; padding-left: 24px; margin: 0 0 8px 0; }
.editor-list-ul { list-style: disc; padding-left: 24px; margin: 0 0 8px 0; }
.editor-listitem { margin: 4px 0; }

.editor-link { color: #3b82f6; text-decoration: underline; }

.editor-text-bold { font-weight: bold; }
.editor-text-italic { font-style: italic; }
.editor-text-underline { text-decoration: underline; }
.editor-text-strikethrough { text-decoration: line-through; }
.editor-text-code {
  background: #f1f5f9;
  padding: 2px 4px;
  border-radius: 4px;
  font-family: monospace;
}
.editor-text-subscript { vertical-align: sub; font-size: smaller; }
.editor-text-superscript { vertical-align: super; font-size: smaller; }

.editor-code {
  background: #1e293b;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 4px;
  font-family: monospace;
  overflow-x: auto;
  margin: 8px 0;
}
`

export default RichTextEditor
