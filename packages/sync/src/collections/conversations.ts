/**
 * Conversation Collection - ElectricSQL Integration
 *
 * Simplified ElectricSQL integration for conversation sync.
 */

import { z } from 'zod'
import type { ConversationMessage } from '@revealui/contracts/agents'

// Conversation schema for type safety
export const conversationMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
})

export const conversationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  agentId: z.string(),
  title: z.string().optional(),
  messages: z.array(conversationMessageSchema),
  status: z.enum(['active', 'completed', 'abandoned']),
  createdAt: z.date(),
  updatedAt: z.date(),
  deviceId: z.string().optional(),
  lastSyncedAt: z.date().optional(),
  version: z.number().default(1),
})

export type Conversation = z.infer<typeof conversationSchema>

// Shape configuration for ElectricSQL conversations
export const conversationShape = {
  table: 'conversations',
  // where clause will be set dynamically based on userId
  getWhereClause: (userId: string) => `user_id = '${userId}'`,
  orderBy: 'updated_at DESC',
}

// Utility functions for conversation operations
export const conversationUtils = {
  // Create a new conversation
  createConversation: (userId: string, agentId: string, title?: string): Omit<Conversation, 'messages'> => ({
    id: crypto.randomUUID(),
    userId,
    agentId,
    title,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  }),

  // Add a message to a conversation
  addMessage: (conversation: Conversation, message: ConversationMessage): Conversation => ({
    ...conversation,
    messages: [...conversation.messages, message],
    updatedAt: new Date(),
  }),

  // Update conversation status
  updateStatus: (conversation: Conversation, status: Conversation['status']): Conversation => ({
    ...conversation,
    status,
    updatedAt: new Date(),
  }),
}

export default conversationShape