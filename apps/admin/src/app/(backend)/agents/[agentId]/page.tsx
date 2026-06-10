'use client';

import type { A2AAgentCard } from '@revealui/contracts';
import { Breadcrumb } from '@revealui/presentation/client';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, use, useEffect, useState } from 'react';
import { AgentContexts } from '@/lib/components/agents/agent-contexts';
import { AgentMemory } from '@/lib/components/agents/agent-memory';
import { TaskHistory } from '@/lib/components/agents/task-history';
import { TaskTester } from '@/lib/components/agents/task-tester';
import { LicenseGate } from '@/lib/components/LicenseGate';
import { apiFetch } from '@/lib/utils/csrf';

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
      const res = await apiFetch(`${apiUrl}/a2a/agents/${encodeURIComponent(agentId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setRetireError(json.error ?? `Server error ${res.status}`);
        return;
      }
      router.push('/agents');
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
      const res = await apiFetch(`${apiUrl}/a2a/agents/${encodeURIComponent(agentId)}`, {
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
        <div className="border-b border-border bg-card px-6 py-4">
          <Breadcrumb
            items={[
              { label: 'Admin', href: '/' },
              { label: 'Agents', href: '/agents' },
              { label: card?.name ?? agentId },
            ]}
          />
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error"
            >
              {error}
            </div>
          )}

          {card && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Agent metadata */}
              <div className="flex flex-col gap-6">
                {/* Identity */}
                <div className="rounded-xl border border-border bg-card p-5">
                  {isEditing ? (
                    <div className="flex flex-col gap-4">
                      <div>
                        <label
                          htmlFor="edit-name"
                          className="block text-xs font-medium text-muted-foreground mb-1.5"
                        >
                          Name
                        </label>
                        <input
                          id="edit-name"
                          type="text"
                          value={editName}
                          onChange={(
                            e: ChangeEvent<
                              HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                            >,
                          ) => setEditName(e.target.value)}
                          className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="edit-description"
                          className="block text-xs font-medium text-muted-foreground mb-1.5"
                        >
                          Description
                        </label>
                        <input
                          id="edit-description"
                          type="text"
                          value={editDescription}
                          onChange={(
                            e: ChangeEvent<
                              HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                            >,
                          ) => setEditDescription(e.target.value)}
                          className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="edit-system-prompt"
                          className="block text-xs font-medium text-muted-foreground mb-1.5"
                        >
                          System Prompt
                        </label>
                        <textarea
                          id="edit-system-prompt"
                          rows={7}
                          value={editSystemPrompt}
                          onChange={(
                            e: ChangeEvent<
                              HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                            >,
                          ) => setEditSystemPrompt(e.target.value)}
                          className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none resize-none"
                        />
                      </div>
                      {saveError && (
                        <div
                          role="alert"
                          className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error"
                        >
                          {saveError}
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving || !editName.trim()}
                          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={handleEditCancel}
                          disabled={saving}
                          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <h1 className="text-xl font-semibold text-foreground">{card.name}</h1>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                            v{card.version}
                          </span>
                          <button
                            type="button"
                            onClick={handleEditStart}
                            disabled={loadingDef}
                            className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {loadingDef ? '...' : 'Edit'}
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
                      {card.provider && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          by {card.provider.organization}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Capabilities */}
                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Capabilities
                  </h2>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Streaming</dt>
                      <dd
                        className={
                          card.capabilities.streaming ? 'text-success' : 'text-muted-foreground'
                        }
                      >
                        {card.capabilities.streaming ? 'yes' : 'no'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Push Notifications</dt>
                      <dd
                        className={
                          card.capabilities.pushNotifications
                            ? 'text-success'
                            : 'text-muted-foreground'
                        }
                      >
                        {card.capabilities.pushNotifications ? 'yes' : 'no'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Auth</dt>
                      <dd className="text-muted-foreground">
                        {card.authentication.schemes.join(', ')}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Input modes</dt>
                      <dd className="text-muted-foreground">{card.defaultInputModes.join(', ')}</dd>
                    </div>
                  </dl>
                </div>

                {/* Skills */}
                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Skills ({card.skills.length})
                  </h2>
                  <ul className="space-y-3">
                    {card.skills.map((skill) => (
                      <li
                        key={skill.id}
                        className="border-t border-border pt-3 first:border-0 first:pt-0"
                      >
                        <p className="font-mono text-sm font-medium text-muted-foreground">
                          {skill.id}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{skill.description}</p>
                        {skill.tags && skill.tags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {skill.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
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
                  className="rounded-lg border border-border bg-muted px-4 py-2.5 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/80"
                >
                  View Agent Card JSON ↗
                </a>

                {/* Danger zone  -  built-in agents are protected */}
                {!BUILTIN_AGENTS.has(agentId) && (
                  <div className="rounded-xl border border-error/30 bg-error/10 p-5">
                    <h2 className="mb-3 text-sm font-medium text-error">Danger Zone</h2>
                    {isConfirmingRetire ? (
                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-muted-foreground">
                          Retire <strong className="text-foreground">{card.name}</strong>? This
                          removes the agent from the registry. This action cannot be undone.
                        </p>
                        {retireError && (
                          <div
                            role="alert"
                            className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error"
                          >
                            {retireError}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleRetire}
                            disabled={retiring}
                            className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
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
                            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-muted-foreground">
                          Remove this agent from the registry permanently.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsConfirmingRetire(true)}
                          className="shrink-0 rounded-lg border border-error/30 px-3 py-1.5 text-sm font-medium text-error transition-colors hover:border-error/50 hover:text-error"
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
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      Task Tester
                    </h2>
                    <a
                      href={`/agents/${encodeURIComponent(agentId)}/run`}
                      className="rounded-md border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-success transition-colors hover:bg-success/20"
                      title="Stream agent execution live (Stage 5 surface)"
                    >
                      Watch live ↗
                    </a>
                  </div>
                  <TaskTester
                    agentId={agentId}
                    agentName={card.name}
                    onComplete={() => setTaskRefreshKey((k) => k + 1)}
                  />
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Agent Memory
                    <span className="ml-2 text-xs font-normal normal-case text-muted-foreground">
                      live
                    </span>
                  </h2>
                  <AgentMemory agentId={agentId} />
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Task History
                  </h2>
                  <TaskHistory agentId={agentId} refreshKey={taskRefreshKey} />
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Agent Contexts
                    <span className="ml-2 text-xs font-normal normal-case text-muted-foreground">
                      live
                    </span>
                  </h2>
                  <AgentContexts agentId={agentId} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </LicenseGate>
  );
}
