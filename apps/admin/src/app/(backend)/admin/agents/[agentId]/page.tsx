'use client';

import type { A2AAgentCard } from '@revealui/contracts';
import { Breadcrumb } from '@revealui/presentation/client';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { AgentMemory } from '@/lib/components/agents/agent-memory';
import { TaskHistory } from '@/lib/components/agents/task-history';
import { TaskTester } from '@/lib/components/agents/task-tester';
import { LicenseGate } from '@/lib/components/LicenseGate';

interface PageProps {
  params: Promise<{ agentId: string }>;
}

interface AgentDef {
  name: string;
  description: string;
  systemPrompt: string;
}

const BUILTIN_AGENTS = new Set(['revealui-creator', 'revealui-ticket-agent']);

export default function AgentDetailPage({ params }: PageProps) {
  const { agentId } = use(params);
  const router = useRouter();
  const [card, setCard] = useState<A2AAgentCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [loadingDef, setLoadingDef] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSystemPrompt, setEditSystemPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Task history refresh
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);

  // Retire state
  const [isConfirmingRetire, setIsConfirmingRetire] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [retireError, setRetireError] = useState<string | null>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  useEffect(() => {
    fetch(`${apiUrl}/a2a/agents/${encodeURIComponent(agentId)}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`Agent '${agentId}' not found`);
        return r.json();
      })
      .then((data: A2AAgentCard) => setCard(data))
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : 'An unexpected error occurred';
        setError(
          `Unable to load agent details. ${message}. Contact support@revealui.com if this persists.`,
        );
      })
      .finally(() => setLoading(false));
  }, [agentId, apiUrl]);

  async function handleEditStart() {
    setLoadingDef(true);
    setSaveError(null);
    try {
      const res = await fetch(`${apiUrl}/a2a/agents/${encodeURIComponent(agentId)}/def`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Unable to load agent definition');
      const data = (await res.json()) as { def: AgentDef };
      setEditName(data.def.name);
      setEditDescription(data.def.description);
      setEditSystemPrompt(data.def.systemPrompt);
      setIsEditing(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred';
      setSaveError(
        `Unable to load agent definition. ${message}. Contact support@revealui.com if this persists.`,
      );
    } finally {
      setLoadingDef(false);
    }
  }

  function handleEditCancel() {
    setIsEditing(false);
    setSaveError(null);
  }

  async function handleRetire() {
    setRetiring(true);
    setRetireError(null);
    try {
      const res = await fetch(`${apiUrl}/a2a/agents/${encodeURIComponent(agentId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setRetireError(json.error ?? `Server error ${res.status}`);
        return;
      }
      router.push('/admin/agents');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred';
      setRetireError(
        `Unable to retire agent. ${message}. Contact support@revealui.com if this persists.`,
      );
    } finally {
      setRetiring(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${apiUrl}/a2a/agents/${encodeURIComponent(agentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          systemPrompt: editSystemPrompt.trim(),
        }),
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setSaveError(json.error ?? `Server error ${res.status}`);
        return;
      }
      const data = (await res.json()) as { card: A2AAgentCard };
      setCard(data.card);
      setIsEditing(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred';
      setSaveError(
        `Unable to save agent. ${message}. Contact support@revealui.com if this persists.`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <LicenseGate feature="ai">
      <div className="min-h-screen">
        {/* Breadcrumb header */}
        <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <Breadcrumb
            items={[
              { label: 'Admin', href: '/admin' },
              { label: 'Agents', href: '/admin/agents' },
              { label: card?.name ?? agentId },
            ]}
          />
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400"
            >
              {error}
            </div>
          )}

          {card && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Agent metadata */}
              <div className="flex flex-col gap-6">
                {/* Identity */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  {isEditing ? (
                    <div className="flex flex-col gap-4">
                      <div>
                        <label
                          htmlFor="edit-name"
                          className="block text-xs font-medium text-zinc-400 mb-1.5"
                        >
                          Name
                        </label>
                        <input
                          id="edit-name"
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="edit-description"
                          className="block text-xs font-medium text-zinc-400 mb-1.5"
                        >
                          Description
                        </label>
                        <input
                          id="edit-description"
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="edit-system-prompt"
                          className="block text-xs font-medium text-zinc-400 mb-1.5"
                        >
                          System Prompt
                        </label>
                        <textarea
                          id="edit-system-prompt"
                          rows={7}
                          value={editSystemPrompt}
                          onChange={(e) => setEditSystemPrompt(e.target.value)}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none resize-none"
                        />
                      </div>
                      {saveError && (
                        <div
                          role="alert"
                          className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400"
                        >
                          {saveError}
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving || !editName.trim()}
                          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={handleEditCancel}
                          disabled={saving}
                          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <h1 className="text-xl font-semibold text-white">{card.name}</h1>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                            v{card.version}
                          </span>
                          <button
                            type="button"
                            onClick={handleEditStart}
                            disabled={loadingDef}
                            className="rounded-lg border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {loadingDef ? '...' : 'Edit'}
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-zinc-400">{card.description}</p>
                      {card.provider && (
                        <p className="mt-3 text-xs text-zinc-600">
                          by {card.provider.organization}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Capabilities */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
                    Capabilities
                  </h2>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-zinc-400">Streaming</dt>
                      <dd
                        className={
                          card.capabilities.streaming ? 'text-emerald-400' : 'text-zinc-600'
                        }
                      >
                        {card.capabilities.streaming ? 'yes' : 'no'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-400">Push Notifications</dt>
                      <dd
                        className={
                          card.capabilities.pushNotifications ? 'text-emerald-400' : 'text-zinc-600'
                        }
                      >
                        {card.capabilities.pushNotifications ? 'yes' : 'no'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-400">Auth</dt>
                      <dd className="text-zinc-300">{card.authentication.schemes.join(', ')}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-zinc-400">Input modes</dt>
                      <dd className="text-zinc-300">{card.defaultInputModes.join(', ')}</dd>
                    </div>
                  </dl>
                </div>

                {/* Skills */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
                    Skills ({card.skills.length})
                  </h2>
                  <ul className="space-y-3">
                    {card.skills.map((skill) => (
                      <li
                        key={skill.id}
                        className="border-t border-zinc-800 pt-3 first:border-0 first:pt-0"
                      >
                        <p className="font-mono text-sm font-medium text-zinc-200">{skill.id}</p>
                        <p className="mt-0.5 text-sm text-zinc-400">{skill.description}</p>
                        {skill.tags && skill.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {skill.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Agent Card JSON link */}
                <a
                  href={`${apiUrl}/.well-known/agents/${agentId}/agent.json`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-center text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
                >
                  View Agent Card JSON ↗
                </a>

                {/* Danger zone — built-in agents are protected */}
                {!BUILTIN_AGENTS.has(agentId) && (
                  <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-5">
                    <h2 className="mb-3 text-sm font-medium text-red-400">Danger Zone</h2>
                    {isConfirmingRetire ? (
                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-zinc-300">
                          Retire <strong className="text-white">{card.name}</strong>? This removes
                          the agent from the registry. This action cannot be undone.
                        </p>
                        {retireError && (
                          <div
                            role="alert"
                            className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400"
                          >
                            {retireError}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleRetire}
                            disabled={retiring}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {retiring ? 'Retiring...' : 'Confirm Retire'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsConfirmingRetire(false);
                              setRetireError(null);
                            }}
                            disabled={retiring}
                            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-zinc-500">
                          Remove this agent from the registry permanently.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsConfirmingRetire(true)}
                          className="shrink-0 rounded-lg border border-red-800 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:border-red-600 hover:text-red-300"
                        >
                          Retire Agent
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Task tester + history */}
              <div className="flex flex-col gap-6">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
                    Task Tester
                  </h2>
                  <TaskTester
                    agentId={agentId}
                    agentName={card.name}
                    onComplete={() => setTaskRefreshKey((k) => k + 1)}
                  />
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
                    Agent Memory
                    <span className="ml-2 text-xs font-normal normal-case text-zinc-600">live</span>
                  </h2>
                  <AgentMemory agentId={agentId} />
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
                    Task History
                  </h2>
                  <TaskHistory agentId={agentId} refreshKey={taskRefreshKey} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </LicenseGate>
  );
}
