import type { Message } from '@revealui/ai/llm/providers/base'
import { createLLMClientFromEnv, type LLMClient } from '@revealui/ai/llm/server'
import { logger } from '@revealui/core/observability/logger'
import type { NextRequest } from 'next/server'
import { rateLimit } from '@/lib/middleware/rate-limit'
import {
  createApplicationErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response'

export const dynamic = 'force-dynamic'

/**
 * Server-side Chat API for Dashboard
 *
 * Features:
 * - Simple JSON responses
 * - Rate limiting (10 req/min)
 * - Error handling
 * - Vultr AI integration via unified LLM client
 */

const limiter = rateLimit({
  maxRequests: 10, // 10 requests per window
  windowMs: 60 * 1000, // 1 minute
})

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = limiter(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    // Parse request body
    let messages: unknown
    try {
      const body: unknown = await request.json()
      messages = (body as Record<string, unknown>).messages
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

    // Get the last user message
    const lastMessage = messages[messages.length - 1] as Record<string, unknown> | undefined
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
    let llmClient: LLMClient
    try {
      llmClient = createLLMClientFromEnv()
    } catch {
      return createApplicationErrorResponse(
        'LLM provider not configured',
        'LLM_NOT_CONFIGURED',
        503,
      )
    }

    // Build system prompt and messages
    const systemPrompt = 'You are a helpful AI assistant for the RevealUI dashboard.'
    const enableCache = process.env.LLM_ENABLE_CACHE === 'true'

    const fullMessages: Message[] = [
      {
        role: 'system',
        content: systemPrompt,
        // Cache system prompt for cost savings (5min TTL)
        cacheControl: enableCache ? { type: 'ephemeral' } : undefined,
      },
      ...(messages as Message[]),
    ]

    // Generate response from LLM provider (with caching enabled)
    const chatResp = await llmClient.chat(fullMessages, {
      maxTokens: 1000,
      temperature: 0.7,
      enableCache, // Cache system prompt (90% savings on cache hits)
    })

    // Log cache usage for monitoring
    if (chatResp.usage && (chatResp.usage.cacheReadTokens || chatResp.usage.cacheCreationTokens)) {
      logger.info('Cache usage', {
        cacheReadTokens: chatResp.usage.cacheReadTokens,
        cacheCreationTokens: chatResp.usage.cacheCreationTokens,
        promptTokens: chatResp.usage.promptTokens,
        savingsPercent: chatResp.usage.cacheReadTokens
          ? Math.round((chatResp.usage.cacheReadTokens / chatResp.usage.promptTokens) * 100)
          : 0,
      })
    }

    // Log response cache statistics
    const cacheStats = llmClient.getResponseCacheStats()
    if (cacheStats && cacheStats.hits + cacheStats.misses > 0) {
      logger.info('Response cache stats', {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: `${cacheStats.hitRate}%`,
        size: cacheStats.size,
      })
    }

    // Log semantic cache statistics
    const semanticStats = llmClient.getSemanticCacheStats()
    if (semanticStats && semanticStats.totalQueries > 0) {
      logger.info('Semantic cache stats', {
        hits: semanticStats.hits,
        misses: semanticStats.misses,
        hitRate: `${semanticStats.hitRate}%`,
        avgSimilarity: semanticStats.avgSimilarity,
        totalQueries: semanticStats.totalQueries,
      })
    }

    return new Response(JSON.stringify({ content: chatResp.content }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Chat API error', error instanceof Error ? error : new Error(errorMessage))
    return createApplicationErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      'CHAT_ERROR',
      500,
    )
  }
}
