'use client'

import { useShape } from '@electric-sql/react'
import { useElectricConfig } from '../provider/index.js'

export interface AgentContextRecord {
  id: string
  session_id: string
  agent_id: string
  context: Record<string, unknown>
  priority: number
  created_at: string
  updated_at: string
}

export function useAgentContexts() {
  const { proxyBaseUrl } = useElectricConfig()
  const { data, isLoading, error } = useShape({
    url: `${proxyBaseUrl}/api/shapes/agent-contexts`,
  })

  return {
    contexts: Array.isArray(data) ? (data as unknown as AgentContextRecord[]) : [],
    isLoading,
    error: error as Error | null,
  }
}
