import { generateEmbedding } from '@revealui/ai/embeddings'
import type { LLMClient } from '@revealui/ai/llm/client'
import type { Message } from '@revealui/ai/llm/providers/base'
import { createLLMClientFromEnv } from '@revealui/ai/llm/server'
import { VectorMemoryService } from '@revealui/ai/memory/vector'
import { ChatRequestContract } from '@revealui/contracts'
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
    // Parse and validate request body using contract
    let body: unknown
    try {
      body = await request.json()
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      })
    }

    const validationResult = ChatRequestContract.validate(body)

    if (!validationResult.success) {
      // Extract first validation error for user-friendly response
      const firstIssue = validationResult.errors.issues[0]
      return createValidationErrorResponse(
        firstIssue?.message || 'Validation failed',
        firstIssue?.path?.join('.') || 'body',
        body,
        {
          issues: validationResult.errors.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      )
    }

    const { messages } = validationResult.data

    // Get the last user message for vector search
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage) {
      return createApplicationErrorResponse(
        'No messages provided',
        'NO_MESSAGES',
        400,
      )
    }
    const userMessage = lastMessage.content

    // Create LLM client from env (supports Vultr, OpenAI, Anthropic)
    let llmClient: LLMClient
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
