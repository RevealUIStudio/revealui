import { generateEmbedding } from '@revealui/ai/embeddings'
import { VectorMemoryService } from '@revealui/ai/memory/vector'
import { rateLimit } from '@/lib/middleware/rate-limit'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { NextRequest } from 'next/server'

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
    const { messages } = await request.json()

    // Validate input
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('Invalid messages format', { status: 400 })
    }

    // Get the last user message for vector search
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'user') {
      return new Response('Last message must be from user', { status: 400 })
    }

    const userMessage = lastMessage.content
    if (typeof userMessage !== 'string' || userMessage.trim().length === 0) {
      return new Response('Message content must be a non-empty string', { status: 400 })
    }

    if (userMessage.length > 4000) {
      return new Response('Message too long (max 4000 characters)', { status: 400 })
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return new Response('OpenAI integration not configured', { status: 503 })
    }

    // 1. Generate embedding for the user's message
    let memoryContext = ''
    try {
      const queryEmbedding = await generateEmbedding(userMessage)
      const vectorService = new VectorMemoryService()
      
      // Search for relevant memories
      const searchResults = await vectorService.searchSimilar(queryEmbedding.vector, {
        limit: 5,
        threshold: 0.7, // Only include highly relevant memories
      })

      if (searchResults.length > 0) {
        memoryContext = searchResults
          .map((result) => `- ${result.memory.content}`)
          .join('\n')
      }
    } catch (error) {
      // Log error but don't fail the request if vector search fails
      console.error('Vector search error:', error)
      // Continue without memory context
    }

    // 2. Build system prompt with memory context
    const systemPrompt = memoryContext
      ? `You are a helpful AI assistant. Here is relevant context from previous conversations:\n\n${memoryContext}\n\nUse this context to provide more relevant and personalized responses.`
      : 'You are a helpful AI assistant.'

    // 3. Stream response using Vercel AI SDK
    const result = await streamText({
      model: openai('gpt-4'),
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      maxTokens: 1000,
      temperature: 0.7,
    })

    // Return streaming response
    return result.toDataStreamResponse()
  } catch (error) {
    // Log error (but don't expose details to client)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Chat API error:', errorMessage)

    return new Response('Failed to process chat request. Please try again later.', {
      status: 500,
    })
  }
}
