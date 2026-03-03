'use client'

import type { A2AAgentCard } from '@revealui/contracts'
import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { TaskTester } from '@/lib/components/agents/task-tester'
import { LicenseGate } from '@/lib/components/LicenseGate'

interface PageProps {
  params: Promise<{ agentId: string }>
}

export default function AgentDetailPage({ params }: PageProps) {
  const { agentId } = use(params)
  const [card, setCard] = useState<A2AAgentCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim()

  useEffect(() => {
    fetch(`${apiUrl}/a2a/agents/${encodeURIComponent(agentId)}`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`Agent '${agentId}' not found`)
        return r.json()
      })
      .then((data: A2AAgentCard) => setCard(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load agent'))
      .finally(() => setLoading(false))
  }, [agentId, apiUrl])

  return (
    <LicenseGate feature="ai" featureLabel="AI Agents">
      <div className="min-h-screen">
        {/* Breadcrumb header */}
        <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <Link
            href="/admin/agents"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Agents
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-sm text-white">{agentId}</span>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {card && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Agent metadata */}
              <div className="flex flex-col gap-6">
                {/* Identity */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h1 className="text-xl font-semibold text-white">{card.name}</h1>
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                      v{card.version}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">{card.description}</p>
                  {card.provider && (
                    <p className="mt-3 text-xs text-zinc-600">by {card.provider.organization}</p>
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
              </div>

              {/* Right: Task tester */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500">
                  Task Tester
                </h2>
                <TaskTester agentId={agentId} agentName={card.name} />
              </div>
            </div>
          )}
        </div>
      </div>
    </LicenseGate>
  )
}
