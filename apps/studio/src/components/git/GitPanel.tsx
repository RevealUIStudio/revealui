import { useCallback, useEffect, useRef, useState } from 'react';

const COMMIT_SUCCESS_FEEDBACK_MS = 3_000;
const REMOTE_SUCCESS_FEEDBACK_MS = 2_000;
const REMOTE_ERROR_FEEDBACK_MS = 4_000;

import {
  gitCommit,
  gitCreateBranch,
  gitDiffContent,
  gitDiscardFile,
  gitListBranches,
  gitLog,
  gitPull,
  gitPush,
  gitStageFile,
  gitStatus,
  gitSwitchBranch,
  gitUnstageFile,
} from '../../lib/invoke';
import type {
  GitBranch,
  GitCommitInfo,
  GitDiffContent,
  GitFileEntry,
  GitStatusResult,
} from '../../types';
import DiffView from './DiffView';

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    modified: { label: 'M', cls: 'bg-orange-600/20 text-orange-400' },
    new: { label: 'A', cls: 'bg-green-600/20 text-green-400' },
    deleted: { label: 'D', cls: 'bg-red-600/20 text-red-400' },
    renamed: { label: 'R', cls: 'bg-blue-600/20 text-blue-400' },
    untracked: { label: '?', cls: 'bg-neutral-600/20 text-neutral-400' },
    conflicted: { label: '!', cls: 'bg-red-600/30 text-red-300' },
  };
  const { label, cls } = map[status] ?? {
    label: status[0].toUpperCase(),
    cls: 'bg-neutral-700 text-neutral-300',
  };
  return (
    <span
      className={`inline-flex size-5 items-center justify-center rounded text-[10px] font-bold ${cls}`}
    >
      {label}
    </span>
  );
}

// ── File row ─────────────────────────────────────────────────────────────────

interface FileRowProps {
  entry: GitFileEntry;
  selected: boolean;
  onSelect: () => void;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
  onOpenEditor?: () => void;
}

function FileRow({
  entry,
  selected,
  onSelect,
  onStage,
  onUnstage,
  onDiscard,
  onOpenEditor,
}: FileRowProps) {
  const name = entry.path.split('/').pop() ?? entry.path;
  const dir = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : '';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${
        selected
          ? 'bg-neutral-700 text-neutral-100'
          : 'text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100'
      }`}
    >
      <StatusBadge status={entry.status} />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{name}</span>
        {dir && <span className="block truncate text-[10px] text-neutral-500">{dir}</span>}
      </div>
      <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
        {onOpenEditor && (
          <ActionBtn
            title="Open in editor"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEditor();
            }}
          >
            <PencilIcon />
          </ActionBtn>
        )}
        {onStage && (
          <ActionBtn
            title="Stage file"
            onClick={(e) => {
              e.stopPropagation();
              onStage();
            }}
          >
            <PlusIcon />
          </ActionBtn>
        )}
        {onUnstage && (
          <ActionBtn
            title="Unstage file"
            onClick={(e) => {
              e.stopPropagation();
              onUnstage();
            }}
          >
            <MinusIcon />
          </ActionBtn>
        )}
        {onDiscard && (
          <ActionBtn
            title="Discard changes"
            onClick={(e) => {
              e.stopPropagation();
              onDiscard();
            }}
            danger
          >
            <UndoIcon />
          </ActionBtn>
        )}
      </div>
    </button>
  );
}

function ActionBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex size-5 items-center justify-center rounded transition-colors ${
        danger
          ? 'text-neutral-500 hover:bg-red-900/40 hover:text-red-400'
          : 'text-neutral-500 hover:bg-neutral-600 hover:text-neutral-200'
      }`}
    >
      {children}
    </button>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title,
  count,
  children,
  accent,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  accent: string;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-3">
      <div
        className={`mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider ${accent}`}
      >
        <span>{title}</span>
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-400">{count}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

// ── Commit form ───────────────────────────────────────────────────────────────

interface CommitFormProps {
  stagedCount: number;
  onCommit: (msg: string) => Promise<void>;
}

function CommitForm({ stagedCount, onCommit }: CommitFormProps) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCommit = async () => {
    if (!msg.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      await onCommit(msg.trim());
      setMsg('');
      setOk('Committed!');
      setTimeout(() => setOk(null), COMMIT_SUCCESS_FEEDBACK_MS);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleCommit();
    }
  };

  return (
    <div className="border-t border-neutral-800 p-3">
      <textarea
        ref={textareaRef}
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          stagedCount > 0 ? 'Commit message (Ctrl+Enter to commit)' : 'Stage files to commit'
        }
        disabled={stagedCount === 0 || busy}
        rows={3}
        className="w-full resize-none rounded border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-40"
      />
      {err && <p className="mt-1 text-[10px] text-red-400">{err}</p>}
      {ok && <p className="mt-1 text-[10px] text-green-400">{ok}</p>}
      <button
        type="button"
        onClick={() => {
          void handleCommit();
        }}
        disabled={!msg.trim() || stagedCount === 0 || busy}
        className="mt-2 w-full rounded bg-orange-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy
          ? 'Committing…'
          : `Commit${stagedCount > 0 ? ` ${stagedCount} file${stagedCount !== 1 ? 's' : ''}` : ''}`}
      </button>
    </div>
  );
}

// ── Commit log ─────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function CommitLog({ entries, loading }: { entries: GitCommitInfo[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-500">
        Loading log…
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-600">
        No commits
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto">
      {entries.map((entry) => (
        <div
          key={entry.sha}
          className="border-b border-neutral-800/60 px-3 py-2 hover:bg-neutral-900/40"
        >
          <div className="flex items-start gap-2">
            <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
              {entry.short_sha}
            </span>
            <span className="min-w-0 flex-1 text-xs leading-snug text-neutral-300">
              {entry.message}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 pl-8 text-[10px] text-neutral-500">
            <span>{entry.author}</span>
            <span>·</span>
            <span>{relativeTime(entry.timestamp)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── New branch input ──────────────────────────────────────────────────────────

function NewBranchInput({
  onCreate,
  creating,
}: {
  onCreate: (name: string) => void;
  creating: boolean;
}) {
  const [name, setName] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    onCreate(trimmed);
    setName('');
  };

  return (
    <div className="border-t border-neutral-700/60 px-2 py-1.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-1"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New branch name…"
          disabled={creating}
          className="min-w-0 flex-1 rounded border border-neutral-600 bg-neutral-900 px-2 py-1 text-[11px] text-neutral-200 placeholder-neutral-600 focus:border-neutral-400 focus:outline-none disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!name.trim() || creating}
          className="rounded bg-neutral-700 px-2 py-1 text-[11px] text-neutral-200 hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          {creating ? '…' : 'Create'}
        </button>
      </form>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface DiffSelection {
  filePath: string;
  staged: boolean;
}

type RemoteStatus = 'idle' | 'loading' | 'ok' | 'error';

interface GitPanelProps {
  onOpenEditor?: (repoPath: string, filePath: string) => void;
}

export default function GitPanel({ onOpenEditor }: GitPanelProps) {
  const [repoPath, setRepoPath] = useState(() => {
    return (
      (typeof localStorage !== 'undefined' && localStorage.getItem('git-repo-path')) ||
      '~/projects/RevealUI'
    );
  });
  const [editingPath, setEditingPath] = useState(false);
  const [draftPath, setDraftPath] = useState(repoPath);
  const pathInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [selected, setSelected] = useState<DiffSelection | null>(null);
  const [diffContent, setDiffContent] = useState<GitDiffContent | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Branch state
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  // Push/pull state
  const [pushStatus, setPushStatus] = useState<RemoteStatus>('idle');
  const [pullStatus, setPullStatus] = useState<RemoteStatus>('idle');
  const [remoteError, setRemoteError] = useState<string | null>(null);

  // Right pane: diff | log
  const [rightTab, setRightTab] = useState<'diff' | 'log'>('diff');
  const [log, setLog] = useState<GitCommitInfo[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const loadBranches = useCallback(async () => {
    try {
      const b = await gitListBranches(repoPath);
      setBranches(b);
    } catch {
      // non-critical
    }
  }, [repoPath]);

  const refresh = useCallback(async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const s = await gitStatus(repoPath);
      setStatus(s);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
    void loadBranches();
  }, [repoPath, loadBranches]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh on mount + repoPath change
  useEffect(() => {
    void refresh();
  }, [repoPath]);

  // Focus path input when entering edit mode
  useEffect(() => {
    if (editingPath) {
      pathInputRef.current?.focus();
    }
  }, [editingPath]);

  // Close branch dropdown on outside click
  useEffect(() => {
    if (!showBranchDropdown) return;
    function handleOutsideClick(e: MouseEvent) {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setShowBranchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showBranchDropdown]);

  // Load log when log tab becomes active
  useEffect(() => {
    if (rightTab !== 'log') return;
    setLogLoading(true);
    gitLog(repoPath)
      .then((entries) => setLog(entries))
      .catch(() => setLog([]))
      .finally(() => setLogLoading(false));
  }, [rightTab, repoPath]);

  const selectFile = useCallback(
    async (filePath: string, staged: boolean) => {
      setSelected({ filePath, staged });
      setDiffContent(null);
      setDiffLoading(true);
      try {
        const content = await gitDiffContent(repoPath, filePath, staged);
        setDiffContent(content);
      } catch (e) {
        // Show the error as the modified side so the viewer has something to display
        setDiffContent({
          original: '',
          modified: `Error: ${e instanceof Error ? e.message : String(e)}`,
        });
      } finally {
        setDiffLoading(false);
      }
    },
    [repoPath],
  );

  const stageFile = useCallback(
    async (filePath: string) => {
      await gitStageFile(repoPath, filePath);
      await refresh();
    },
    [repoPath, refresh],
  );

  const unstageFile = useCallback(
    async (filePath: string) => {
      await gitUnstageFile(repoPath, filePath);
      await refresh();
    },
    [repoPath, refresh],
  );

  const discardFile = useCallback(
    async (filePath: string) => {
      await gitDiscardFile(repoPath, filePath);
      await refresh();
      if (selected?.filePath === filePath) {
        setSelected(null);
        setDiffContent(null);
      }
    },
    [repoPath, refresh, selected],
  );

  const handleCommit = useCallback(
    async (message: string) => {
      await gitCommit(repoPath, message);
      setSelected(null);
      setDiffContent(null);
      await refresh();
      if (rightTab === 'log') {
        setLogLoading(true);
        gitLog(repoPath)
          .then((entries) => setLog(entries))
          .catch(() => setLog([]))
          .finally(() => setLogLoading(false));
      }
    },
    [repoPath, refresh, rightTab],
  );

  const switchBranch = useCallback(
    async (name: string) => {
      setSwitchingTo(name);
      setBranchError(null);
      try {
        await gitSwitchBranch(repoPath, name);
        setShowBranchDropdown(false);
        await refresh();
      } catch (e) {
        setBranchError(e instanceof Error ? e.message : String(e));
      } finally {
        setSwitchingTo(null);
      }
    },
    [repoPath, refresh],
  );

  const createAndSwitchBranch = useCallback(
    async (name: string) => {
      setCreatingBranch(true);
      setBranchError(null);
      try {
        await gitCreateBranch(repoPath, name);
        await gitSwitchBranch(repoPath, name);
        setShowBranchDropdown(false);
        await refresh();
      } catch (e) {
        setBranchError(e instanceof Error ? e.message : String(e));
      } finally {
        setCreatingBranch(false);
      }
    },
    [repoPath, refresh],
  );

  const handlePush = useCallback(async () => {
    setPushStatus('loading');
    setRemoteError(null);
    try {
      await gitPush(repoPath, 'origin', status?.branch ?? 'main');
      setPushStatus('ok');
      setTimeout(() => setPushStatus('idle'), REMOTE_SUCCESS_FEEDBACK_MS);
    } catch (e) {
      setPushStatus('error');
      setRemoteError(e instanceof Error ? e.message : String(e));
      setTimeout(() => {
        setPushStatus('idle');
        setRemoteError(null);
      }, REMOTE_ERROR_FEEDBACK_MS);
    }
  }, [repoPath, status?.branch]);

  const handlePull = useCallback(async () => {
    setPullStatus('loading');
    setRemoteError(null);
    try {
      await gitPull(repoPath, 'origin', status?.branch ?? 'main');
      setPullStatus('ok');
      setTimeout(() => setPullStatus('idle'), REMOTE_SUCCESS_FEEDBACK_MS);
      await refresh();
    } catch (e) {
      setPullStatus('error');
      setRemoteError(e instanceof Error ? e.message : String(e));
      setTimeout(() => {
        setPullStatus('idle');
        setRemoteError(null);
      }, REMOTE_ERROR_FEEDBACK_MS);
    }
  }, [repoPath, status?.branch, refresh]);

  const applyPath = () => {
    const trimmed = draftPath.trim();
    if (trimmed) {
      setRepoPath(trimmed);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('git-repo-path', trimmed);
      }
    }
    setEditingPath(false);
  };

  const totalFiles =
    (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0) + (status?.untracked.length ?? 0);

  const currentBranch = status?.branch ?? ' - ';

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left pane: file list ── */}
      <div className="flex w-72 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900">
        {/* Header */}
        <div className="border-b border-neutral-800 px-3 py-2.5">
          {editingPath ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyPath();
              }}
              className="flex gap-1.5"
            >
              <input
                ref={pathInputRef}
                value={draftPath}
                onChange={(e) => setDraftPath(e.target.value)}
                onBlur={applyPath}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingPath(false);
                }}
                className="min-w-0 flex-1 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-neutral-200 focus:border-neutral-400 focus:outline-none"
              />
            </form>
          ) : (
            <>
              <div className="flex items-center gap-1">
                {/* Branch dropdown trigger */}
                <div ref={branchDropdownRef} className="relative min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      setBranchError(null);
                      setShowBranchDropdown((v) => !v);
                    }}
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-neutral-800"
                  >
                    <BranchIcon />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-neutral-200">
                      {currentBranch}
                    </span>
                    <ChevronDownIcon />
                  </button>

                  {showBranchDropdown && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-neutral-700 bg-neutral-800 shadow-xl">
                      <div className="max-h-48 overflow-y-auto py-1">
                        {branches.length === 0 && (
                          <p className="px-3 py-2 text-[11px] text-neutral-500">
                            No branches found
                          </p>
                        )}
                        {branches.map((b) => (
                          <button
                            key={b.name}
                            type="button"
                            onClick={() => {
                              if (!b.is_current) void switchBranch(b.name);
                            }}
                            disabled={b.is_current || switchingTo !== null}
                            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                              b.is_current
                                ? 'cursor-default text-orange-400'
                                : 'text-neutral-300 hover:bg-neutral-700'
                            } disabled:opacity-60`}
                          >
                            {b.is_current ? (
                              <svg
                                className="size-3 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : (
                              <span className="size-3 shrink-0" />
                            )}
                            <span className="truncate">{b.name}</span>
                            {switchingTo === b.name && (
                              <span className="ml-auto text-[10px] text-neutral-500">
                                switching…
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                      {branchError && (
                        <p className="mx-2 mb-1 truncate rounded bg-red-950/40 px-2 py-1 text-[10px] text-red-400">
                          {branchError}
                        </p>
                      )}
                      <NewBranchInput onCreate={createAndSwitchBranch} creating={creatingBranch} />
                    </div>
                  )}
                </div>

                {/* Toolbar: pull, push, refresh */}
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => void handlePull()}
                    disabled={pullStatus === 'loading'}
                    title="Pull"
                    className={`flex size-6 items-center justify-center rounded transition-colors disabled:opacity-40 ${
                      pullStatus === 'ok'
                        ? 'text-green-400'
                        : pullStatus === 'error'
                          ? 'text-red-400'
                          : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
                    }`}
                  >
                    <DownloadIcon spinning={pullStatus === 'loading'} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePush()}
                    disabled={pushStatus === 'loading'}
                    title="Push"
                    className={`flex size-6 items-center justify-center rounded transition-colors disabled:opacity-40 ${
                      pushStatus === 'ok'
                        ? 'text-green-400'
                        : pushStatus === 'error'
                          ? 'text-red-400'
                          : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
                    }`}
                  >
                    <UploadIcon spinning={pushStatus === 'loading'} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    disabled={loadingStatus}
                    title="Refresh"
                    className="flex size-6 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300 disabled:opacity-40"
                  >
                    <RefreshIcon spinning={loadingStatus} />
                  </button>
                </div>
              </div>

              {/* Repo path */}
              <button
                type="button"
                onClick={() => {
                  setDraftPath(repoPath);
                  setEditingPath(true);
                }}
                className="mt-0.5 max-w-full truncate text-left text-[10px] text-neutral-500 hover:text-neutral-300"
                title="Change repository path"
              >
                {repoPath}
              </button>

              {/* Remote error */}
              {remoteError && (
                <p className="mt-0.5 truncate text-[10px] text-red-400" title={remoteError}>
                  {remoteError}
                </p>
              )}
            </>
          )}
        </div>

        {/* Status error */}
        {statusError && (
          <div className="mx-3 mt-2 rounded border border-red-800/50 bg-red-950/30 px-2.5 py-2 text-[10px] text-red-400">
            {statusError}
          </div>
        )}

        {/* File lists */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {!(status || loadingStatus || statusError) && (
            <p className="px-2 py-4 text-center text-xs text-neutral-600">No repository loaded</p>
          )}
          {loadingStatus && !status && (
            <p className="px-2 py-4 text-center text-xs text-neutral-600">Loading…</p>
          )}
          {status && totalFiles === 0 && (
            <p className="px-2 py-4 text-center text-xs text-neutral-600">Working tree clean</p>
          )}
          {status && (
            <>
              <Section title="Staged" count={status.staged.length} accent="text-green-500">
                {status.staged.map((entry) => (
                  <FileRow
                    key={`staged-${entry.path}`}
                    entry={entry}
                    selected={selected?.filePath === entry.path && selected.staged}
                    onSelect={() => {
                      void selectFile(entry.path, true);
                    }}
                    onUnstage={() => {
                      void unstageFile(entry.path);
                    }}
                    onOpenEditor={
                      onOpenEditor
                        ? () => {
                            onOpenEditor(repoPath, entry.path);
                          }
                        : undefined
                    }
                  />
                ))}
              </Section>

              <Section title="Changes" count={status.unstaged.length} accent="text-orange-500">
                {status.unstaged.map((entry) => (
                  <FileRow
                    key={`unstaged-${entry.path}`}
                    entry={entry}
                    selected={selected?.filePath === entry.path && !selected.staged}
                    onSelect={() => {
                      void selectFile(entry.path, false);
                    }}
                    onStage={() => {
                      void stageFile(entry.path);
                    }}
                    onDiscard={() => {
                      void discardFile(entry.path);
                    }}
                    onOpenEditor={
                      onOpenEditor
                        ? () => {
                            onOpenEditor(repoPath, entry.path);
                          }
                        : undefined
                    }
                  />
                ))}
              </Section>

              <Section title="Untracked" count={status.untracked.length} accent="text-neutral-500">
                {status.untracked.map((entry) => (
                  <FileRow
                    key={`untracked-${entry.path}`}
                    entry={entry}
                    selected={selected?.filePath === entry.path && !selected.staged}
                    onSelect={() => {
                      void selectFile(entry.path, false);
                    }}
                    onStage={() => {
                      void stageFile(entry.path);
                    }}
                    onOpenEditor={
                      onOpenEditor
                        ? () => {
                            onOpenEditor(repoPath, entry.path);
                          }
                        : undefined
                    }
                  />
                ))}
              </Section>
            </>
          )}
        </div>

        {/* Commit form */}
        {status && <CommitForm stagedCount={status.staged.length} onCommit={handleCommit} />}
      </div>

      {/* ── Right pane: diff / log ── */}
      <div className="flex min-w-0 flex-1 flex-col bg-neutral-950">
        {/* Tab bar */}
        <div className="flex items-center gap-3 border-b border-neutral-800 px-3 py-1.5">
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={() => setRightTab('diff')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                rightTab === 'diff'
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Diff
            </button>
            <button
              type="button"
              onClick={() => setRightTab('log')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                rightTab === 'log'
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Log
            </button>
          </div>
          {rightTab === 'diff' && selected && (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate text-xs font-medium text-neutral-300">
                {selected.filePath}
              </span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  selected.staged
                    ? 'bg-green-900/40 text-green-400'
                    : 'bg-orange-900/40 text-orange-400'
                }`}
              >
                {selected.staged ? 'staged' : 'unstaged'}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          {rightTab === 'diff' &&
            (diffLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                Loading diff…
              </div>
            ) : diffContent ? (
              <DiffView
                original={diffContent.original}
                modified={diffContent.modified}
                filePath={selected?.filePath ?? ''}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-neutral-600">
                Select a file to view its diff
              </div>
            ))}
          {rightTab === 'log' && <CommitLog entries={log} loading={logLoading} />}
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function BranchIcon() {
  return (
    <svg
      className="size-3.5 shrink-0 text-neutral-400"
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      className="size-3 shrink-0 text-neutral-500"
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`size-3.5 ${spinning ? 'animate-spin' : ''}`}
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M4 4v5h5M20 20v-5h-5" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L4 7m16 10l-1.64 1.36A9 9 0 0 1 3.51 15" />
    </svg>
  );
}

function DownloadIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`size-3.5 ${spinning ? 'animate-pulse' : ''}`}
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function UploadIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`size-3.5 ${spinning ? 'animate-pulse' : ''}`}
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      className="size-3"
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg
      className="size-3"
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg
      className="size-3"
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M3 7v6h6" />
      <path d="M3 13A9 9 0 1 0 5.7 5.7L3 7" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      className="size-3"
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}
