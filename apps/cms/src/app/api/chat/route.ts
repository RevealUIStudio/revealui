import { getSession } from '@revealui/auth/server';
import { ChatRequestContract } from '@revealui/contracts';
import { apiClient } from '@revealui/core/admin/utils/apiClient';
import { isFeatureEnabled } from '@revealui/core/features';
import { logger } from '@revealui/core/utils/logger/server';
import type { NextRequest } from 'next/server';
import { rateLimit } from '@/lib/middleware/rate-limit';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import config from '../../../../revealui.config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
});

// Lazily-initialized tool registry (shared across requests in production)
let toolRegistry: unknown = null;

/**
 * Dynamically import all @revealui/ai dependencies needed for chat.
 * Returns null if the Pro package is not installed.
 */
async function loadChatAIDeps() {
  const moduleNames = ['embeddings', 'llm/server', 'memory/vector', 'tools/cms', 'tools/registry'];
  const results = await Promise.all([
    import('@revealui/ai/embeddings').catch(() => null),
    import('@revealui/ai/llm/server').catch(() => null),
    import('@revealui/ai/memory/vector').catch(() => null),
    import('@revealui/ai/tools/cms').catch(() => null),
    import('@revealui/ai/tools/registry').catch(() => null),
  ]);
  const [embeddingsMod, llmServerMod, vectorMod, cmsMod, registryMod] = results;

  // Log which specific modules failed so operators can diagnose missing Pro deps
  const failed = moduleNames.filter((_, i) => results[i] === null);
  if (failed.length > 0) {
    logger.warn('AI modules unavailable (Pro package not installed?)', { missing: failed });
    return null;
  }
  if (!(embeddingsMod && llmServerMod && vectorMod && cmsMod && registryMod)) {
    return null;
  }

  return {
    generateEmbedding: embeddingsMod.generateEmbedding,
    createLLMClientFromEnv: llmServerMod.createLLMClientFromEnv,
    VectorMemoryService: vectorMod.VectorMemoryService,
    createCMSTools: cmsMod.createCMSTools,
    ToolRegistry: registryMod.ToolRegistry,
  };
}

// Initialize CMS tools lazily (on first request)
async function initializeCMSTools(deps: NonNullable<Awaited<ReturnType<typeof loadChatAIDeps>>>) {
  // Create registry on first call
  if (!toolRegistry) {
    toolRegistry = new deps.ToolRegistry();
  }

  const registry = toolRegistry as InstanceType<typeof deps.ToolRegistry>;

  // Only initialize if not already done
  if (registry.getAll().length > 0) {
    return registry;
  }

  try {
    // Create CMS tools with API client and config
    const cmsTools = deps.createCMSTools({
      apiClient: apiClient as unknown as Parameters<typeof deps.createCMSTools>[0]['apiClient'],
      collections: config.collections?.map(
        (c): { slug: string; label: string; description: string } => ({
          slug: String(c.slug),
          label: (c.labels?.singular as string | undefined) || String(c.slug),
          description: `Collection for ${(c.labels?.singular as string | undefined) || c.slug}`,
        }),
      ),
      globals: config.globals?.map((g): { slug: string; label: string; description: string } => ({
        slug: String(g.slug),
        label: (g.label as string | undefined) || String(g.slug),
        description: `Global configuration for ${(g.label as string | undefined) || g.slug}`,
      })),
      // User context will be added per-request
    });

    // Register all CMS tools
    for (const tool of cmsTools) {
      registry.register(tool);
    }

    logger.info('CMS tools initialized', {
      toolCount: cmsTools.length,
      tools: cmsTools.map((t: { name: string }) => t.name),
    });
  } catch (error) {
    logger.error('Failed to initialize CMS tools', { error });
    throw error;
  }

  return registry;
}

// Tools that require user confirmation before execution
const DESTRUCTIVE_TOOLS = new Set(['delete_document', 'delete_media', 'delete_user']);

/** Build a human-readable description of what a destructive tool will do */
function describeDestructiveAction(toolName: string, args: unknown): string {
  const parsed = typeof args === 'object' && args !== null ? args : {};
  const collection = (parsed as Record<string, unknown>).collection ?? 'item';
  const id = (parsed as Record<string, unknown>).id ?? 'unknown';

  switch (toolName) {
    case 'delete_document':
      return `Delete document "${id}" from ${collection}`;
    case 'delete_media':
      return `Delete media file "${id}"`;
    case 'delete_user':
      return `Delete user account "${id}"`;
    default:
      return `Execute destructive action: ${toolName}`;
  }
}

export async function POST(request: NextRequest) {
  // Dynamic import — @revealui/ai is an optional Pro dependency
  const aiDeps = await loadChatAIDeps();
  if (!aiDeps) {
    return new Response(JSON.stringify({ error: 'AI features require @revealui/ai (Pro)' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Initialize CMS tools on first request
  let registry: Awaited<ReturnType<typeof initializeCMSTools>>;
  try {
    registry = await initializeCMSTools(aiDeps);
  } catch (_error) {
    return createApplicationErrorResponse(
      'Chat tools failed to initialize',
      'TOOLS_INIT_FAILED',
      500,
    );
  }

  // Apply rate limiting
  const rateLimitResponse = await limiter(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Require authenticated session with a Pro (or higher) license
  const authSession = await getSession(request.headers);
  if (!authSession) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!isFeatureEnabled('aiLocal')) {
    return new Response(
      JSON.stringify({ error: 'Forbidden', reason: 'AI features not available' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    // Extract confirmation data before Zod validation strips unknown keys
    const rawBody = body as Record<string, unknown>;
    const confirmedToolCalls = Array.isArray(rawBody.confirmedToolCalls)
      ? new Set(rawBody.confirmedToolCalls as string[])
      : new Set<string>();

    const validationResult = ChatRequestContract.validate(body);

    if (!validationResult.success) {
      const firstIssue = validationResult.errors.issues[0];
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
      );
    }

    const { messages } = validationResult.data;

    // Get the last user message for vector search
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      return createApplicationErrorResponse('No messages provided', 'NO_MESSAGES', 400);
    }
    // Extract plain text from the last message for vector search.
    // Multipart messages (vision) may include image parts — use text parts only.
    const rawContent = lastMessage.content;
    const userMessage = Array.isArray(rawContent)
      ? rawContent
          .filter((p: { type: string }) => p.type === 'text')
          .map((p: { type: string; text?: string }) => p.text ?? '')
          .join(' ')
      : String(rawContent);

    type ConversationRole = 'user' | 'assistant' | 'system' | 'tool';
    interface ConversationMessage {
      role: ConversationRole;
      content: string;
      cacheControl?: { type: 'ephemeral' };
      toolCalls?: unknown[];
      toolCallId?: string;
      name?: string;
    }

    // Create LLM client from env (supports Vultr, OpenAI, Anthropic)
    // biome-ignore lint/suspicious/noExplicitAny: LLMClient type from @revealui/ai (optional Pro dep) — typed chat() signature requires ToolCall[] but our generic messages use unknown[]
    let llmClient: any;
    try {
      logger.info('Creating LLM client', {
        provider: process.env.LLM_PROVIDER,
        hasApiKey: !!process.env.VULTR_API_KEY,
        model: process.env.LLM_MODEL,
      });
      llmClient = aiDeps.createLLMClientFromEnv();
    } catch (_err) {
      return createApplicationErrorResponse(
        'LLM provider not configured',
        'LLM_NOT_CONFIGURED',
        503,
      );
    }

    // 1. Generate embedding for the user's message and search for context
    let memoryContext = '';
    if (process.env.ENABLE_VECTOR_MEMORY !== 'false') {
      try {
        const queryEmbedding = await aiDeps.generateEmbedding(userMessage);
        const vectorService = new aiDeps.VectorMemoryService();

        const searchResults = await vectorService.searchSimilar(queryEmbedding.vector, {
          limit: 5,
          threshold: 0.7,
        });

        if (searchResults.length > 0) {
          memoryContext = searchResults.map((result) => `- ${result.memory.content}`).join('\n');
        }
      } catch (error) {
        logger.error('Vector search error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 2. Build enhanced system prompt with CMS capabilities
    const systemPrompt = buildSystemPrompt(memoryContext);

    // Enable caching for cost savings (system prompt + tools get cached)
    const enableCache = process.env.LLM_ENABLE_CACHE === 'true';

    // 3. Get tool definitions for LLM
    const toolDefinitions = registry.getToolDefinitions();

    logger.info('Chat request with tools', {
      messageCount: messages.length,
      toolCount: toolDefinitions.length,
      hasMemoryContext: memoryContext.length > 0,
    });

    // 4. Start conversation loop (may require multiple turns for tool calls)
    const conversationMessages: ConversationMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
        // Cache system prompt for cost savings (5min TTL)
        cacheControl: enableCache ? { type: 'ephemeral' } : undefined,
      },
      ...(messages as Array<{ role: ConversationRole; content: string }>),
    ];

    let finalResponse = '';
    const maxIterations = 5; // Prevent infinite loops
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Generate response from LLM with tools (with caching enabled)
      const chatResp = await llmClient.chat(conversationMessages, {
        maxTokens: 2000,
        temperature: 0.7,
        tools: toolDefinitions,
        enableCache, // Cache system prompt and tools (90% savings on hits)
      });

      // Log cache usage for monitoring
      if (
        chatResp.usage &&
        (chatResp.usage.cacheReadTokens || chatResp.usage.cacheCreationTokens)
      ) {
        logger.info('Cache usage', {
          cacheReadTokens: chatResp.usage.cacheReadTokens,
          cacheCreationTokens: chatResp.usage.cacheCreationTokens,
          promptTokens: chatResp.usage.promptTokens,
          savingsPercent: chatResp.usage.cacheReadTokens
            ? Math.round((chatResp.usage.cacheReadTokens / chatResp.usage.promptTokens) * 100)
            : 0,
        });
      }

      // Check if LLM wants to use tools
      if (chatResp.toolCalls && chatResp.toolCalls.length > 0) {
        logger.info('LLM requested tool calls', {
          toolCalls: chatResp.toolCalls.map(
            (tc: { function: { name: string } }) => tc.function.name,
          ),
        });

        // Add assistant message with tool calls to conversation
        conversationMessages.push({
          role: 'assistant',
          content: chatResp.content || '',
          toolCalls: chatResp.toolCalls,
        });

        // Execute each tool call
        for (const toolCall of chatResp.toolCalls) {
          const { name: toolName, arguments: toolArgs } = toolCall.function;

          // Parse arguments if they're a JSON string
          let parsedArgs: unknown;
          try {
            parsedArgs = typeof toolArgs === 'string' ? JSON.parse(toolArgs) : toolArgs;
          } catch (parseError) {
            logger.error('Failed to parse tool arguments', {
              tool: toolName,
              arguments: toolArgs,
              error: parseError instanceof Error ? parseError.message : String(parseError),
            });
            parsedArgs = {};
          }

          logger.info('Executing tool', {
            tool: toolName,
            arguments: parsedArgs,
          });

          // Destructive action gate: require explicit user confirmation
          if (DESTRUCTIVE_TOOLS.has(toolName) && !confirmedToolCalls.has(toolCall.id)) {
            logger.info('Destructive tool blocked — awaiting confirmation', {
              tool: toolName,
              toolCallId: toolCall.id,
            });

            return new Response(
              JSON.stringify({
                type: 'confirmation_required',
                toolCallId: toolCall.id,
                toolName,
                arguments: parsedArgs,
                description: describeDestructiveAction(toolName, parsedArgs),
                // Include conversation state so the client can resume
                pendingMessages: conversationMessages.slice(1), // exclude system prompt
              }),
              { headers: { 'Content-Type': 'application/json' } },
            );
          }

          // Execute the tool
          const toolResult = await registry.execute(toolName, parsedArgs);

          // Add tool result to conversation
          conversationMessages.push({
            role: 'tool',
            content: JSON.stringify(toolResult),
            toolCallId: toolCall.id,
            name: toolName,
          });

          logger.info('Tool execution result', {
            tool: toolName,
            success: toolResult.success,
            hasData: !!toolResult.data,
          });
        }

        // Continue loop to let LLM process tool results
        continue;
      }

      // No more tool calls - we have the final response
      finalResponse = chatResp.content || '';
      break;
    }

    if (iteration >= maxIterations) {
      logger.warn('Max iterations reached in tool execution loop');
      finalResponse =
        finalResponse ||
        'I ran into a processing limit. Please try breaking your request into smaller steps.';
    }

    // Log response cache statistics
    const cacheStats = llmClient.getResponseCacheStats();
    if (cacheStats && cacheStats.hits + cacheStats.misses > 0) {
      logger.info('Response cache stats', {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: `${cacheStats.hitRate}%`,
        size: cacheStats.size,
        evictions: cacheStats.evictions,
      });
    }

    // Log semantic cache statistics
    const semanticStats = llmClient.getSemanticCacheStats();
    if (semanticStats && semanticStats.totalQueries > 0) {
      logger.info('Semantic cache stats', {
        hits: semanticStats.hits,
        misses: semanticStats.misses,
        hitRate: `${semanticStats.hitRate}%`,
        avgSimilarity: semanticStats.avgSimilarity,
        totalQueries: semanticStats.totalQueries,
      });
    }

    return new Response(JSON.stringify({ content: finalResponse }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createErrorResponse(error, {
      endpoint: '/api/chat',
      method: 'POST',
    });
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

${memoryContext ? `**Context from Previous Conversations:**\n${memoryContext}\n` : ''}`;

  return basePrompt;
}
