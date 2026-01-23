/**
 * Conversation Operations for ElectricSQL Sync
 *
 * CRUD operations for conversations with ElectricSQL integration.
 */

import type { Conversation, ConversationMessage, Message } from '@revealui/contracts/agents'
import type { DatabaseClient as Database } from '@revealui/db'
import { conversations, messages } from '@revealui/db/core'
import { desc, eq } from 'drizzle-orm'

// Type definitions for database operations
type NewConversation = Omit<Conversation, 'id' | 'createdAt' | 'updatedAt' | 'messages'>
type NewMessage = Omit<Message, 'id' | 'timestamp'>

export interface ConversationOperations {
  // Create new conversation
  create(data: { userId: string; agentId: string; title?: string }): Promise<Conversation>

  // Get conversation by ID
  getById(id: string): Promise<Conversation | null>

  // Get conversations for user
  getByUser(userId: string, options?: { limit?: number; agentId?: string }): Promise<Conversation[]>

  // Update conversation
  update(id: string, data: Partial<Conversation>): Promise<Conversation>

  // Delete conversation
  delete(id: string): Promise<void>

  // Add message to conversation
  addMessage(conversationId: string, message: NewMessage): Promise<Message>

  // Get messages for conversation
  getMessages(conversationId: string, options?: { limit?: number }): Promise<Message[]>
}

export class ConversationOperationsImpl implements ConversationOperations {
  constructor(private db: Database) {}

  async create(data: { userId: string; agentId: string; title?: string }): Promise<Conversation> {
    const result = await this.db
      .insert(conversations)
      .values({
        userId: data.userId,
        agentId: data.agentId,
        title: data.title,
        status: 'active',
        version: 1,
      })
      .returning()

    if (!result.length) {
      throw new Error('Failed to create conversation')
    }

    return result[0] as Conversation
  }

  async getById(id: string): Promise<Conversation | null> {
    const result = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1)

    return result.length ? (result[0] as Conversation) : null
  }

  async getByUser(
    userId: string,
    options: { limit?: number; agentId?: string } = {},
  ): Promise<Conversation[]> {
    const { limit = 50, agentId } = options

    let query = this.db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)

    if (agentId) {
      query = query.where(eq(conversations.agentId, agentId))
    }

    const result = await query
    return result as Conversation[]
  }

  async update(id: string, data: Partial<Conversation>): Promise<Conversation> {
    const result = await this.db
      .update(conversations)
      .set({
        ...data,
        updatedAt: new Date(),
        version: data.version ? data.version + 1 : undefined,
      })
      .where(eq(conversations.id, id))
      .returning()

    if (!result.length) {
      throw new Error(`Conversation ${id} not found`)
    }

    return result[0] as Conversation
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(conversations).where(eq(conversations.id, id))
  }

  async addMessage(conversationId: string, message: NewMessage): Promise<Message> {
    // First verify conversation exists
    const conversation = await this.getById(conversationId)
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`)
    }

    const result = await this.db
      .insert(messages)
      .values({
        conversationId,
        ...message,
      })
      .returning()

    if (!result.length) {
      throw new Error('Failed to add message')
    }

    // Update conversation's updated_at timestamp
    await this.update(conversationId, {})

    return result[0] as Message
  }

  async getMessages(conversationId: string, options: { limit?: number } = {}): Promise<Message[]> {
    const { limit = 100 } = options

    const result = await this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.timestamp)
      .limit(limit)

    return result as Message[]
  }
}

export function createConversationOperations(db: Database): ConversationOperations {
  return new ConversationOperationsImpl(db)
}
