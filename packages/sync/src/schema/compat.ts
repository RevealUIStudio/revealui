/**
 * Schema Compatibility Layer
 *
 * Provides type conversion between @revealui/schema Zod types
 * and ElectricSQL database types.
 */

import type {
  AgentContext as ZodAgentContext,
  AgentMemory as ZodAgentMemory,
  Conversation as ZodConversation,
} from '@revealui/schema'
import type { AgentContext, AgentMemory, Conversation } from '../schema'

// =============================================================================
// Type Conversions
// =============================================================================

/**
 * Converts Zod AgentContext to ElectricSQL AgentContext.
 */
export function zodToElectricAgentContext(zod: ZodAgentContext): AgentContext {
  return {
    id: zod.id,
    version: zod.version,
    session_id: zod.sessionId,
    agent_id: zod.agentId,
    context: zod.context,
    priority: zod.priority,
    created_at: new Date(zod.createdAt),
    updated_at: new Date(zod.updatedAt),
  }
}

/**
 * Converts ElectricSQL AgentContext to Zod AgentContext.
 */
export function electricToZodAgentContext(electric: AgentContext): ZodAgentContext {
  return {
    id: electric.id,
    version: electric.version,
    sessionId: electric.session_id,
    agentId: electric.agent_id,
    context: electric.context || {},
    priority: electric.priority || 0.5,
    createdAt: electric.created_at.toISOString(),
    updatedAt: electric.updated_at.toISOString(),
  }
}

/**
 * Converts Zod AgentMemory to ElectricSQL AgentMemory.
 */
export function zodToElectricAgentMemory(zod: ZodAgentMemory): AgentMemory {
  return {
    id: zod.id,
    version: zod.version,
    content: zod.content,
    type: zod.type,
    source: zod.source as Record<string, unknown>,
    metadata: zod.metadata || null,
    access_count: zod.accessCount,
    accessed_at: zod.accessedAt ? new Date(zod.accessedAt) : null,
    verified: zod.verified,
    verified_by: null, // Not in Zod schema
    verified_at: null, // Not in Zod schema
    site_id: zod.metadata?.siteId || null,
    agent_id: null, // Not directly in Zod schema
    created_at: new Date(zod.createdAt),
    expires_at: zod.metadata?.expiresAt ? new Date(zod.metadata.expiresAt as string) : null,
  }
}

/**
 * Converts ElectricSQL AgentMemory to Zod AgentMemory.
 */
export function electricToZodAgentMemory(electric: AgentMemory): ZodAgentMemory {
  return {
    id: electric.id,
    version: electric.version,
    content: electric.content,
    type: electric.type as ZodAgentMemory['type'],
    source: electric.source as ZodAgentMemory['source'],
    embedding: undefined, // Not in ElectricSQL schema (vector type)
    metadata: {
      ...(electric.metadata || {}),
      siteId: electric.site_id || undefined,
      pageId: undefined,
      blockId: undefined,
      importance: 0.5,
      expiresAt: electric.expires_at?.toISOString(),
    },
    createdAt: electric.created_at.toISOString(),
    accessedAt: electric.accessed_at?.toISOString() || electric.created_at.toISOString(),
    accessCount: electric.access_count || 0,
    verified: electric.verified || false,
  }
}

/**
 * Converts Zod Conversation to ElectricSQL Conversation.
 */
export function zodToElectricConversation(zod: ZodConversation): Conversation {
  return {
    id: zod.id,
    version: zod.version,
    session_id: zod.sessionId,
    user_id: zod.userId,
    agent_id: zod.agentId,
    messages: zod.messages as unknown[],
    status: zod.status,
    metadata: zod.metadata || null,
    created_at: new Date(zod.createdAt),
    updated_at: new Date(zod.updatedAt),
  }
}

/**
 * Converts ElectricSQL Conversation to Zod Conversation.
 */
export function electricToZodConversation(electric: Conversation): ZodConversation {
  return {
    id: electric.id,
    version: electric.version,
    sessionId: electric.session_id,
    userId: electric.user_id,
    agentId: electric.agent_id,
    messages: (electric.messages || []) as ZodConversation['messages'],
    status: electric.status as ZodConversation['status'],
    metadata: electric.metadata || undefined,
    createdAt: electric.created_at.toISOString(),
    updatedAt: electric.updated_at.toISOString(),
  }
}
