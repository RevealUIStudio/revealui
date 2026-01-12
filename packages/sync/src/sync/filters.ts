/**
 * ElectricSQL Filter Utilities
 *
 * Helper functions for creating secure filters for sync shapes.
 */

// =============================================================================
// Filter Types
// =============================================================================

export interface AgentContextFilter {
  agent_id: string
  session_id?: string
}

export interface AgentMemoryFilter {
  agent_id: string
  site_id?: string
  type?: string
  verified?: boolean
}

export interface ConversationFilter {
  user_id: string
  agent_id?: string
  status?: string
}

// =============================================================================
// Filter Builders
// =============================================================================

/**
 * Creates a filter for agent contexts.
 */
export function createAgentContextFilter(agentId: string, sessionId?: string): AgentContextFilter {
  return {
    agent_id: agentId,
    ...(sessionId && { session_id: sessionId }),
  }
}

/**
 * Creates a filter for agent memories.
 */
export function createAgentMemoryFilter(
  agentId: string,
  options?: {
    siteId?: string
    type?: string
    verified?: boolean
  },
): AgentMemoryFilter {
  return {
    agent_id: agentId,
    ...(options?.siteId && { site_id: options.siteId }),
    ...(options?.type && { type: options.type }),
    ...(options?.verified !== undefined && { verified: options.verified }),
  }
}

/**
 * Creates a filter for conversations.
 */
export function createConversationFilter(
  userId: string,
  options?: {
    agentId?: string
    status?: string
  },
): ConversationFilter {
  return {
    user_id: userId,
    ...(options?.agentId && { agent_id: options.agentId }),
    ...(options?.status && { status: options.status }),
  }
}
