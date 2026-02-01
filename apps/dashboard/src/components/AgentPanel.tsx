'use client'

import { useState } from 'react'
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

export function AgentPanel() {
  const [agents] = useState<Agent[]>([
    {
      id: 'content-writer',
      name: 'Content Writer',
      type: 'content',
      status: 'active',
      lastMessage: 'Draft created successfully',
    },
    {
      id: 'seo-optimizer',
      name: 'SEO Optimizer',
      type: 'seo',
      status: 'idle',
    },
    {
      id: 'data-analyst',
      name: 'Data Analyst',
      type: 'analytics',
      status: 'idle',
    },
  ])

  const [conversations] = useState<Conversation[]>([
    {
      id: 'conv-1',
      agentId: 'content-writer',
      title: 'Homepage copy optimization',
      lastActivity: new Date(),
      messageCount: 12,
    },
    {
      id: 'conv-2',
      agentId: 'seo-optimizer',
      title: 'Meta tags analysis',
      lastActivity: new Date(Date.now() - 3600000), // 1 hour ago
      messageCount: 8,
    },
  ])

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
        <>
          {/* Header */}
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-3">AI Agents</h2>

        {/* New Agent Button */}
        <button
          type="button"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <span>+</span>
          New Agent
        </button>
      </div>

      {/* Agents List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
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
                    ? 'bg-blue-600 text-white'
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

        {/* Conversations List */}
        <div className="p-4 border-t border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
            Recent Conversations
          </h3>
          <div className="space-y-2">
            {conversations.map((conv) => {
              const agent = agents.find((a) => a.id === conv.agentId)
              return (
                <div
                  key={conv.id}
                  className="p-3 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-sm mt-0.5">{getAgentIcon(agent?.type || 'general')}</span>
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
        </>
      )}
    </div>
  )
}
