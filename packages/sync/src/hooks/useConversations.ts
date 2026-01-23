/**
 * useConversations Hook
 *
 * React hook for conversation management using database storage.
 * Provides reactive conversation data with foundation for real-time sync.
 */

'use client'

import type { ConversationMessage } from '@revealui/contracts/agents'
import { logger } from '@revealui/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSync } from '../provider/index.js'

interface StoredConversation {
  id: string
  userId: string
  agentId: string
  title?: string
  createdAt: Date
  lastActivity: Date
  messageCount: number
}

interface UseConversationsOptions {
  userId: string
  agentId?: string
  limit?: number
}

interface UseConversationsReturn {
  /** List of conversations */
  conversations: StoredConversation[]
  /** Currently selected conversation */
  currentConversation: StoredConversation | null
  /** Messages in current conversation */
  messages: ConversationMessage[]
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: string | null
  /** Connection status */
  isConnected: boolean
  /** Create new conversation */
  createConversation: (title?: string) => Promise<StoredConversation>
  /** Select a conversation */
  selectConversation: (conversationId: string) => Promise<void>
  /** Send message to current conversation */
  sendMessage: (
    content: string,
    role?: 'user' | 'assistant' | 'system',
    metadata?: Record<string, unknown>,
  ) => Promise<ConversationMessage>
  /** Delete conversation */
  deleteConversation: (conversationId: string) => Promise<void>
  /** Clear all messages from conversation */
  clearConversation: (conversationId: string) => Promise<void>
}

export function useConversations(options: UseConversationsOptions): UseConversationsReturn {
  const { userId, agentId, limit = 20 } = options
  const { client, isConnected } = useSync()

  const [conversations, setConversations] = useState<StoredConversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load conversations on mount
  useEffect(() => {
    if (!client || !isConnected) return

    const loadConversations = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const conversationList = await client.collaboration.getConversations(userId, agentId, limit)
        setConversations(conversationList)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    loadConversations()
  }, [client, isConnected, userId, agentId, limit])

  // Load messages when conversation changes
  useEffect(() => {
    if (!currentConversationId || !client) return

    const loadMessages = async () => {
      try {
        const messageList = await client.collaboration.getConversationHistory(currentConversationId)
        setMessages(messageList)
      } catch (err) {
        logger.warn('Failed to load messages', { error: err })
      }
    }

    loadMessages()
  }, [currentConversationId, client])

  // Get current conversation
  const currentConversation = useMemo(() => {
    if (!currentConversationId) return null
    return conversations.find((c) => c.id === currentConversationId) || null
  }, [conversations, currentConversationId])

  // Conversation operations
  const createConversation = useCallback(
    async (title?: string): Promise<StoredConversation> => {
      if (!client) {
        throw new Error('Sync client not available')
      }

      const conversation = await client.collaboration.createConversation({
        userId,
        agentId: agentId || 'default-agent',
        title,
      })

      // Update local state
      setConversations((prev) => [conversation, ...prev].slice(0, limit))

      return conversation
    },
    [client, userId, agentId, limit],
  )

  const selectConversation = useCallback(async (conversationId: string): Promise<void> => {
    setCurrentConversationId(conversationId)
  }, [])

  const sendMessage = useCallback(
    async (
      content: string,
      role: 'user' | 'assistant' | 'system' = 'user',
      metadata?: Record<string, unknown>,
    ): Promise<ConversationMessage> => {
      if (!client || !currentConversationId) {
        throw new Error('No active conversation')
      }

      const message: ConversationMessage = {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: new Date(),
        metadata,
      }

      await client.collaboration.sendMessage(currentConversationId, message, userId)

      // Update local state
      setMessages((prev) => [...prev, message])

      return message
    },
    [client, currentConversationId, userId],
  )

  const deleteConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      if (!client) {
        throw new Error('Sync client not available')
      }

      await client.collaboration.deleteConversation(conversationId)

      // Update local state
      setConversations((prev) => prev.filter((c) => c.id !== conversationId))

      if (currentConversationId === conversationId) {
        setCurrentConversationId(null)
        setMessages([])
      }
    },
    [client, currentConversationId],
  )

  const clearConversation = useCallback(
    async (conversationId: string): Promise<void> => {
      if (!client) {
        throw new Error('Sync client not available')
      }

      await client.collaboration.clearConversation(conversationId)

      // Update local state
      if (currentConversationId === conversationId) {
        setMessages([])
      }
    },
    [client, currentConversationId],
  )

  return {
    conversations,
    currentConversation,
    messages,
    isLoading,
    error,
    isConnected,
    createConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
    clearConversation,
  }
}
