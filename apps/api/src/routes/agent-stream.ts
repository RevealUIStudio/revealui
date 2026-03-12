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

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

type Variables = {
  tenant?: { id: string };
};

// biome-ignore lint/style/useNamingConvention: Hono requires PascalCase `Variables` in its generic type parameter
const app = new Hono<{ Variables: Variables }>();

app.post('/', async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    instruction?: string;
    boardId?: string;
    workspaceId?: string;
    priority?: string;
  } | null;

  if (!body?.instruction) {
    return c.json({ success: false, error: 'instruction is required' }, 400);
  }

  // Dynamically load @revealui/ai modules
  const [aiMod, llmClientMod, streamingRuntimeMod] = await Promise.all([
    import('@revealui/ai').catch(() => null),
    import('@revealui/ai/llm/client').catch(() => null),
    import('@revealui/ai/orchestration/streaming-runtime').catch(() => null),
  ]);

  if (!(aiMod && llmClientMod && streamingRuntimeMod)) {
    return c.json({ success: false, error: 'AI package not available' }, 503);
  }

  // BYOK: accept API key via Authorization header (never in request body)
  const authHeader = c.req.header('Authorization');
  const byokKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  let llmClient: unknown;
  try {
    if (byokKey) {
      // Detect provider from API key prefix format
      const provider = byokKey.startsWith('sk-ant-')
        ? 'anthropic'
        : byokKey.startsWith('sk-')
          ? 'openai'
          : 'groq';
      const model =
        provider === 'anthropic'
          ? 'claude-sonnet-4-5-20250514'
          : provider === 'openai'
            ? 'gpt-4o'
            : 'llama-3.3-70b-versatile';
      llmClient = new llmClientMod.LLMClient({
        provider,
        apiKey: byokKey,
        model,
      });
    } else {
      llmClient = aiMod.createLLMClientFromEnv();
    }
  } catch {
    return c.json({ success: false, error: 'AI provider not configured' }, 503);
  }

  const workspaceId = body.workspaceId ?? c.get('tenant')?.id ?? 'default';

  const agent = {
    id: 'stream-agent',
    name: 'Stream Agent',
    instructions: `You are a helpful AI assistant for RevealUI workspace ${workspaceId}. Complete the user's request accurately and concisely.`,
    tools: [],
    memory: undefined,
    getContext: () => ({ agentId: 'stream-agent' }),
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
