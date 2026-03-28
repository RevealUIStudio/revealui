/**
 * Agent Stream Route
 *
 * POST /api/agent-stream → text/event-stream (SSE)
 *
 * Streams agent execution events in real-time using Hono's streamSSE helper.
 * Each AgentStreamChunk becomes one "data: {...}\n\n" SSE event.
 *
 * Client-side: use fetch + ReadableStream (not EventSource — it doesn't support POST).
 * See packages/ai/src/client/hooks/useAgentStream.ts for the React hook.
 */

import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';

/** Detect LLM provider from API key prefix or explicit parameter */
export function detectProvider(apiKey: string, explicitProvider?: string): string | null {
  if (explicitProvider) return explicitProvider;
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey.startsWith('sk-')) return 'openai';
  if (apiKey.startsWith('gsk_')) return 'groq';
  if (apiKey.startsWith('hf_')) return 'huggingface';
  // Ollama and Vultr don't have standard key prefixes — require explicit provider
  return null;
}

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-5-20250514',
  openai: 'gpt-4o',
  groq: 'llama-3.3-70b-versatile',
  ollama: 'llama3.2',
  vultr: 'llama-3.3-70b-versatile',
  huggingface: 'meta-llama/Llama-3.3-70B-Instruct',
};

type Variables = {
  tenant?: { id: string };
  user?: { id: string; role: string };
  /** Set by requireAIAccess middleware — 'local' means free tier with BitNet only */
  aiAccessMode?: 'local';
};

const app = new OpenAPIHono<{ Variables: Variables }>();

const agentStreamRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['agent'],
  summary: 'Stream agent execution via SSE',
  description:
    'Streams agent execution events in real-time using Server-Sent Events. Client-side: use fetch + ReadableStream (not EventSource — it does not support POST).',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            instruction: z.string(),
            boardId: z.string().optional(),
            workspaceId: z.string().optional(),
            priority: z.string().optional(),
            provider: z.string().optional(),
            model: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'SSE stream of agent execution events (text/event-stream)',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
      description: 'Missing instruction or invalid provider',
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
            code: z.string(),
          }),
        },
      },
      description: 'AI feature requires Pro or Enterprise license',
    },
  },
});

app.openapi(agentStreamRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  const body = c.req.valid('json');

  // Dynamically load @revealui/ai modules
  const [aiMod, llmClientMod, streamingRuntimeMod] = await Promise.all([
    import('@revealui/ai').catch(() => null),
    import('@revealui/ai/llm/client').catch(() => null),
    import('@revealui/ai/orchestration/streaming-runtime').catch(() => null),
  ]);

  if (!(aiMod && llmClientMod && streamingRuntimeMod)) {
    return c.json(
      {
        success: false,
        error:
          "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        code: 'HTTP_403',
      },
      403,
    );
  }

  // Free tier with local BitNet: reject BYOK and force local provider
  const isLocalOnly = c.get('aiAccessMode') === 'local';

  // BYOK: accept API key via Authorization header (never in request body)
  const authHeader = c.req.header('Authorization');
  const byokKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (isLocalOnly && byokKey) {
    return c.json(
      {
        success: false,
        error:
          'BYOK (Bring Your Own Key) requires a Pro or Enterprise license. ' +
          'Free tier uses local BitNet inference. Upgrade at https://revealui.com/pricing',
        code: 'HTTP_403',
      },
      403,
    );
  }

  let llmClient: unknown;
  try {
    if (byokKey) {
      const provider = detectProvider(byokKey, body.provider);
      if (!provider) {
        return c.json(
          {
            success: false,
            error: 'Cannot detect LLM provider from key format. Pass "provider" in request body.',
          },
          400,
        );
      }
      const model = body.model || DEFAULT_MODELS[provider] || 'llama-3.3-70b-versatile';
      // Provider string is validated by detectProvider; type assertion needed because
      // LLMProviderType is a string literal union from the Pro package.
      type LLMConfig = ConstructorParameters<typeof llmClientMod.LLMClient>[0];
      llmClient = new llmClientMod.LLMClient({
        provider: provider as LLMConfig['provider'],
        apiKey: byokKey,
        model,
      });
    } else if (isLocalOnly) {
      // Free tier: force BitNet provider regardless of other env vars
      type LLMConfig = ConstructorParameters<typeof llmClientMod.LLMClient>[0];
      llmClient = new llmClientMod.LLMClient({
        provider: 'bitnet' as LLMConfig['provider'],
        apiKey: 'bitnet',
        baseURL: process.env.BITNET_BASE_URL,
        model: process.env.LLM_MODEL ?? 'bitnet-b1.58-2B-4T',
      });
    } else {
      llmClient = aiMod.createLLMClientFromEnv();
    }
  } catch {
    return c.json(
      {
        success: false,
        error:
          "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        code: 'HTTP_403',
      },
      403,
    );
  }

  const workspaceId = body.workspaceId ?? c.get('tenant')?.id ?? 'default';

  // Load CMS tools so the agent can manage content, media, users, globals
  let cmsTools: unknown[] = [];
  try {
    const cmsToolsMod = await import('@revealui/ai/tools/cms').catch(() => null);
    if (cmsToolsMod) {
      // Build internal API base URL from the request
      const requestUrl = new URL(c.req.url);
      const apiBase = `${requestUrl.protocol}//${requestUrl.host}`;

      // Extract session cookie for auth passthrough
      const cookieHeader = c.req.header('Cookie') ?? '';
      const sessionMatch = cookieHeader.match(/revealui-session=([^;]+)/);
      const sessionToken = sessionMatch?.[1] ?? '';

      const { createInternalCMSClient } = await import('../lib/internal-cms-client.js');
      const apiClient = createInternalCMSClient(apiBase, sessionToken);

      cmsTools = cmsToolsMod.createCMSTools({ apiClient });
    }
  } catch {
    // CMS tools unavailable — agent will work without them
  }

  const agent = {
    id: 'cms-stream-agent',
    name: 'CMS Stream Agent',
    instructions: `You are an AI-powered CMS management assistant for RevealUI. You can help users manage their content, media, users, and settings through natural conversation.

When asked to modify the CMS, use the available tools. Be conversational and explain what you're doing. For destructive operations (delete), confirm the user's intent first.

Workspace: ${workspaceId}`,
    tools: cmsTools as Parameters<
      typeof streamingRuntimeMod.StreamingAgentRuntime.prototype.streamTask
    >[0]['tools'],
    memory: undefined,
    getContext: () => ({ agentId: 'cms-stream-agent' }),
  };

  const task = {
    id: `task-${Date.now()}`,
    type: 'instruction',
    description: body.instruction,
  };

  const runtime = new streamingRuntimeMod.StreamingAgentRuntime({
    maxIterations: 10,
    timeout: 120_000,
  });

  return streamSSE(c, async (stream) => {
    const controller = new AbortController();

    // Clean up on client disconnect
    c.req.raw.signal?.addEventListener('abort', () => controller.abort());

    try {
      // llmClient is typed as unknown because it comes from dynamically imported Pro packages;
      // the runtime type is LLMClient when present.
      type StreamTaskParams = Parameters<typeof runtime.streamTask>;
      for await (const chunk of runtime.streamTask(
        agent,
        task,
        llmClient as StreamTaskParams[2],
        controller.signal,
      )) {
        await stream.writeSSE({
          data: JSON.stringify(chunk),
          event: chunk.type,
        });

        if (chunk.type === 'done' || chunk.type === 'error') break;
      }
    } catch (error) {
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        event: 'error',
      });
    }
  });
});

export default app;
