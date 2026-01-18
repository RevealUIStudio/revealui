/**
 * useConversations Hook
 *
 * Manages conversations with ElectricSQL real-time sync.
 * Provides conversation history and real-time messaging.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useElectric } from '../provider/index.js'
import type { ElectricClient } from '../client/index.js'

interface Conversation {
  id: string
  userId: string
  agentId: string
  title?: string
  createdAt: Date
  lastActivity: Date
  messageCount: number
}

interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

interface UseConversationsOptions {
  userId: string
  agentId?: string
  limit?: number
  autoSync?: boolean
}

export function useConversations(options: UseConversationsOptions) {
  const { client, isConnected } = useElectric()
  const { userId, agentId, limit = 20, autoSync = true } = options

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load conversations on mount
  useEffect(() => {
    if (!client || !isConnected) return

    const loadConversations = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const conversationList = await loadConversationsFromDB(client, userId, agentId, limit)
        setConversations(conversationList)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversations')
      } finally {
        setIsLoading(false)
      }
    }

    loadConversations()
  }, [client, isConnected, userId, agentId, limit])

  // Load messages when conversation changes
  useEffect(() => {
    if (!currentConversation || !client) return

    const loadMessages = async () => {
      try {
        const messageList = await loadMessagesFromDB(client, currentConversation.id)
        setMessages(messageList)
      } catch (err) {
        console.warn('Failed to load messages:', err)
      }
    }

    loadMessages()
  }, [currentConversation, client])

  const createConversation = useCallback(async (
    title?: string
  ): Promise<Conversation> => {
    if (!client) {
      throw new Error('ElectricSQL client not available')
    }

    const conversation: Conversation = {
      id: crypto.randomUUID(),
      userId,
      agentId: agentId || 'default-agent',
      title,
      createdAt: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
    }

    try {
      // Save to ElectricSQL
      await saveConversationToDB(client, conversation)

      // Update local state
      setConversations(prev => [conversation, ...prev].slice(0, limit))
      setCurrentConversation(conversation)
      setMessages([])

      return conversation
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create conversation'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [client, userId, agentId, limit])

  const selectConversation = useCallback(async (conversationId: string): Promise<void> => {
    const conversation = conversations.find(c => c.id === conversationId)
    if (conversation) {
      setCurrentConversation(conversation)
    } else {
      // Try to load from DB
      try {
        const loadedConversation = await loadConversationFromDB(client!, conversationId)
        if (loadedConversation) {
          setCurrentConversation(loadedConversation)
          setConversations(prev => [loadedConversation, ...prev.filter(c => c.id !== conversationId)])
        }
      } catch (err) {
        setError('Failed to load conversation')
      }
    }
  }, [conversations, client])

  const sendMessage = useCallback(async (
    content: string,
    role: 'user' | 'assistant' | 'system' = 'user',
    metadata?: Record<string, unknown>
  ): Promise<Message> => {
    if (!client || !currentConversation) {
      throw new Error('No active conversation')
    }

    const message: Message = {
      id: crypto.randomUUID(),
      conversationId: currentConversation.id,
      role,
      content,
      timestamp: new Date(),
      metadata,
    }

    try {
      // Save message to ElectricSQL
      await saveMessageToDB(client, message)

      // Update conversation
      const updatedConversation = {
        ...currentConversation,
        lastActivity: new Date(),
        messageCount: currentConversation.messageCount + 1,
      }

      await updateConversationInDB(client, updatedConversation)

      // Update local state
      setMessages(prev => [...prev, message])
      setConversations(prev =>
        prev.map(c => c.id === currentConversation.id ? updatedConversation : c)
      )

      return message
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [client, currentConversation])

  const deleteConversation = useCallback(async (conversationId: string): Promise<void> => {
    if (!client) {
      throw new Error('ElectricSQL client not available')
    }

    try {
      await deleteConversationFromDB(client, conversationId)

      // Update local state
      setConversations(prev => prev.filter(c => c.id !== conversationId))

      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null)
        setMessages([])
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete conversation'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [client, currentConversation])

  const clearConversation = useCallback(async (conversationId: string): Promise<void> => {
    if (!client) {
      throw new Error('ElectricSQL client not available')
    }

    try {
      await clearMessagesFromDB(client, conversationId)

      // Update local state
      if (currentConversation?.id === conversationId) {
        setMessages([])
        setCurrentConversation({
          ...currentConversation,
          messageCount: 0,
        })
      }

      setConversations(prev =>
        prev.map(c => c.id === conversationId ? { ...c, messageCount: 0 } : c)
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear conversation'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [client, currentConversation])

  return {
    conversations,
    currentConversation,
    messages,
    isLoading,
    error,
    createConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
    clearConversation,
    isConnected,
  }
}

// Helper functions for ElectricSQL operations
async function loadConversationsFromDB(
  client: ElectricClient,
  userId: string,
  agentId?: string,
  limit?: number
): Promise<Conversation[]> {
  // This would query the conversations table in ElectricSQL
  // For now, return empty array
  return []
}

async function loadConversationFromDB(
  client: ElectricClient,
  conversationId: string
): Promise<Conversation | null> {
  // This would query a specific conversation from ElectricSQL
  // For now, return null
  return null
}

async function loadMessagesFromDB(
  client: ElectricClient,
  conversationId: string
): Promise<Message[]> {
  // This would query messages from ElectricSQL
  // For now, return empty array
  return []
}

async function saveConversationToDB(client: ElectricClient, conversation: Conversation): Promise<void> {
  // This would save conversation to ElectricSQL
  // Implementation would go here
}

async function saveMessageToDB(client: ElectricClient, message: Message): Promise<void> {
  // This would save message to ElectricSQL
  // Implementation would go here
}

async function updateConversationInDB(client: ElectricClient, conversation: Conversation): Promise<void> {
  // This would update conversation in ElectricSQL
  // Implementation would go here
}

async function deleteConversationFromDB(client: ElectricClient, conversationId: string): Promise<void> {
  // This would delete conversation from ElectricSQL
  // Implementation would go here
}

async function clearMessagesFromDB(client: ElectricClient, conversationId: string): Promise<void> {
  // This would clear messages from ElectricSQL
  // Implementation would go here
}