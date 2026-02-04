/**
 * Simplified Chat API for Testing (without rate limiting)
 *
 * This route bypasses the auth-dependent rate limiting to test chat functionality
 * while the Next.js build issues are being resolved.
 */

import { generateEmbedding } from '@revealui/ai/embeddings'
import { createLLMClientFromEnv } from '@revealui/ai/llm/server'
import { VectorMemoryService } from '@revealui/ai/memory/vector'
import { logger } from '@revealui/core/utils/logger'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const messages = body.messages as Array<{ role: string; content: string }>

    // Basic validation
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages must be a non-empty array' }, { status: 400 })
    }

    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 })
    }

    const userMessage = lastMessage.content
    if (typeof userMessage !== 'string' || userMessage.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content must be a non-empty string' },
        { status: 400 },
      )
    }

    // Create LLM client
    let llmClient: ReturnType<typeof createLLMClientFromEnv>
    try {
      llmClient = createLLMClientFromEnv()
    } catch (_err) {
      return NextResponse.json({ error: 'LLM provider not configured' }, { status: 503 })
    }

    // Optional: Vector memory search
    let memoryContext = ''
    if (process.env.ENABLE_VECTOR_MEMORY !== 'false') {
      try {
        const queryEmbedding = await generateEmbedding(userMessage)
        const vectorService = new VectorMemoryService()

        const searchResults = await vectorService.searchSimilar(queryEmbedding.vector, {
          limit: 5,
          threshold: 0.7,
        })

        if (searchResults.length > 0) {
          memoryContext = searchResults.map((result) => `- ${result.memory.content}`).join('\n')
        }
      } catch (error) {
        logger.error('Vector search error', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Build system prompt
    const systemPrompt = memoryContext
      ? `You are a helpful AI assistant. Here is relevant context from previous conversations:\n\n${memoryContext}\n\nUse this context to provide more relevant and personalized responses.`
      : 'You are a helpful AI assistant.'

    const enableCache = process.env.LLM_ENABLE_CACHE === 'true'

    // Generate response (with caching enabled)
    const chatResp = await llmClient.chat(
      [
        {
          role: 'system',
          content: systemPrompt,
          cacheControl: enableCache ? { type: 'ephemeral' } : undefined,
        },
        ...(messages as ChatMessage[]),
      ],
      {
        maxTokens: 1000,
        temperature: 0.7,
        enableCache, // Cache system prompt for cost savings
      },
    )

    return NextResponse.json({ content: chatResp.content })
  } catch (error) {
    logger.error('Chat API error:', { error })
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    )
  }
}
