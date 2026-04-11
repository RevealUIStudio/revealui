/**
 * DiffView  -  CodeMirror 6 MergeView side-by-side diff panel
 *
 * Renders the original (left) and modified (right) versions of a file using
 * @codemirror/merge, with syntax highlighting, changed-chunk gutter markers,
 * and collapsing of unchanged regions.
 *
 * Both editors are read-only  -  this component is for reviewing, not editing.
 * For editing, navigate to the Editor panel.
 */

import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { MergeView } from '@codemirror/merge';
import type { Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { useEffect, useRef } from 'react';

// ── Language detection ────────────────────────────────────────────────────────

function languageExtension(filePath: string): Extension {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'ts':
      return javascript({ typescript: true });
    case 'tsx':
      return javascript({ typescript: true, jsx: true });
    case 'js':
      return javascript();
    case 'jsx':
      return javascript({ jsx: true });
    case 'rs':
      return rust();
    case 'py':
      return python();
    case 'html':
    case 'htm':
      return html();
    case 'css':
      return css();
    case 'json':
      return json();
    case 'md':
    case 'mdx':
      return markdown();
    default:
      return [];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DiffViewProps {
  original: string;
  modified: string;
  filePath: string;
}

export default function DiffView({ original, modified, filePath }: DiffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MergeView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const lang = languageExtension(filePath);
    const extensions: Extension = [
      oneDark,
      lang,
      EditorView.editable.of(false),
      EditorView.theme({
        '&': { height: '100%', fontSize: '13px' },
        '.cm-scroller': {
          fontFamily: 'ui-monospace, "Cascadia Code", Menlo, monospace',
          overflow: 'auto',
        },
      }),
    ];

    const view = new MergeView({
      a: { doc: original, extensions },
      b: { doc: modified, extensions },
      parent: containerRef.current,
      gutter: true,
      highlightChanges: true,
      collapseUnchanged: { margin: 3, minSize: 4 },
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [original, modified, filePath]);

  return <div ref={containerRef} className="h-full overflow-hidden" />;
}
