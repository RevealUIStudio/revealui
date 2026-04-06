/**
 * InferencePanel — local AI inference management
 *
 * Three engines: Ubuntu Inference Snaps (recommended), BitNet (1-bit CPU), Ollama.
 * Shows installed status, available models, install/pull/delete, server start/stop.
 */

import { useState } from 'react';

import { useInference } from '../../hooks/use-inference';

export default function InferencePanel() {
  const {
    ollama,
    bitnet,
    models,
    snaps,
    loading,
    error,
    pulling,
    installingSnap,
    refresh,
    startOllama,
    stopOllama,
    pullModel,
    deleteModel,
    installSnap,
    removeSnap,
  } = useInference();

  const [pullInput, setPullInput] = useState('');

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-neutral-600">Checking inference engines…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-neutral-200">Local Inference</h1>
          <p className="mt-0.5 text-xs text-neutral-500">
            Manage local AI models — no cloud, no API keys, fully sovereign
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-700"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      ) : null}

      {/* ── Engine status cards ── */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {/* Inference Snaps */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="flex items-center gap-2">
            <span
              className={`size-2.5 shrink-0 rounded-full ${
                snaps.some((s) => s.installed) ? 'bg-green-500' : 'bg-neutral-600'
              }`}
            />
            <h2 className="text-sm font-semibold text-neutral-200">Snaps</h2>
            <span className="rounded bg-orange-900/30 px-1.5 py-0.5 text-[9px] font-medium text-orange-400">
              recommended
            </span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            Ubuntu Inference Snaps — one command install
          </p>
          <div className="mt-3">
            {snaps.some((s) => s.installed) ? (
              <span className="inline-block rounded bg-green-900/30 px-2 py-0.5 text-[10px] font-medium text-green-400">
                {snaps.filter((s) => s.installed).length} installed
              </span>
            ) : (
              <span className="inline-block rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-500">
                None installed
              </span>
            )}
          </div>
        </div>

        {/* BitNet */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="flex items-center gap-2">
            <span
              className={`size-2.5 shrink-0 rounded-full ${
                bitnet?.installed ? 'bg-green-500' : 'bg-neutral-600'
              }`}
            />
            <h2 className="text-sm font-semibold text-neutral-200">BitNet</h2>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            1-bit inference — runs on CPU, no GPU required
          </p>
          <div className="mt-3">
            {bitnet?.installed ? (
              <>
                <span className="inline-block rounded bg-green-900/30 px-2 py-0.5 text-[10px] font-medium text-green-400">
                  Installed
                </span>
                {bitnet.model_path ? (
                  <p
                    className="mt-1 truncate text-[10px] text-neutral-600"
                    title={bitnet.model_path}
                  >
                    {bitnet.model_path}
                  </p>
                ) : null}
              </>
            ) : (
              <span className="inline-block rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-500">
                Not installed
              </span>
            )}
          </div>
        </div>

        {/* Ollama */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="flex items-center gap-2">
            <span
              className={`size-2.5 shrink-0 rounded-full ${
                ollama?.running
                  ? 'bg-green-500'
                  : ollama?.installed
                    ? 'bg-orange-500'
                    : 'bg-neutral-600'
              }`}
            />
            <h2 className="text-sm font-semibold text-neutral-200">Ollama</h2>
            {ollama?.version ? (
              <span className="text-[10px] text-neutral-500">{ollama.version}</span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            Run open models — Llama, Mistral, Gemma
          </p>
          <div className="mt-3 flex items-center gap-2">
            {ollama?.installed ? (
              <>
                {ollama.running ? (
                  <>
                    <span className="inline-block rounded bg-green-900/30 px-2 py-0.5 text-[10px] font-medium text-green-400">
                      Running
                    </span>
                    <button
                      type="button"
                      onClick={() => void stopOllama()}
                      className="rounded bg-red-900/30 px-2 py-0.5 text-[10px] text-red-400 transition-colors hover:bg-red-900/50"
                    >
                      Stop
                    </button>
                  </>
                ) : (
                  <>
                    <span className="inline-block rounded bg-orange-900/30 px-2 py-0.5 text-[10px] font-medium text-orange-400">
                      Stopped
                    </span>
                    <button
                      type="button"
                      onClick={() => void startOllama()}
                      className="rounded bg-green-900/30 px-2 py-0.5 text-[10px] text-green-400 transition-colors hover:bg-green-900/50"
                    >
                      Start
                    </button>
                  </>
                )}
              </>
            ) : (
              <span className="inline-block rounded bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-500">
                Not installed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Inference Snaps section ── */}
      <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-200">Inference Snaps</h2>
          <span className="text-[10px] text-neutral-500">sudo snap install &lt;name&gt;</span>
        </div>
        <div className="divide-y divide-neutral-800">
          {snaps.map((snap) => (
            <div key={snap.name} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-neutral-200">{snap.name}</span>
                <span className="text-[10px] text-neutral-500">{snap.description}</span>
              </div>
              {snap.installed ? (
                <div className="flex items-center gap-2">
                  <span className="rounded bg-green-900/30 px-2 py-0.5 text-[10px] font-medium text-green-400">
                    Installed
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeSnap(snap.name)}
                    className="rounded px-2 py-0.5 text-[10px] text-neutral-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void installSnap(snap.name)}
                  disabled={installingSnap !== null}
                  className="shrink-0 rounded bg-orange-900/30 px-3 py-1 text-[10px] font-medium text-orange-400 transition-colors hover:bg-orange-900/50 disabled:opacity-40"
                >
                  {installingSnap === snap.name ? 'Installing…' : 'Install'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Ollama models ── */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-200">Ollama Models</h2>
          <span className="text-[10px] text-neutral-500">
            {models.length} model{models.length !== 1 ? 's' : ''} available
          </span>
        </div>

        {/* Pull form */}
        {ollama?.running ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pullInput.trim()) {
                void pullModel(pullInput.trim());
                setPullInput('');
              }
            }}
            className="mb-3 flex gap-2"
          >
            <input
              value={pullInput}
              onChange={(e) => setPullInput(e.target.value)}
              placeholder="Pull a model (e.g. llama3.2, mistral, gemma2)"
              disabled={pulling}
              className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-orange-600 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={pulling || !pullInput.trim()}
              className="shrink-0 rounded bg-orange-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-40"
            >
              {pulling ? 'Pulling…' : 'Pull'}
            </button>
          </form>
        ) : null}

        {models.length > 0 ? (
          <div className="divide-y divide-neutral-800">
            {models.map((m) => (
              <div key={m.name} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-neutral-200">{m.name}</span>
                  <span className="text-[10px] text-neutral-500">
                    {m.size} · {m.modified}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteModel(m.name)}
                  className="shrink-0 rounded px-2 py-0.5 text-[10px] text-neutral-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-xs text-neutral-600">
            {ollama?.running
              ? 'No models downloaded yet — pull one above'
              : ollama?.installed
                ? 'Start the Ollama server to manage models'
                : 'Install Ollama to download and run models locally'}
          </p>
        )}
      </div>
    </div>
  );
}
