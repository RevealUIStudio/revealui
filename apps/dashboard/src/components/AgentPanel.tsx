'use client'

import { useEffect, useState } from 'react'
import { ChatInterface } from './ChatInterface.js'

interface Agent {
  id: string
  name: string
  type: 'content' | 'seo' | 'analytics' | 'general'
  status: 'active' | 'idle'
  lastMessage?: string
}

interface Conversation {
  id: string
  agentId: string
  title: string
  lastActivity: Date
  messageCount: number
}

// CMS API response shape for the Conversations collection
interface CMSConversation {
  id: string
  title?: string
  agentId?: string
  updatedAt?: string
  messages?: unknown[]
}

const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL || 'http://localhost:4000'

const DEFAULT_AGENTS: Agent[] = [
  { id: 'content-writer', name: 'Content Writer', type: 'content', status: 'active' },
  { id: 'seo-optimizer', name: 'SEO Optimizer', type: 'seo', status: 'idle' },
  { id: 'data-analyst', name: 'Data Analyst', type: 'analytics', status: 'idle' },
]

export function AgentPanel() {
  const [agents] = useState<Agent[]>(DEFAULT_AGENTS)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchConversations() {
      try {
        const res = await fetch(`${CMS_URL}/api/conversations?limit=20&sort=-updatedAt`, {
          headers: { 'Content-Type': 'application/json' },
          // Soft failure: if CMS is not running, don't block the UI
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) return
        const data = (await res.json()) as { docs?: CMSConversation[] }
        if (cancelled) return
        const mapped: Conversation[] = (data.docs ?? []).map((c) => ({
          id: c.id,
          agentId: c.agentId ?? 'general',
          title: c.title ?? 'Untitled conversation',
          lastActivity: new Date(c.updatedAt ?? Date.now()),
          messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
        }))
        setConversations(mapped)
      } catch {
        // CMS not available — silently fall back to empty list
      } finally {
        if (!cancelled) setLoadingConversations(false)
      }
    }

    void fetchConversations()
    return () => {
      cancelled = true
    }
  }, [])

  const [activeAgent, setActiveAgent] = useState<string>('content-writer')
  const [showChat, setShowChat] = useState(false)

  const getAgentIcon = (type: Agent['type']) => {
    switch (type) {
      case 'content':
        return '📝'
      case 'seo':
        return '🔍'
      case 'analytics':
        return '📊'
      default:
        return '🤖'
    }
  }

  return (
    <div className="h-full bg-gray-800 flex flex-col">
      {showChat ? (
        <>
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-700 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowChat(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back
            </button>
            <h2 className="text-lg font-semibold text-white">
              {agents.find((a) => a.id === activeAgent)?.name}
            </h2>
          </div>
          <ChatInterface />
        </>
      ) : (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-700 flex flex-col">
            <h2 className="text-lg font-semibold text-white mb-3">AI Agents</h2>

            {/* New Agent Button */}
            <button
              type="button"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>+</span>
              New Agent
            </button>

            {/* Active Agents Section */}
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                Active Agents
              </h3>
              <div className="space-y-2">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setActiveAgent(agent.id)
                      setShowChat(true)
                    }}
                    type="button"
                    aria-pressed={activeAgent === agent.id}
                    className={`w-full text-left p-3 rounded-lg cursor-pointer transition-colors ${
                      activeAgent === agent.id
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getAgentIcon(agent.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{agent.name}</div>
                        {agent.lastMessage && (
                          <div className="text-xs opacity-75 truncate">{agent.lastMessage}</div>
                        )}
                      </div>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          agent.status === 'active' ? 'bg-green-400' : 'bg-gray-500'
                        }`}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-t border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                Recent Conversations
              </h3>
              <div className="space-y-2">
                {loadingConversations && (
                  <p className="text-xs text-gray-500 italic">Loading conversations…</p>
                )}
                {!loadingConversations && conversations.length === 0 && (
                  <p className="text-xs text-gray-500 italic">No conversations yet.</p>
                )}
                {conversations.map((conv) => {
                  const agent = agents.find((a) => a.id === conv.agentId)
                  return (
                    <div
                      key={conv.id}
                      className="p-3 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-sm mt-0.5">
                          {getAgentIcon(agent?.type || 'general')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{conv.title}</div>
                          <div className="text-xs text-gray-500">
                            {conv.messageCount} messages • {conv.lastActivity.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
