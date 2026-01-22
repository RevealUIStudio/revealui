/**
 * Collaboration Service
 *
 * Persistent conversation service using localStorage for immediate functionality.
 * Foundation for database integration with ElectricSQL real-time sync.
 */

import type { SyncClient } from '../client/index.js'
import type { ConversationMessage } from '@revealui/contracts/agents'
import { eq, desc, and } from 'drizzle-orm'
import { conversations } from '@revealui/db/core/agents'

// Database-backed conversation storage
interface StoredConversation {
  id: string
  userId: string
  agentId: string
  title?: string
  messages: ConversationMessage[]
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, unknown>
}

interface StoredSession {
  id: string
  documentId: string
  participants: string[]
  status: 'active' | 'inactive' | 'ended'
  createdAt: Date
  lastActivity: Date
}

export interface CollaborationService {
  /** Create new conversation */
  createConversation(conversation: Omit<StoredConversation, 'id' | 'createdAt' | 'updatedAt' | 'messages'>): Promise<StoredConversation>
  /** Get conversations for user */
  getConversations(userId: string, agentId?: string, limit?: number): Promise<StoredConversation[]>
  /** Send message to conversation */
  sendMessage(conversationId: string, message: ConversationMessage, userId: string): Promise<void>
  /** Get conversation history */
  getConversationHistory(conversationId: string): Promise<ConversationMessage[]>
  /** Update conversation */
  updateConversation(id: string, updates: Partial<Pick<StoredConversation, 'metadata'>>): Promise<StoredConversation | null>
  /** Delete conversation */
  deleteConversation(id: string): Promise<boolean>
  /** Create collaboration session */
  createSession(documentId: string, participants: string[]): Promise<StoredSession>
  /** Get active sessions */
  getActiveSessions(documentId: string): Promise<StoredSession[]>
}

/**
 * CollaborationService implementation using PostgreSQL database.
 * Provides persistent conversation storage with foundation for ElectricSQL real-time sync.
 */
export class CollaborationServiceImpl implements CollaborationService {
  constructor(private getClient: () => SyncClient) {}

  private get client(): SyncClient {
    return this.getClient()
  }

  private getStoredSessions(): StoredSession[] {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(this.SESSIONS_KEY)
      const parsed = stored ? JSON.parse(stored) : []
      return parsed.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        lastActivity: new Date(session.lastActivity)
      }))
    } catch {
      return []
    }
  }

  private saveSessions(sessions: StoredSession[]): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions))
    } catch {
      // Ignore storage errors
    }
  }

  async createConversation(conversation: Omit<StoredConversation, 'id' | 'createdAt' | 'updatedAt' | 'messages'>): Promise<StoredConversation> {
    const id = crypto.randomUUID()
    const now = new Date()

    // Insert into database
    await this.client.db.insert(conversations).values({
      id,
      sessionId: `${conversation.userId}-${conversation.agentId}-${Date.now()}`, // Generate session ID
      userId: conversation.userId,
      agentId: conversation.agentId,
      messages: [],
      status: 'active',
      metadata: {
        title: conversation.title,
        ...conversation.metadata,
      },
    })

    const newConversation: StoredConversation = {
      ...conversation,
      id,
      messages: [],
      createdAt: now,
      updatedAt: now,
    }

    return newConversation
  }

  async getConversations(userId: string, agentId?: string, limit = 20): Promise<StoredConversation[]> {
    // Build where conditions
    let whereConditions = eq(conversations.userId, userId)

    if (agentId) {
      whereConditions = and(whereConditions, eq(conversations.agentId, agentId))
    }

    // Query database
    const dbConversations = await this.client.db
      .select()
      .from(conversations)
      .where(whereConditions)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)

    return dbConversations.map(dbConv => ({
      id: dbConv.id,
      userId: dbConv.userId,
      agentId: dbConv.agentId,
      title: (dbConv.metadata as any)?.title,
      messages: (dbConv.messages as ConversationMessage[]) || [],
      createdAt: dbConv.createdAt,
      updatedAt: dbConv.updatedAt,
      metadata: dbConv.metadata as Record<string, unknown>,
    }))
  }

  async sendMessage(conversationId: string, message: ConversationMessage, userId: string): Promise<void> {
    // Get current conversation
    const [conversation] = await this.client.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)

    if (!conversation) {
      throw new Error('Conversation not found')
    }

    // Update messages array
    const currentMessages = (conversation.messages as ConversationMessage[]) || []
    const updatedMessages = [...currentMessages, message]

    // Update database
    await this.client.db
      .update(conversations)
      .set({
        messages: updatedMessages,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
  }

  async getConversationHistory(conversationId: string): Promise<ConversationMessage[]> {
    const [conversation] = await this.client.db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)

    if (!conversation) {
      throw new Error('Conversation not found')
    }

    return (conversation.messages as ConversationMessage[]) || []
  }

  async updateConversation(id: string, updates: Partial<Pick<StoredConversation, 'metadata'>>): Promise<StoredConversation | null> {
    // Update database
    const result = await this.client.db
      .update(conversations)
      .set({
        metadata: updates.metadata,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id))
      .returning()

    if (result.length === 0) return null

    const dbConv = result[0]
    return {
      id: dbConv.id,
      userId: dbConv.userId,
      agentId: dbConv.agentId,
      title: (dbConv.metadata as any)?.title,
      messages: (dbConv.messages as ConversationMessage[]) || [],
      createdAt: dbConv.createdAt,
      updatedAt: dbConv.updatedAt,
      metadata: dbConv.metadata as Record<string, unknown>,
    }
  }

  async deleteConversation(id: string): Promise<boolean> {
    const result = await this.client.db
      .delete(conversations)
      .where(eq(conversations.id, id))

    return result.rowCount > 0
  }

  async createSession(documentId: string, participants: string[]): Promise<StoredSession> {
    const sessionId = crypto.randomUUID()
    const now = new Date()

    const session: StoredSession = {
      id: sessionId,
      documentId,
      participants,
      status: 'active',
      createdAt: now,
      lastActivity: now,
    }

    const sessions = this.getStoredSessions()
    sessions.push(session)
    this.saveSessions(sessions)

    return session
  }

  async getActiveSessions(documentId: string): Promise<StoredSession[]> {
    return this.getStoredSessions()
      .filter(session => session.documentId === documentId && session.status === 'active')
  }
}