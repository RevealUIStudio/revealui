/**
 * Chat API Contracts
 *
 * Validation contracts for chat/AI endpoints
 */

import { z } from 'zod/v4'
import { createContract } from '../foundation/contract.js'

/**
 * Chat message schema
 */
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, 'Message content cannot be empty'),
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>

/**
 * Chat request validation
 *
 * Validates chat request with:
 * - Non-empty array of messages
 * - Each message has role and content
 * - Last message must be from user
 * - Last message content max 4000 characters
 */
export const ChatRequestSchema = z
  .object({
    messages: z.array(ChatMessageSchema).min(1, 'Messages must be a non-empty array'),
  })
  .refine(
    (data) => {
      const lastMessage = data.messages[data.messages.length - 1]
      return lastMessage?.role === 'user'
    },
    {
      message: 'Last message must be from user',
      path: ['messages'],
    },
  )
  .refine(
    (data) => {
      const lastMessage = data.messages[data.messages.length - 1]
      return lastMessage && lastMessage.content.trim().length > 0
    },
    {
      message: 'Message content must be a non-empty string',
      path: ['messages'],
    },
  )
  .refine(
    (data) => {
      const lastMessage = data.messages[data.messages.length - 1]
      return lastMessage && lastMessage.content.length <= 4000
    },
    {
      message: 'Message too long (max 4000 characters)',
      path: ['messages'],
    },
  )

export type ChatRequest = z.infer<typeof ChatRequestSchema>

export const ChatRequestContract = createContract({
  name: 'ChatRequest',
  version: '1',
  description: 'Validates chat request with messages',
  schema: ChatRequestSchema,
})
