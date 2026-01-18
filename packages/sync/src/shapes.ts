/**
 * Sync Shapes
 *
 * Definitions and creation functions for ElectricSQL sync shapes
 * for agent tables and real-time data synchronization.
 */

// Sync shape definitions for ElectricSQL
export interface SyncShape {
  table: string
  shape: string
  where?: string
  include?: string[]
}

// Create sync shapes for agent tables
export function createAgentContextsShape(): SyncShape {
  return {
    table: 'agent_contexts',
    shape: 'agent_contexts',
    include: ['user', 'agent'],
  }
}

export function createAgentMemoriesShape(): SyncShape {
  return {
    table: 'agent_memories',
    shape: 'agent_memories',
    where: 'expires_at IS NULL OR expires_at > NOW()',
    include: ['user', 'agent'],
  }
}

export function createConversationsShape(): SyncShape {
  return {
    table: 'conversations',
    shape: 'conversations',
    include: ['user', 'messages'],
  }
}

export function createMessagesShape(): SyncShape {
  return {
    table: 'messages',
    shape: 'messages',
    include: ['conversation'],
  }
}

// Sync all agent-related tables
export function createAllAgentShapes(): SyncShape[] {
  return [
    createAgentContextsShape(),
    createAgentMemoriesShape(),
    createConversationsShape(),
    createMessagesShape(),
  ]
}