'use client'

import { useShape } from '@electric-sql/react'
import { useElectricConfig } from '../provider/index.js'

const AGENT_ID_RE = /^[a-zA-Z0-9_-]+$/

export interface AgentMemoryRecord {
  id: string
  agent_id: string
  content: string
  type: string
  metadata: Record<string, unknown>
  created_at: string
  expires_at: string | null
}

export function useAgentMemory(agentId: string) {
  const { proxyBaseUrl } = useElectricConfig()
  const isValid = agentId.length > 0 && AGENT_ID_RE.test(agentId)

  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/agent-memories`,
    params: { agent_id: isValid ? agentId : '__invalid__' },
  })

  if (!isValid) {
    return {
      memories: [],
      isLoading: false,
      error: new Error(
        'Invalid agentId: must be non-empty alphanumeric, hyphens, underscores only',
      ),
    }
  }

  return {
    memories: Array.isArray(data) ? (data as unknown as AgentMemoryRecord[]) : [],
    isLoading,
    error: error as Error | null,
  }
}
