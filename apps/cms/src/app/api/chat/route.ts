import { generateEmbedding } from '@revealui/ai/embeddings'
import type { Message } from '@revealui/ai/llm/providers/base'
import { createLLMClientFromEnv } from '@revealui/ai/llm/server'
import { VectorMemoryService } from '@revealui/ai/memory/vector'
import { logger } from '@revealui/core/utils/logger'
import type { NextRequest } from 'next/server'
// Streaming replaced with unified LLM client
import { rateLimit } from '@/lib/middleware/rate-limit'
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'

/**
 * Server-side Chat API with Vercel AI SDK
 *
 * Features:
 * - Streaming responses
 * - Vector search integration
 * - Rate limiting
 * - Type-safe with Vercel AI SDK
 */

const limiter = rateLimit({
  maxRequests: 10, // 10 requests per window (stricter for AI)
  windowMs: 60 * 1000, // 1 minute
})

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await limiter(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    // Parse request body (Vercel AI SDK format)
    let messages: unknown
    try {
      const body = await request.json()
      messages = body.messages
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      })
    }

    // Validate input
    if (!Array.isArray(messages) || messages.length === 0) {
      return createValidationErrorResponse(
        'Messages must be a non-empty array',
        'messages',
        messages,
      )
    }

    // Get the last user message for vector search
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'user') {
      return createValidationErrorResponse(
        'Last message must be from user',
        'messages[last].role',
        lastMessage?.role,
      )
    }

    const userMessage = lastMessage.content
    if (typeof userMessage !== 'string' || userMessage.trim().length === 0) {
      return createValidationErrorResponse(
        'Message content must be a non-empty string',
        'messages[last].content',
        userMessage,
      )
    }

    if (userMessage.length > 4000) {
      return createValidationErrorResponse(
        'Message too long (max 4000 characters)',
        'messages[last].content',
        userMessage.length,
      )
    }

    // Create LLM client from env (supports Vultr, OpenAI, Anthropic)
    let llmClient
    try {
      llmClient = createLLMClientFromEnv()
    } catch (_err) {
      return createApplicationErrorResponse(
        'LLM provider not configured',
        'LLM_NOT_CONFIGURED',
        503,
      )
    }

    // 1. Generate embedding for the user's message
    let memoryContext = ''
    if (process.env.ENABLE_VECTOR_MEMORY !== 'false') {
      try {
        const queryEmbedding = await generateEmbedding(userMessage)
        const vectorService = new VectorMemoryService()

        // Search for relevant memories
        const searchResults = await vectorService.searchSimilar(queryEmbedding.vector, {
          limit: 5,
          threshold: 0.7, // Only include highly relevant memories
        })

        if (searchResults.length > 0) {
          memoryContext = searchResults.map((result) => `- ${result.memory.content}`).join('\n')
        }
      } catch (error) {
        // Log error but don't fail the request if vector search fails
        logger.error('Vector search error', {
          error: error instanceof Error ? error.message : String(error),
        })
        // Continue without memory context
      }
    }

    // 2. Build system prompt with memory context
    const systemPrompt = memoryContext
      ? `You are a helpful AI assistant. Here is relevant context from previous conversations:\n\n${memoryContext}\n\nUse this context to provide more relevant and personalized responses.`
      : 'You are a helpful AI assistant.'

    // 3. Generate response from LLM provider
    const chatResp = await llmClient.chat(
      [{ role: 'system', content: systemPrompt }, ...(messages as Message[])],
      { maxTokens: 1000, temperature: 0.7 },
    )

    return new Response(JSON.stringify({ content: chatResp.content }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    // Use standardized error response utility
    return createErrorResponse(error, {
      endpoint: '/api/chat',
      method: 'POST',
    })
  }
}
