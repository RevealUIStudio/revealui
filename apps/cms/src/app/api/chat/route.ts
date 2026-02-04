import { generateEmbedding } from '@revealui/ai/embeddings'
import type { LLMClient } from '@revealui/ai/llm/client'
import type { Message } from '@revealui/ai/llm/providers/base'
import { createLLMClientFromEnv } from '@revealui/ai/llm/server'
import { VectorMemoryService } from '@revealui/ai/memory/vector'
import { type CMSAPIClient, createCMSTools } from '@revealui/ai/tools/cms'
import { ToolRegistry } from '@revealui/ai/tools/registry'
import { ChatRequestContract } from '@revealui/contracts'
import { apiClient } from '@revealui/core/admin/utils/apiClient'
import { logger } from '@revealui/core/utils/logger/server'
import type { NextRequest } from 'next/server'
import { rateLimit } from '@/lib/middleware/rate-limit'
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response'
import config from '../../../../revealui.config'

export const dynamic = 'force-dynamic'

/**
 * Server-side Chat API with CMS Tools Integration
 *
 * Features:
 * - AI-powered CMS management through conversation
 * - Full CRUD operations on collections, globals, media, users
 * - Vector search integration for context
 * - Rate limiting
 * - Authentication context
 */

const limiter = rateLimit({
  maxRequests: 10, // 10 requests per window (stricter for AI)
  windowMs: 60 * 1000, // 1 minute
})

// Create tool registry (shared across requests in production)
const toolRegistry = new ToolRegistry()

// Initialize CMS tools lazily (on first request)
function initializeCMSTools() {
  // Only initialize if not already done
  if (toolRegistry.getAll().length > 0) {
    return
  }

  try {
    // Create CMS tools with API client and config
    const cmsTools = createCMSTools({
      apiClient: apiClient as CMSAPIClient, // Cast to compatible type
      collections: config.collections?.map((c: { slug: string; label?: string }) => ({
        slug: String(c.slug),
        label: c.label || String(c.slug),
        description: `Collection for ${c.label || c.slug}`,
      })),
      globals: config.globals?.map((g: { slug: string; label?: string }) => ({
        slug: String(g.slug),
        label: g.label || String(g.slug),
        description: `Global configuration for ${g.label || g.slug}`,
      })),
      // User context will be added per-request
    })

    // Register all CMS tools
    cmsTools.forEach((tool) => {
      toolRegistry.register(tool)
    })

    logger.info('CMS tools initialized', {
      toolCount: cmsTools.length,
      tools: cmsTools.map((t) => t.name),
    })
  } catch (error) {
    logger.error('Failed to initialize CMS tools', { error })
  }
}

export async function POST(request: NextRequest) {
  // Initialize CMS tools on first request
  initializeCMSTools()

  // Apply rate limiting
  const rateLimitResponse = await limiter(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    // Parse and validate request body
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
      return createApplicationErrorResponse('No messages provided', 'NO_MESSAGES', 400)
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

    // 1. Generate embedding for the user's message and search for context
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

    // 2. Build enhanced system prompt with CMS capabilities
    const systemPrompt = buildSystemPrompt(memoryContext)

    // 3. Get tool definitions for LLM
    const toolDefinitions = toolRegistry.getToolDefinitions()

    logger.info('Chat request with tools', {
      messageCount: messages.length,
      toolCount: toolDefinitions.length,
      hasMemoryContext: memoryContext.length > 0,
    })

    // 4. Start conversation loop (may require multiple turns for tool calls)
    const conversationMessages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...(messages as Message[]),
    ]

    let finalResponse = ''
    const maxIterations = 5 // Prevent infinite loops
    let iteration = 0

    while (iteration < maxIterations) {
      iteration++

      // Generate response from LLM with tools
      const chatResp = await llmClient.chat(conversationMessages, {
        maxTokens: 2000,
        temperature: 0.7,
        tools: toolDefinitions,
      })

      // Check if LLM wants to use tools
      if (chatResp.toolCalls && chatResp.toolCalls.length > 0) {
        logger.info('LLM requested tool calls', {
          toolCalls: chatResp.toolCalls.map((tc) => tc.function.name),
        })

        // Add assistant message with tool calls to conversation
        conversationMessages.push({
          role: 'assistant',
          content: chatResp.content || '',
          toolCalls: chatResp.toolCalls,
        })

        // Execute each tool call
        for (const toolCall of chatResp.toolCalls) {
          const { name: toolName, arguments: toolArgs } = toolCall.function

          logger.info('Executing tool', {
            tool: toolName,
            arguments: toolArgs,
          })

          // Execute the tool
          const toolResult = await toolRegistry.execute(toolName, toolArgs)

          // Add tool result to conversation
          conversationMessages.push({
            role: 'tool',
            content: JSON.stringify(toolResult),
            toolCallId: toolCall.id,
            name: toolName,
          })

          logger.info('Tool execution result', {
            tool: toolName,
            success: toolResult.success,
            hasData: !!toolResult.data,
          })
        }

        // Continue loop to let LLM process tool results
        continue
      }

      // No more tool calls - we have the final response
      finalResponse = chatResp.content || ''
      break
    }

    if (iteration >= maxIterations) {
      logger.warn('Max iterations reached in tool execution loop')
      finalResponse =
        finalResponse ||
        'I ran into a processing limit. Please try breaking your request into smaller steps.'
    }

    return new Response(JSON.stringify({ content: finalResponse }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return createErrorResponse(error, {
      endpoint: '/api/chat',
      method: 'POST',
    })
  }
}

/**
 * Build system prompt with CMS tool capabilities
 */
function buildSystemPrompt(memoryContext: string): string {
  const basePrompt = `You are an AI-powered CMS management assistant for RevealUI. You can help users manage their content through natural conversation.

**Your Capabilities:**

📝 **Content Management**
- Create, read, update, and delete content in collections (pages, posts, media, users, etc.)
- Search and filter documents
- Manage document fields and metadata

🌐 **Global Settings**
- Update site-wide settings like Header, Footer, and Settings
- Manage navigation menus
- Configure global options

🖼️ **Media Management**
- Browse and search media library
- Upload new images and files
- Update media metadata (alt text, titles)

👤 **User Management**
- View current user information
- List and manage users (admin only)
- Create and update user accounts

**How to Help Users:**

When a user asks you to modify the CMS, use the available tools to make the changes. Be conversational and explain what you're doing.

**Examples:**

User: "Add a new page called About"
You: I'll create a new page for you. [Use create_document tool] The About page has been created successfully! You can now edit it in the CMS.

User: "Change the header to include a Blog link"
You: Let me update the header navigation. [Use get_global, then update_global] Done! I've added a Blog link to your header navigation.

User: "Show me all published posts"
You: [Use find_documents with where: {status: "published"}] I found X published posts...

**Important Guidelines:**
- Always confirm successful operations
- If something fails, explain the error clearly
- For destructive operations (delete), confirm the user's intent
- Be helpful and conversational, not robotic
- Use tools appropriately - don't make assumptions about data structure

${memoryContext ? `**Context from Previous Conversations:**\n${memoryContext}\n` : ''}`

  return basePrompt
}
