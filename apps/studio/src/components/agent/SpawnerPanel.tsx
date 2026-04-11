/**
 * SpawnerPanel  -  spawn and manage local inference agents (Snaps / Ollama)
 *
 * Renders inside the Agent page left pane, below the workboard sessions.
 * Provides: spawn dialog, running agent list, output viewer, stop/remove.
 */

import { useRef, useState } from 'react';
import { useSpawner } from '../../hooks/use-spawner';
import type { AgentBackend } from '../../types';

export default function SpawnerPanel() {
  const { sessions, output, error, spawn, stop, remove } = useSpawner();
  const [showSpawn, setShowSpawn] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
          <span>Local Agents</span>
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-400">
            {sessions.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowSpawn(!showSpawn)}
          className="rounded bg-orange-900/30 px-2 py-0.5 text-[10px] font-medium text-orange-400 transition-colors hover:bg-orange-900/50"
        >
          + Spawn
        </button>
      </div>

      {showSpawn ? (
        <SpawnForm
          onSpawn={async (name, backend, model, prompt) => {
            await spawn(name, backend, model, prompt);
            setShowSpawn(false);
          }}
          onCancel={() => setShowSpawn(false)}
        />
      ) : null}

      {error ? (
        <div className="mb-2 rounded border border-red-800/50 bg-red-950/30 px-2.5 py-2 text-[10px] text-red-400">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`rounded-lg border bg-neutral-900/60 p-2.5 transition-colors ${
              selectedSession === s.id
                ? 'border-orange-700/60'
                : 'border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => setSelectedSession(selectedSession === s.id ? null : s.id)}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    s.status === 'running'
                      ? 'animate-pulse bg-green-500'
                      : s.status === 'errored'
                        ? 'bg-red-500'
                        : 'bg-neutral-600'
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-neutral-200">
                  {s.name}
                </span>
                <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-500">
                  {s.backend === 'Snap' ? 'Snap' : 'Ollama'}
                </span>
              </div>
              <p className="mt-1 truncate text-[10px] text-neutral-500">{s.model}</p>
              <p className="mt-0.5 truncate text-[11px] leading-snug text-neutral-400">
                {s.prompt}
              </p>
            </button>

            <div className="mt-2 flex items-center gap-1">
              {s.status === 'running' ? (
                <button
                  type="button"
                  onClick={() => void stop(s.id)}
                  className="rounded bg-red-900/30 px-2 py-0.5 text-[10px] text-red-400 transition-colors hover:bg-red-900/50"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void remove(s.id)}
                  className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400 transition-colors hover:bg-neutral-700"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Inline output viewer */}
            {selectedSession === s.id && output[s.id] ? (
              <OutputViewer lines={output[s.id]} />
            ) : null}
          </div>
        ))}
      </div>

      {sessions.length === 0 && !showSpawn ? (
        <p className="px-2 py-4 text-center text-[11px] text-neutral-600">
          No local agents running
        </p>
      ) : null}
    </div>
  );
}

// ── Spawn form ──────────────────────────────────────────────────────────────

interface SpawnFormProps {
  onSpawn: (name: string, backend: AgentBackend, model: string, prompt: string) => Promise<void>;
  onCancel: () => void;
}

function SpawnForm({ onSpawn, onCancel }: SpawnFormProps) {
  const [name, setName] = useState('');
  const [backend, setBackend] = useState<AgentBackend>('Snap');
  const [model, setModel] = useState('nemotron-3-nano');
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(name.trim() && model.trim() && prompt.trim())) return;
    setSubmitting(true);
    try {
      await onSpawn(name.trim(), backend, model.trim(), prompt.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="mb-3 rounded-lg border border-orange-800/40 bg-orange-950/20 p-3"
    >
      <label className="mb-2 block">
        <span className="mb-0.5 block text-[10px] font-medium text-neutral-400">Name</span>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-agent"
          className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200 focus:border-orange-600 focus:outline-none"
        />
      </label>

      <div className="mb-2">
        <span className="mb-0.5 block text-[10px] font-medium text-neutral-400">Backend</span>
        <div className="flex gap-1.5">
          {(['Snap', 'Ollama'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBackend(b)}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                backend === b
                  ? 'bg-orange-900/50 text-orange-300 ring-1 ring-orange-700/50'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              {b === 'Snap' ? 'Snaps' : b}
            </button>
          ))}
        </div>
      </div>

      <label className="mb-2 block">
        <span className="mb-0.5 block text-[10px] font-medium text-neutral-400">Model</span>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={backend === 'Snap' ? 'nemotron-3-nano' : 'gemma4:e2b'}
          className="w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200 focus:border-orange-600 focus:outline-none"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-0.5 block text-[10px] font-medium text-neutral-400">Prompt</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What should this agent do?"
          rows={3}
          className="w-full resize-none rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-200 focus:border-orange-600 focus:outline-none"
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-3 py-1 text-xs text-neutral-400 transition-colors hover:text-neutral-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !name.trim() || !model.trim() || !prompt.trim()}
          className="rounded bg-orange-700 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-40"
        >
          {submitting ? 'Spawning…' : 'Spawn Agent'}
        </button>
      </div>
    </form>
  );
}

// ── Output viewer ───────────────────────────────────────────────────────────

function OutputViewer({ lines }: { lines: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="mt-2 max-h-40 overflow-y-auto rounded bg-neutral-950 p-2 font-mono text-[10px] leading-relaxed text-neutral-400"
    >
      {lines.length === 0 ? (
        <span className="italic text-neutral-600">Waiting for output…</span>
      ) : (
        lines.map((line, i) => (
          /* biome-ignore lint/suspicious/noArrayIndexKey: append-only log output, lines never reorder and can duplicate */
          <div key={i} className="whitespace-pre-wrap break-all">
            {line}
          </div>
        ))
      )}
    </div>
  );
}
