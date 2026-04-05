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

type Variables = {
  tenant?: { id: string };
  user?: { id: string; role: string };
  /** Set by requireAIAccess middleware — local = BitNet (free tier) */
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
            mode: z.enum(['cms', 'coding']).default('cms').optional(),
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

  // Free tier: BitNet local inference only
  const aiAccessMode = c.get('aiAccessMode');
  const isLocalOnly = aiAccessMode === 'local';

  let llmClient: unknown;
  try {
    if (isLocalOnly) {
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
  const mode = body.mode ?? 'cms';

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
      let sessionToken = '';
      for (const pair of cookieHeader.split(';')) {
        const trimmed = pair.trim();
        if (trimmed.startsWith('revealui-session=')) {
          sessionToken = trimmed.slice('revealui-session='.length);
          break;
        }
      }

      const { createInternalCMSClient } = await import('../lib/internal-cms-client.js');
      const apiClient = createInternalCMSClient(apiBase, sessionToken);

      cmsTools = cmsToolsMod.createCMSTools({ apiClient });
    }
  } catch {
    // CMS tools unavailable — agent will work without them
  }

  // Read-only coding tools allowed for free tier (local inference)
  const readOnlyCodingTools = ['file_read', 'file_glob', 'file_grep', 'project_context'];

  // Load coding tools when mode is 'coding'
  let codingTools: unknown[] = [];
  if (mode === 'coding') {
    try {
      // Store path in variable to prevent TypeScript from resolving the module
      const codingToolsPath = '@revealui/ai/tools/coding';
      const codingToolsMod = (await import(codingToolsPath).catch(() => null)) as Record<
        string,
        unknown
      > | null;
      if (codingToolsMod) {
        const projectRoot = process.env.PROJECT_ROOT ?? process.cwd();
        const createCodingTools = codingToolsMod.createCodingTools as (config: {
          projectRoot: string;
          allowedPaths?: string[];
          include?: string[];
        }) => unknown[];
        codingTools = createCodingTools({
          projectRoot,
          allowedPaths: process.env.CODING_ALLOWED_PATHS?.split(','),
          // Local (free tier): only read-only tools (no file_write, file_edit, shell_exec, git_ops)
          ...(isLocalOnly && { include: readOnlyCodingTools }),
        });
      }
    } catch {
      // Coding tools unavailable — agent will work with CMS tools only
    }
  }

  const allTools = [...cmsTools, ...codingTools];

  const localDisclaimer = isLocalOnly
    ? '\n\nYou are in free tier mode. You can read and search code but cannot make edits, run commands, or perform git operations. Upgrade to Pro for full coding capabilities.'
    : '';

  const codingInstructions =
    mode === 'coding'
      ? isLocalOnly
        ? `\n\nYou have access to read-only coding tools for understanding the project:
- Reading files (file_read)
- Searching the codebase (file_grep for content, file_glob for files)
- Querying project context (project_context for rules and conventions)${localDisclaimer}`
        : `\n\nYou also have access to coding tools for reading, writing, editing, and searching files in the project. You can run shell commands and git operations. Use these to help with development tasks like:
- Reading and understanding code
- Making code changes (file_edit for targeted edits, file_write for new files)
- Searching the codebase (file_grep for content, file_glob for files)
- Running commands (shell_exec for build/test/lint)
- Git operations (git_ops for status, diff, log, blame)
- Querying project context (project_context for rules and conventions)

Always confirm before making destructive changes. Explain what you're doing as you work.`
      : '';

  const agent = {
    id: mode === 'coding' ? 'coding-stream-agent' : 'cms-stream-agent',
    name: mode === 'coding' ? 'Coding Agent' : 'CMS Stream Agent',
    instructions: `You are an AI-powered ${mode === 'coding' ? 'coding and CMS' : 'CMS management'} assistant for RevealUI. You can help users manage their content, media, users, and settings through natural conversation.

When asked to modify the CMS, use the available tools. Be conversational and explain what you're doing. For destructive operations (delete), confirm the user's intent first.${codingInstructions}

Workspace: ${workspaceId}`,
    tools: allTools as Parameters<
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
