'use client';

/**
 * RevealUI Rich Text Editor
 *
 * A Lexical-based rich text editor component.
 * Supports configurable features, onChange callbacks, and initial state.
 */

import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import type { Provider } from '@lexical/yjs';
import { logger } from '@revealui/core/utils/logger';
import type {
  EditorState,
  Klass,
  LexicalEditor,
  LexicalNode,
  SerializedEditorState,
} from 'lexical';
import { useCallback, useMemo } from 'react';
import type { Doc } from 'yjs';
import type {
  RichTextEditor as RichTextEditorConfig,
  RichTextFeature,
} from '../../richtext/index.js';
// Image node for upload feature (imported conditionally)
import { ImageNode } from './nodes/ImageNode.js';
import { CollaborationPlugin } from './plugins/CollaborationPlugin.js';
import { ImagePlugin } from './plugins/ImagePlugin.js';
import { PastePlugin } from './plugins/PastePlugin.js';

// ============================================
// TYPES
// ============================================

export interface RichTextEditorProps {
  /** Editor configuration from lexicalEditor() */
  editorConfig?: RichTextEditorConfig;
  /** Initial content (JSON serialized state) */
  initialValue?: SerializedEditorState | string | null;
  /** Callback when content changes */
  onChange?: (state: EditorState, editor: LexicalEditor) => void;
  /** Callback with serialized JSON on change */
  onSerializedChange?: (json: SerializedEditorState) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS class */
  className?: string;
  /** Whether editor is editable */
  editable?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Custom error handler */
  onError?: (error: Error, editor: LexicalEditor) => void;
  /** Editor namespace (unique identifier) */
  namespace?: string;
  /** Enable collaborative editing mode */
  collaborative?: boolean;
  /** Document ID for collaboration */
  documentId?: string;
  /** Provider factory for Yjs collaboration */
  providerFactory?: (id: string, yjsDocMap: Map<string, Doc>) => Provider;
  /** Whether to bootstrap initial state (only for first user) */
  shouldBootstrap?: boolean;
  /** Username for cursor display */
  username?: string;
  /** Cursor color for this user */
  cursorColor?: string;
  /** Client type for collaborative cursor display */
  clientType?: 'human' | 'agent';
  /** Agent model identifier for cursor labeling */
  agentModel?: string;
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
};

// ============================================
// NODES CONFIGURATION
// ============================================

function getNodesFromFeatures(features: RichTextFeature[]): Array<Klass<LexicalNode>> {
  const nodeSet = new Set<Klass<LexicalNode>>();

  // Always include base nodes
  nodeSet.add(HeadingNode);
  nodeSet.add(QuoteNode);

  // Check if upload feature is enabled (for ImageNode)
  const hasUpload = features.some((f) => f.key === 'upload');
  if (hasUpload) {
    nodeSet.add(ImageNode);
  }

  features.forEach((feature) => {
    switch (feature.key) {
      case 'heading':
        nodeSet.add(HeadingNode);
        break;
      case 'quote':
        nodeSet.add(QuoteNode);
        break;
      case 'list':
      case 'orderedList':
      case 'unorderedList':
      case 'checklist':
        nodeSet.add(ListNode);
        nodeSet.add(ListItemNode);
        break;
      case 'link':
        nodeSet.add(LinkNode);
        nodeSet.add(AutoLinkNode);
        break;
      case 'code':
      case 'codeBlock':
        nodeSet.add(CodeNode);
        nodeSet.add(CodeHighlightNode);
        break;
      case 'horizontalRule':
        nodeSet.add(HorizontalRuleNode);
        break;
      case 'table':
        nodeSet.add(TableNode);
        nodeSet.add(TableCellNode);
        nodeSet.add(TableRowNode);
        break;
    }
  });

  return Array.from(nodeSet);
}

// ============================================
// PLACEHOLDER COMPONENT
// ============================================

function Placeholder({ text }: { text: string }) {
  return <div className="editor-placeholder">{text}</div>;
}

// ============================================
// TOOLBAR COMPONENT
// ============================================

import { FloatingToolbarPlugin } from './plugins/FloatingToolbarPlugin.js';
// Import the full-featured toolbar plugin
import { ToolbarPlugin } from './plugins/ToolbarPlugin.js';

export { FloatingToolbarPlugin } from './plugins/FloatingToolbarPlugin.js';
export { ToolbarPlugin } from './plugins/ToolbarPlugin.js';

// ============================================
// FEATURE PLUGINS COMPONENT
// ============================================

function FeaturePlugins({ features }: { features: RichTextFeature[] }) {
  const hasFeature = (key: string) => features.some((f) => f.key === key);

  return (
    <>
      {(hasFeature('list') || hasFeature('orderedList') || hasFeature('unorderedList')) && (
        <ListPlugin />
      )}
      {hasFeature('checklist') && <CheckListPlugin />}
      {hasFeature('link') && <LinkPlugin />}
      {hasFeature('upload') && <ImagePlugin />}
      {hasFeature('table') && <TablePlugin />}
      <PastePlugin />
    </>
  );
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
  collaborative = false,
  documentId,
  providerFactory,
  shouldBootstrap = false,
  username,
  cursorColor,
  clientType,
  agentModel,
}: RichTextEditorProps) {
  const features = editorConfig?.features ?? [];

  // Build initial editor state from value
  const initialEditorState = useMemo(() => {
    if (!initialValue) return undefined;

    if (typeof initialValue === 'string') {
      try {
        return initialValue;
      } catch {
        return undefined;
      }
    }

    // SerializedEditorState - convert to string
    return JSON.stringify(initialValue);
  }, [initialValue]);

  // Error handler
  const handleError = useCallback(
    (error: Error, editor: LexicalEditor) => {
      logger.error('RichTextEditor error', { error });
      onError?.(error, editor);
    },
    [onError],
  );

  // Change handler
  const handleChange = useCallback(
    (state: EditorState, editor: LexicalEditor) => {
      onChange?.(state, editor);

      if (onSerializedChange) {
        const json = state.toJSON();
        onSerializedChange(json);
      }
    },
    [onChange, onSerializedChange],
  );

  // Build nodes from features
  const nodes = useMemo(() => getNodesFromFeatures(features), [features]);

  // Lexical config
  const initialConfig = useMemo(
    () => ({
      namespace,
      theme: defaultTheme,
      nodes,
      editable,
      editorState: collaborative ? null : initialEditorState,
      onError: handleError,
    }),
    [namespace, nodes, editable, collaborative, initialEditorState, handleError],
  );

  // Determine toolbar variant from features
  const hasFloatingToolbar = features.some(
    (f: RichTextFeature) =>
      (f.type === 'toolbar' && f.position === 'floating') ||
      f.key === 'floatingToolbar' ||
      f.key === 'floating-toolbar',
  );
  const hasFixedToolbar = features.some(
    (f: RichTextFeature) =>
      (f.type === 'toolbar' && f.position === 'fixed') ||
      f.key === 'fixedToolbar' ||
      f.key === 'fixed-toolbar' ||
      (!f.position && f.type === 'toolbar'),
  );

  return (
    <div className={`revealui-rich-text-editor ${className}`}>
      <LexicalComposer initialConfig={initialConfig}>
        {hasFixedToolbar && <ToolbarPlugin features={features} variant="fixed" />}
        {hasFloatingToolbar && <FloatingToolbarPlugin features={features} />}
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
          {collaborative && documentId && providerFactory ? (
            <CollaborationPlugin
              id={documentId}
              providerFactory={providerFactory}
              shouldBootstrap={shouldBootstrap}
              username={username}
              cursorColor={cursorColor}
              clientType={clientType}
              agentModel={agentModel}
            />
          ) : (
            <>
              <HistoryPlugin />
              <OnChangePlugin onChange={handleChange} />
            </>
          )}
          <FeaturePlugins features={features} />
          {autoFocus && <AutoFocusPlugin />}
        </div>
      </LexicalComposer>
    </div>
  );
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

.editor-toolbar--floating {
  border-bottom: none;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  background: white;
  padding: 6px;
  transition: opacity 0.2s ease;
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

.collab-cursors-container {
  position: relative;
  pointer-events: none;
}

.cursor-agent {
  animation: cursor-agent-pulse 2s ease-in-out infinite;
}

@keyframes cursor-agent-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.cursor-inactive {
  opacity: 0.2;
  transition: opacity 1s ease-out;
}
`;

export default RichTextEditor;
