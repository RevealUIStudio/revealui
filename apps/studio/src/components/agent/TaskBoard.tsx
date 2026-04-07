import { useState } from 'react';
import type { HarnessTask } from '../../types';

interface TaskBoardProps {
  tasks: HarnessTask[];
  agentId: string;
  onCreate: (taskId: string, description: string) => Promise<void>;
  onClaim: (taskId: string) => Promise<void>;
  onComplete: (taskId: string) => Promise<void>;
  onRelease: (taskId: string) => Promise<void>;
}

type TaskColumn = 'open' | 'claimed' | 'completed';

const COLUMN_CONFIG: Record<TaskColumn, { label: string; accent: string; bgAccent: string }> = {
  open: { label: 'Open', accent: 'text-blue-400', bgAccent: 'bg-blue-600/10' },
  claimed: { label: 'Claimed', accent: 'text-orange-400', bgAccent: 'bg-orange-600/10' },
  completed: { label: 'Done', accent: 'text-green-400', bgAccent: 'bg-green-600/10' },
};

const COLUMNS: TaskColumn[] = ['open', 'claimed', 'completed'];

export default function TaskBoard({
  tasks,
  agentId,
  onCreate,
  onClaim,
  onComplete,
  onRelease,
}: TaskBoardProps) {
  const [creating, setCreating] = useState(false);
  const [newId, setNewId] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(): Promise<void> {
    if (!(newId.trim() && newDesc.trim())) return;
    setSubmitting(true);
    try {
      await onCreate(newId.trim(), newDesc.trim());
      setCreating(false);
      setNewId('');
      setNewDesc('');
    } finally {
      setSubmitting(false);
    }
  }

  function relativeTime(iso: string): string {
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return iso;
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function tasksByColumn(col: TaskColumn): HarnessTask[] {
    return tasks.filter((t) => t.status === col);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <span className="text-xs font-semibold text-neutral-200">Tasks</span>
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
          {tasks.length}
        </span>
        <button
          type="button"
          onClick={() => setCreating(!creating)}
          className="ml-auto rounded bg-blue-600/20 px-2 py-1 text-[10px] font-medium text-blue-400 hover:bg-blue-600/30"
        >
          {creating ? 'Cancel' : '+ Task'}
        </button>
      </div>

      {/* Create form */}
      {creating ? (
        <div className="border-b border-neutral-800 bg-neutral-900/50 p-3">
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="Task ID (e.g. task-004)"
            className="mb-2 w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description"
            className="mb-2 w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={submitting || !newId.trim() || !newDesc.trim()}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      ) : null}

      {/* Kanban columns */}
      <div className="flex flex-1 gap-2 overflow-x-auto p-3">
        {COLUMNS.map((col) => {
          const cfg = COLUMN_CONFIG[col];
          const colTasks = tasksByColumn(col);
          return (
            <div
              key={col}
              className={`flex min-w-[180px] flex-1 flex-col rounded-lg ${cfg.bgAccent}`}
            >
              <div className="flex items-center gap-1.5 px-2.5 py-2">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${cfg.accent}`}
                >
                  {cfg.label}
                </span>
                <span className="rounded bg-neutral-800 px-1 py-0.5 text-[10px] text-neutral-500">
                  {colTasks.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-2 pb-2">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    agentId={agentId}
                    relativeTime={relativeTime}
                    onClaim={() => void onClaim(task.id)}
                    onComplete={() => void onComplete(task.id)}
                    onRelease={() => void onRelease(task.id)}
                  />
                ))}
                {colTasks.length === 0 ? (
                  <p className="py-4 text-center text-[10px] text-neutral-600">Empty</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Task card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: HarnessTask;
  agentId: string;
  relativeTime: (iso: string) => string;
  onClaim: () => void;
  onComplete: () => void;
  onRelease: () => void;
}

function TaskCard({ task, agentId, relativeTime, onClaim, onComplete, onRelease }: TaskCardProps) {
  const isOwned = task.owner === agentId;

  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/80 p-2">
      <p className="text-[10px] font-medium text-neutral-500">{task.id}</p>
      <p className="mt-0.5 text-xs leading-snug text-neutral-200">{task.description}</p>
      {task.owner ? (
        <p className="mt-1 text-[10px] text-neutral-600">
          owner: <span className="text-neutral-400">{task.owner}</span>
        </p>
      ) : null}
      <p className="mt-0.5 text-[10px] text-neutral-600">{relativeTime(task.created_at)}</p>

      {/* Actions */}
      <div className="mt-1.5 flex gap-1">
        {task.status === 'open' ? (
          <button
            type="button"
            onClick={onClaim}
            className="rounded bg-blue-600/20 px-2 py-0.5 text-[10px] font-medium text-blue-400 hover:bg-blue-600/30"
          >
            Claim
          </button>
        ) : null}
        {task.status === 'claimed' && isOwned ? (
          <>
            <button
              type="button"
              onClick={onComplete}
              className="rounded bg-green-600/20 px-2 py-0.5 text-[10px] font-medium text-green-400 hover:bg-green-600/30"
            >
              Complete
            </button>
            <button
              type="button"
              onClick={onRelease}
              className="rounded bg-neutral-700/40 px-2 py-0.5 text-[10px] font-medium text-neutral-400 hover:bg-neutral-700/60"
            >
              Release
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
