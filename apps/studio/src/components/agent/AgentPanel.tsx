/**
 * AgentPanel — workboard-aware change review (Pro)
 *
 * Left pane:  active Claude Code sessions, parsed from a configurable workboard.md
 * Right pane: pending git changes with per-file stage / discard and bulk actions
 */

import { useEffect, useRef, useState } from 'react';

import AgentChat from './AgentChat';
import FileReservations from './FileReservations';
import MessageInbox from './MessageInbox';
import SpawnerPanel from './SpawnerPanel';
import TaskBoard from './TaskBoard';

const AGENT_POLL_INTERVAL_MS = 30_000;

type RightTab = 'changes' | 'chat' | 'messages' | 'tasks' | 'reservations';

import { useHarness } from '../../hooks/use-harness';
import { useSettingsContext } from '../../hooks/use-settings';
import type { AgentCard } from '../../lib/a2a-api';
import { fetchAgentCards } from '../../lib/a2a-api';
import {
  agentReadWorkboard,
  gitDiscardFile,
  gitStageFile,
  gitStatus,
  gitUnstageFile,
} from '../../lib/invoke';
import type { AgentSession, GitFileEntry, GitStatusResult } from '../../types';

// ── Workboard parser ──────────────────────────────────────────────────────────

function parseWorkboard(md: string): AgentSession[] {
  const lines = md.split('\n');
  let inSection = false;
  let passedSeparator = false;
  const sessions: AgentSession[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '## Active Sessions') {
      inSection = true;
      continue;
    }
    if (inSection && trimmed.startsWith('## ')) break;
    if (!(inSection && trimmed.startsWith('|'))) continue;

    // Separator row: only pipes, dashes, and spaces
    if (/^[|\-\s]+$/.test(trimmed) && trimmed.includes('-')) {
      passedSeparator = true;
      continue;
    }
    if (!passedSeparator) continue; // skip header row

    const cells = trimmed
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length >= 6) {
      sessions.push({
        id: cells[0],
        env: cells[1],
        started: cells[2],
        task: cells[3],
        files: cells[4],
        updated: cells[5],
      });
    }
  }

  return sessions;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Status badge ──────────────────────────────────────────────────────────────

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
    label: status[0]?.toUpperCase() ?? '?',
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

// ── Change row ────────────────────────────────────────────────────────────────

interface ChangeRowProps {
  entry: GitFileEntry;
  staged?: boolean;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
}

function ChangeRow({ entry, staged, onStage, onUnstage, onDiscard }: ChangeRowProps) {
  const name = entry.path.split('/').pop() ?? entry.path;
  const dir = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : '';

  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-neutral-800/50">
      <StatusBadge status={entry.status} />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-neutral-300">{name}</span>
        {dir ? <span className="block truncate text-[10px] text-neutral-500">{dir}</span> : null}
      </div>
      {staged ? (
        <span className="shrink-0 rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] font-medium text-green-500">
          staged
        </span>
      ) : null}
      <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
        {onStage ? (
          <button
            type="button"
            title="Stage"
            onClick={onStage}
            className="flex size-5 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
          >
            <PlusIcon />
          </button>
        ) : null}
        {onUnstage ? (
          <button
            type="button"
            title="Unstage"
            onClick={onUnstage}
            className="flex size-5 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
          >
            <MinusIcon />
          </button>
        ) : null}
        {onDiscard ? (
          <button
            type="button"
            title="Discard"
            onClick={onDiscard}
            className="flex size-5 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-red-900/40 hover:text-red-400"
          >
            <UndoIcon />
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: AgentSession }) {
  const isIdle = session.task === '(starting)' || session.task === 'idle';
  const hasFiles = session.files !== '—' && session.files.trim() !== '';

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
      <div className="flex items-center gap-2">
        <span
          className={`size-2 shrink-0 rounded-full ${
            isIdle ? 'bg-neutral-600' : 'animate-pulse bg-green-500'
          }`}
        />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-neutral-200">
          {session.id}
        </span>
        <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">
          {session.env}
        </span>
      </div>
      {isIdle ? (
        <p className="mt-1.5 text-[11px] italic text-neutral-600">starting up…</p>
      ) : (
        <p className="mt-1.5 text-[11px] leading-snug text-neutral-400">{session.task}</p>
      )}
      {hasFiles ? (
        <p className="mt-1 truncate text-[10px] text-neutral-600" title={session.files}>
          {session.files}
        </p>
      ) : null}
      <p className="mt-1 text-[10px] text-neutral-600">updated {relativeTime(session.updated)}</p>
    </div>
  );
}

// ── Harness session card ─────────────────────────────────────────────────────

function HarnessSessionCard({ session }: { session: import('../../types').HarnessSession }) {
  const isEnded = session.ended_at !== null;
  const hasFiles = session.files !== null && session.files.trim() !== '';

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
      <div className="flex items-center gap-2">
        <span
          className={`size-2 shrink-0 rounded-full ${
            isEnded ? 'bg-neutral-600' : 'animate-pulse bg-cyan-500'
          }`}
        />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-neutral-200">
          {session.id}
        </span>
        <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">
          {session.env}
        </span>
        {session.pid ? (
          <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-600">
            pid:{session.pid}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-neutral-400">{session.task}</p>
      {hasFiles ? (
        <p className="mt-1 truncate text-[10px] text-neutral-600" title={session.files ?? ''}>
          {session.files}
        </p>
      ) : null}
      <p className="mt-1 text-[10px] text-neutral-600">
        updated {relativeTime(session.updated_at)}
      </p>
      {session.exit_summary ? (
        <p className="mt-1 text-[10px] text-green-600">{session.exit_summary}</p>
      ) : null}
    </div>
  );
}

// ── Change section ────────────────────────────────────────────────────────────

function ChangeSection({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent: string;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-4">
      <div
        className={`mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${accent}`}
      >
        <span>{title}</span>
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-400">{count}</span>
      </div>
      {children}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function AgentPanel() {
  const [workboardPath, setWorkboardPath] = useState(
    () =>
      (typeof localStorage !== 'undefined' && localStorage.getItem('agent-workboard-path')) || '',
  );
  const [editingWorkboard, setEditingWorkboard] = useState(false);
  const [draftWorkboard, setDraftWorkboard] = useState(workboardPath);
  const workboardInputRef = useRef<HTMLInputElement>(null);

  const [repoPath, setRepoPath] = useState(
    () =>
      (typeof localStorage !== 'undefined' && localStorage.getItem('git-repo-path')) ||
      '~/projects/RevealUI',
  );
  const [editingRepo, setEditingRepo] = useState(false);
  const [draftRepo, setDraftRepo] = useState(repoPath);
  const repoInputRef = useRef<HTMLInputElement>(null);

  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [workboardError, setWorkboardError] = useState<string | null>(null);

  const [gitState, setGitState] = useState<GitStatusResult | null>(null);
  const [gitError, setGitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [stagingAll, setStagingAll] = useState(false);
  const [discardingAll, setDiscardingAll] = useState(false);

  // Tab state for right pane
  const [rightTab, setRightTab] = useState<RightTab>('changes');

  // Remote agents state
  const { settings } = useSettingsContext();
  const [remoteAgents, setRemoteAgents] = useState<AgentCard[]>([]);

  // Harness daemon state
  const harness = useHarness('studio');

  async function loadWorkboard() {
    try {
      const md = await agentReadWorkboard(workboardPath);
      setSessions(parseWorkboard(md));
      setWorkboardError(null);
    } catch (e) {
      setWorkboardError(e instanceof Error ? e.message : String(e));
      setSessions([]);
    }
  }

  async function loadChanges() {
    setLoading(true);
    setGitError(null);
    try {
      const s = await gitStatus(repoPath);
      setGitState(s);
    } catch (e) {
      setGitError(e instanceof Error ? e.message : String(e));
      setGitState(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadRemoteAgents() {
    const cards = await fetchAgentCards(settings.apiUrl);
    setRemoteAgents(cards);
  }

  async function refresh() {
    await Promise.all([loadWorkboard(), loadChanges(), loadRemoteAgents()]);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh on mount + path changes
  useEffect(() => {
    void refresh();
  }, [workboardPath, repoPath, settings.apiUrl]);

  // Auto-refresh every 30 s
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable interval
  useEffect(() => {
    const id = setInterval(() => void refresh(), AGENT_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [workboardPath, repoPath, settings.apiUrl]);

  useEffect(() => {
    if (editingWorkboard) workboardInputRef.current?.focus();
  }, [editingWorkboard]);

  useEffect(() => {
    if (editingRepo) repoInputRef.current?.focus();
  }, [editingRepo]);

  const applyWorkboardPath = () => {
    const t = draftWorkboard.trim();
    if (t) {
      setWorkboardPath(t);
      if (typeof localStorage !== 'undefined') localStorage.setItem('agent-workboard-path', t);
    }
    setEditingWorkboard(false);
  };

  const applyRepoPath = () => {
    const t = draftRepo.trim();
    if (t) {
      setRepoPath(t);
      if (typeof localStorage !== 'undefined') localStorage.setItem('git-repo-path', t);
    }
    setEditingRepo(false);
  };

  const stageFile = (path: string) => gitStageFile(repoPath, path).then(() => loadChanges());

  const unstageFile = (path: string) => gitUnstageFile(repoPath, path).then(() => loadChanges());

  const discardFile = (path: string) => gitDiscardFile(repoPath, path).then(() => loadChanges());

  const stageAll = async () => {
    if (!gitState || stagingAll) return;
    setStagingAll(true);
    try {
      await Promise.all(
        [...gitState.unstaged, ...gitState.untracked].map((f) => gitStageFile(repoPath, f.path)),
      );
      await loadChanges();
    } finally {
      setStagingAll(false);
    }
  };

  const discardAll = async () => {
    if (!gitState || discardingAll) return;
    setDiscardingAll(true);
    try {
      await Promise.all(gitState.unstaged.map((f) => gitDiscardFile(repoPath, f.path)));
      await loadChanges();
    } finally {
      setDiscardingAll(false);
    }
  };

  const totalChanges =
    (gitState?.staged.length ?? 0) +
    (gitState?.unstaged.length ?? 0) +
    (gitState?.untracked.length ?? 0);

  return (
    <div className="flex h-full flex-col overflow-hidden md:flex-row">
      {/* ── Left pane: sessions ── */}
      <div className="flex w-full shrink-0 flex-col border-b border-neutral-800 bg-neutral-900 md:w-64 md:border-b-0 md:border-r">
        <div className="border-b border-neutral-800 px-3 py-2.5">
          <div className="mb-1.5 flex items-center gap-2">
            <AgentIcon />
            <span className="text-xs font-semibold text-neutral-200">Agent Sessions</span>
          </div>
          {editingWorkboard ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyWorkboardPath();
              }}
            >
              <input
                ref={workboardInputRef}
                value={draftWorkboard}
                onChange={(e) => setDraftWorkboard(e.target.value)}
                onBlur={applyWorkboardPath}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditingWorkboard(false);
                }}
                className="w-full rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-200 focus:border-neutral-400 focus:outline-none"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftWorkboard(workboardPath);
                setEditingWorkboard(true);
              }}
              className="max-w-full truncate text-left text-[10px] text-neutral-500 hover:text-neutral-300"
              title="Change workboard path"
            >
              {workboardPath}
            </button>
          )}
        </div>

        <div className="max-h-48 flex-1 overflow-y-auto px-2 py-2 md:max-h-none">
          {workboardError ? (
            <div className="rounded border border-red-800/50 bg-red-950/30 px-2.5 py-2 text-[10px] text-red-400">
              {workboardError}
            </div>
          ) : null}
          {!workboardError && sessions.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-neutral-600">No active sessions</p>
          ) : null}
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>

          {/* Harness daemon sessions */}
          {harness.connected ? (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-green-400">
                <span className="size-1.5 rounded-full bg-green-500" />
                <span>Harness Daemon</span>
                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-400">
                  {harness.sessions.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {harness.sessions.map((hs) => (
                  <HarnessSessionCard key={hs.id} session={hs} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded border border-neutral-800 bg-neutral-900/40 px-2.5 py-2 text-[10px] text-neutral-600">
              Harness daemon offline
            </div>
          )}

          {/* Local agents (spawner) */}
          <SpawnerPanel />

          {/* Remote agents */}
          {remoteAgents.length > 0 ? (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-400">
                <span>Cloud Agents</span>
                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-400">
                  {remoteAgents.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {remoteAgents.map((agent) => (
                  <RemoteAgentCard key={agent.name} agent={agent} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Right pane: tabbed (Changes / Chat) ── */}
      <div className="flex min-w-0 flex-1 flex-col bg-neutral-950">
        {/* Tab bar — horizontally scrollable on mobile */}
        <div className="flex items-center overflow-x-auto border-b border-neutral-800">
          <button
            type="button"
            onClick={() => setRightTab('changes')}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              rightTab === 'changes'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Changes
            {totalChanges > 0 ? (
              <span className="ml-1.5 rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
                {totalChanges}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setRightTab('chat')}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              rightTab === 'chat'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Agent Chat
          </button>
          <button
            type="button"
            onClick={() => setRightTab('messages')}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              rightTab === 'messages'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Messages
            {harness.messages.filter((m) => !m.read).length > 0 ? (
              <span className="ml-1.5 rounded-full bg-blue-600/20 px-1.5 py-0.5 text-[10px] text-blue-400">
                {harness.messages.filter((m) => !m.read).length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setRightTab('tasks')}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              rightTab === 'tasks'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setRightTab('reservations')}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              rightTab === 'reservations'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Files
            {harness.reservations.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
                {harness.reservations.length}
              </span>
            ) : null}
          </button>
          {rightTab === 'changes' ? (
            <div className="ml-auto flex items-center gap-1 pr-2">
              {(gitState?.unstaged.length ?? 0) + (gitState?.untracked.length ?? 0) > 0 ? (
                <button
                  type="button"
                  onClick={() => void stageAll()}
                  disabled={stagingAll}
                  className="rounded bg-neutral-800 px-2 py-1 text-[10px] text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-40"
                >
                  {stagingAll ? 'Staging…' : 'Stage All'}
                </button>
              ) : null}
              {(gitState?.unstaged.length ?? 0) > 0 ? (
                <button
                  type="button"
                  onClick={() => void discardAll()}
                  disabled={discardingAll}
                  className="rounded px-2 py-1 text-[10px] text-neutral-500 transition-colors hover:bg-red-900/30 hover:text-red-400 disabled:opacity-40"
                >
                  {discardingAll ? 'Discarding…' : 'Discard All'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={loading}
                title="Refresh"
                className="flex size-6 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300 disabled:opacity-40"
              >
                <RefreshIcon spinning={loading} />
              </button>
            </div>
          ) : null}
        </div>

        {/* Tab content */}
        {rightTab === 'changes' ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Repo path header */}
            <div className="border-b border-neutral-800 px-3 py-2">
              {editingRepo ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    applyRepoPath();
                  }}
                >
                  <input
                    ref={repoInputRef}
                    value={draftRepo}
                    onChange={(e) => setDraftRepo(e.target.value)}
                    onBlur={applyRepoPath}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditingRepo(false);
                    }}
                    className="w-full rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-200 focus:border-neutral-400 focus:outline-none"
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraftRepo(repoPath);
                    setEditingRepo(true);
                  }}
                  className="max-w-full truncate text-left text-[10px] text-neutral-500 hover:text-neutral-300"
                  title="Change repository path"
                >
                  {repoPath}
                </button>
              )}
              {gitState ? (
                <p className="mt-0.5 text-[10px] text-neutral-600">
                  {totalChanges === 0
                    ? `working tree clean · ${gitState.branch}`
                    : `${totalChanges} file${totalChanges !== 1 ? 's' : ''} changed · ${gitState.branch}`}
                </p>
              ) : null}
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {gitError ? (
                <div className="rounded border border-red-800/50 bg-red-950/30 px-2.5 py-2 text-[10px] text-red-400">
                  {gitError}
                </div>
              ) : null}
              {!(gitError || gitState || loading) ? (
                <p className="py-8 text-center text-xs text-neutral-600">No repository loaded</p>
              ) : null}
              {loading && !gitState ? (
                <p className="py-8 text-center text-xs text-neutral-600">Loading…</p>
              ) : null}
              {gitState && totalChanges === 0 ? (
                <p className="py-8 text-center text-xs text-neutral-600">
                  Nothing to review — working tree clean
                </p>
              ) : null}

              {gitState ? (
                <>
                  <ChangeSection
                    title="Staged"
                    count={gitState.staged.length}
                    accent="text-green-500"
                  >
                    {gitState.staged.map((entry) => (
                      <ChangeRow
                        key={`staged-${entry.path}`}
                        entry={entry}
                        staged
                        onUnstage={() => void unstageFile(entry.path)}
                      />
                    ))}
                  </ChangeSection>

                  <ChangeSection
                    title="Changes"
                    count={gitState.unstaged.length}
                    accent="text-orange-500"
                  >
                    {gitState.unstaged.map((entry) => (
                      <ChangeRow
                        key={`unstaged-${entry.path}`}
                        entry={entry}
                        onStage={() => void stageFile(entry.path)}
                        onDiscard={() => void discardFile(entry.path)}
                      />
                    ))}
                  </ChangeSection>

                  <ChangeSection
                    title="Untracked"
                    count={gitState.untracked.length}
                    accent="text-neutral-500"
                  >
                    {gitState.untracked.map((entry) => (
                      <ChangeRow
                        key={`untracked-${entry.path}`}
                        entry={entry}
                        onStage={() => void stageFile(entry.path)}
                      />
                    ))}
                  </ChangeSection>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        {rightTab === 'chat' ? <AgentChat /> : null}
        {rightTab === 'messages' ? (
          <MessageInbox
            messages={harness.messages}
            sessions={harness.sessions}
            agentId="studio"
            onSend={async (to, subj, body) => {
              await harness.sendMessage('studio', to, subj, body);
            }}
            onMarkRead={harness.markRead}
          />
        ) : null}
        {rightTab === 'tasks' ? (
          <TaskBoard
            tasks={harness.tasks}
            agentId="studio"
            onCreate={async (id, desc) => {
              await harness.createTask(id, desc);
            }}
            onClaim={async (id) => {
              await harness.claimTask(id, 'studio');
            }}
            onComplete={async (id) => {
              await harness.completeTask(id, 'studio');
            }}
            onRelease={async (id) => {
              await harness.releaseTask(id, 'studio');
            }}
          />
        ) : null}
        {rightTab === 'reservations' ? (
          <FileReservations reservations={harness.reservations} agentId="studio" />
        ) : null}
      </div>
    </div>
  );
}

// ── Remote agent card ─────────────────────────────────────────────────────────

function RemoteAgentCard({ agent }: { agent: AgentCard }) {
  const skillCount = agent.skills?.length ?? 0;
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
      <div className="flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full bg-violet-500" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-neutral-200">
          {agent.name}
        </span>
        {agent.version ? (
          <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">
            v{agent.version}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-neutral-400">{agent.description}</p>
      <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-600">
        {skillCount > 0 ? (
          <span>
            {skillCount} skill{skillCount !== 1 ? 's' : ''}
          </span>
        ) : null}
        {agent.capabilities?.streaming ? <span>streaming</span> : null}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function AgentIcon() {
  return (
    <svg
      className="size-4 shrink-0 text-neutral-400"
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="7" y="7" width="10" height="10" rx="1" />
      <path d="M9 7V5m3 2V5m3 2V5M9 17v2m3-2v2m3-2v2M7 9H5m2 3H5m2 3H5M17 9h2m-2 3h2m-2 3h2" />
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
