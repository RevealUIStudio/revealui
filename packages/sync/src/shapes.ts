/**
 * ElectricSQL Shape Definitions
 *
 * Shape definitions for ElectricSQL sync using proper HTTP shape API.
 * These define what data gets synced and how it's filtered.
 */

// ElectricSQL Shape definition
export interface ShapeParams {
  table: string
  where?: string
  columns?: string[]
  orderBy?: string
  limit?: number
}

// Shape parameter definitions for ElectricSQL HTTP shapes
export interface AgentShapeParams extends Omit<ShapeParams, 'table'> {
  /** Filter by user ID */
  userId?: string
  /** Filter by agent ID */
  agentId?: string
  /** Additional where clause */
  where?: string
  /** Columns to include */
  columns?: string[]
}

/**
 * Create shape params for agent contexts
 */
export function createAgentContextsShape(params: AgentShapeParams = {}): ShapeParams {
  const { userId, agentId, where, columns } = params

  let shapeWhere = where || ''
  if (userId) {
    shapeWhere = shapeWhere ? `${shapeWhere} AND user_id = '${userId}'` : `user_id = '${userId}'`
  }
  if (agentId) {
    shapeWhere = shapeWhere ? `${shapeWhere} AND agent_id = '${agentId}'` : `agent_id = '${agentId}'`
  }

  return {
    table: 'agent_contexts',
    where: shapeWhere || undefined,
    columns,
  }
}

/**
 * Create shape params for agent memories
 */
export function createAgentMemoriesShape(params: AgentShapeParams = {}): ShapeParams {
  const { userId, agentId, where, columns } = params

  let shapeWhere = "expires_at IS NULL OR expires_at > NOW()"
  if (where) {
    shapeWhere += ` AND (${where})`
  }
  if (userId) {
    shapeWhere += ` AND agent_id = '${userId}'` // Note: using agentId for user filtering
  }
  if (agentId) {
    shapeWhere += ` AND agent_id = '${agentId}'`
  }

  return {
    table: 'agent_memories',
    where: shapeWhere,
    columns,
  }
}

/**
 * Create shape params for conversations
 */
export function createConversationsShape(params: AgentShapeParams = {}): ShapeParams {
  const { userId, agentId, where, columns } = params

  let shapeWhere = where || ''
  if (userId) {
    shapeWhere = shapeWhere ? `${shapeWhere} AND user_id = '${userId}'` : `user_id = '${userId}'`
  }
  if (agentId) {
    shapeWhere = shapeWhere ? `${shapeWhere} AND agent_id = '${agentId}'` : `agent_id = '${agentId}'`
  }

  return {
    table: 'conversations',
    where: shapeWhere || undefined,
    columns,
  }
}

/**
 * Create shape params for user devices (multi-device sync)
 */
export function createUserDevicesShape(params: AgentShapeParams = {}): ShapeParams {
  const { userId, where, columns } = params

  let shapeWhere = where || ''
  if (userId) {
    shapeWhere = shapeWhere ? `${shapeWhere} AND user_id = '${userId}'` : `user_id = '${userId}'`
  }

  return {
    table: 'user_devices',
    where: shapeWhere || undefined,
    columns,
  }
}

/**
 * Create shape params for sync metadata
 */
export function createSyncMetadataShape(params: AgentShapeParams = {}): ShapeParams {
  const { userId, where, columns } = params

  let shapeWhere = where || ''
  if (userId) {
    shapeWhere = shapeWhere ? `${shapeWhere} AND user_id = '${userId}'` : `user_id = '${userId}'`
  }

  return {
    table: 'sync_metadata',
    where: shapeWhere || undefined,
    columns,
  }
}

/**
 * Create shape params for agent actions
 */
export function createAgentActionsShape(params: AgentShapeParams = {}): ShapeParams {
  const { userId, agentId, where, columns } = params

  let shapeWhere = where || ''
  if (userId) {
    shapeWhere = shapeWhere ? `${shapeWhere} AND agent_id = '${userId}'` : `agent_id = '${userId}'`
  }
  if (agentId) {
    shapeWhere = shapeWhere ? `${shapeWhere} AND agent_id = '${agentId}'` : `agent_id = '${agentId}'`
  }

  return {
    table: 'agent_actions',
    where: shapeWhere || undefined,
    columns,
  }
}

/**
 * Create all agent-related shapes
 */
export function createAllAgentShapes(params: AgentShapeParams = {}): ShapeParams[] {
  return [
    createAgentContextsShape(params),
    createAgentMemoriesShape(params),
    createConversationsShape(params),
    createAgentActionsShape(params),
    createUserDevicesShape(params),
    createSyncMetadataShape(params),
  ]
}

/**
 * Create shapes for multi-device sync
 */
export function createMultiDeviceShapes(userId: string): ShapeParams[] {
  return [
    createConversationsShape({ userId }),
    createUserDevicesShape({ userId }),
    createSyncMetadataShape({ userId }),
    createAgentMemoriesShape({ userId }),
  ]
}

/**
 * Create optimized shapes for real-time collaboration
 */
export function createRealtimeCollaborationShapes(userId: string, agentId?: string): ShapeParams[] {
  const baseParams = { userId, agentId }

  return [
    // Active conversations with recent updates
    {
      table: 'conversations',
      where: `user_id = '${userId}' AND status = 'active' AND updated_at > NOW() - INTERVAL '1 hour'`,
      orderBy: 'updated_at DESC',
    },
    // Recent memories for context
    createAgentMemoriesShape({
      ...baseParams,
      where: "expires_at IS NULL OR expires_at > NOW()",
    }),
    // Device sync status
    createUserDevicesShape({ userId }),
  ]
}