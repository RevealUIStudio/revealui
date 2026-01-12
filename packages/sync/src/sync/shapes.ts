/**
 * ElectricSQL Sync Shapes
 *
 * Defines sync shapes for agent tables with security filters.
 * Sync shapes determine which data is replicated to the client.
 */

// Shape types will be available after ElectricSQL client generation
// import type { Shape } from 'electric-sql/client'

// =============================================================================
// Shape Types
// =============================================================================

/**
 * Shape for syncing agent contexts.
 * Filters by agentId and sessionId for security.
 */
export interface AgentContextsShape {
  table: 'agent_contexts'
  filter: {
    agent_id: string
    session_id?: string
  }
}

/**
 * Shape for syncing agent memories.
 * Filters by agentId, with optional siteId filter.
 */
export interface AgentMemoriesShape {
  table: 'agent_memories'
  filter: {
    agent_id: string
    site_id?: string
  }
}

/**
 * Shape for syncing conversations.
 * Filters by userId and optional agentId.
 */
export interface ConversationsShape {
  table: 'conversations'
  filter: {
    user_id: string
    agent_id?: string
  }
}

// =============================================================================
// Shape Factory Functions
// =============================================================================

/**
 * Creates a sync shape for agent contexts.
 *
 * @param agentId - Agent ID to filter by (required)
 * @param sessionId - Optional session ID to filter by
 * @returns Sync shape configuration
 */
export function createAgentContextsShape(agentId: string, sessionId?: string): AgentContextsShape {
  return {
    table: 'agent_contexts',
    filter: {
      agent_id: agentId,
      ...(sessionId && { session_id: sessionId }),
    },
  }
}

/**
 * Creates a sync shape for agent memories.
 *
 * @param agentId - Agent ID to filter by (required)
 * @param siteId - Optional site ID to filter by
 * @returns Sync shape configuration
 */
export function createAgentMemoriesShape(agentId: string, siteId?: string): AgentMemoriesShape {
  return {
    table: 'agent_memories',
    filter: {
      agent_id: agentId,
      ...(siteId && { site_id: siteId }),
    },
  }
}

/**
 * Creates a sync shape for conversations.
 *
 * @param userId - User ID to filter by (required)
 * @param agentId - Optional agent ID to filter by
 * @returns Sync shape configuration
 */
export function createConversationsShape(userId: string, agentId?: string): ConversationsShape {
  return {
    table: 'conversations',
    filter: {
      user_id: userId,
      ...(agentId && { agent_id: agentId }),
    },
  }
}
