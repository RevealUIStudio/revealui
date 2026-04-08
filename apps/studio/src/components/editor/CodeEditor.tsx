/**
 * CodeEditor — CodeMirror 6 editor panel
 *
 * Full-screen code editor with syntax highlighting (JS/TS/Rust/Python/HTML/CSS/JSON/MD),
 * Ctrl+S save, and unsaved-change indicator. Reads/writes files via Tauri IPC.
 */

const SAVE_SUCCESS_FEEDBACK_MS = 1_500;
const SAVE_ERROR_FEEDBACK_MS = 3_000;

import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import type { Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { useCallback, useEffect, useRef, useState } from 'react';
import { gitReadFile, gitWriteFile } from '../../lib/invoke';

interface Props {
  repoPath: string;
  filePath: string;
  onClose?: () => void;
}

// ── Language detection ────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────

export default function CodeEditor({ repoPath, filePath, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  const save = useCallback(async () => {
    if (!viewRef.current) return;
    const content = viewRef.current.state.doc.toString();
    setSaveStatus('saving');
    try {
      await gitWriteFile(repoPath, filePath, content);
      setIsDirty(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), SAVE_SUCCESS_FEEDBACK_MS);
    } catch (_err) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), SAVE_ERROR_FEEDBACK_MS);
    }
  }, [repoPath, filePath]);

  // Mount CodeMirror once
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally omit `save` — re-mounting resets undo history
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    gitReadFile(repoPath, filePath)
      .then((content) => {
        if (cancelled || !containerRef.current) return;

        const saveKeymap = keymap.of([
          {
            key: 'Mod-s',
            run: () => {
              void save();
              return true;
            },
          },
        ]);

        const updateListener = EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setIsDirty(true);
            setSaveStatus('idle');
          }
        });

        const view = new EditorView({
          doc: content,
          extensions: [
            basicSetup,
            oneDark,
            languageExtension(filePath),
            saveKeymap,
            updateListener,
            EditorView.theme({
              '&': { height: '100%', fontSize: '13px' },
              '.cm-scroller': { fontFamily: 'ui-monospace, "Cascadia Code", Menlo, monospace' },
            }),
          ],
          parent: containerRef.current,
        });

        viewRef.current = view;
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally omit `save` — re-mounting would reset undo history
  }, [repoPath, filePath]);

  const fileName = filePath.split('/').pop() ?? filePath;
  const dirPath = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
            title="Close editor"
          >
            <svg
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Breadcrumb */}
        <div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
          {dirPath && (
            <>
              <span className="truncate text-neutral-500">{dirPath}</span>
              <span className="text-neutral-600">/</span>
            </>
          )}
          <span className="font-medium text-neutral-200">{fileName}</span>
          {isDirty && (
            <span
              className="ml-1 size-2 shrink-0 rounded-full bg-orange-400"
              title="Unsaved changes"
            />
          )}
        </div>

        {/* Save status */}
        {saveStatus === 'saving' && <span className="text-xs text-neutral-500">Saving…</span>}
        {saveStatus === 'saved' && <span className="text-xs text-emerald-400">Saved</span>}
        {saveStatus === 'error' && <span className="text-xs text-red-400">Save failed</span>}

        <button
          type="button"
          onClick={() => void save()}
          disabled={!isDirty || saveStatus === 'saving'}
          className="rounded bg-neutral-800 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          title="Save (Ctrl+S)"
        >
          Save
        </button>
      </div>

      {/* Editor or error */}
      {loadError ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-md rounded-lg border border-red-800/50 bg-red-900/10 p-4 text-sm text-red-400">
            <p className="font-medium">Cannot open file</p>
            <p className="mt-1 text-xs text-red-500">{loadError}</p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden" />
      )}
    </div>
  );
}
