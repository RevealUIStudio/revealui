/**
 * Agent Stream Route
 *
 * POST /api/agent-stream → text/event-stream (SSE)
 *
 * Streams agent execution events in real-time using Hono's streamSSE helper.
 * Each AgentStreamChunk becomes one "data: {...}\n\n" SSE event.
 *
 * Client-side: use fetch + ReadableStream (not EventSource  -  it doesn't support POST).
 * See packages/ai/src/client/hooks/useAgentStream.ts for the React hook.
 */

import { logger } from '@revealui/core/observability/logger';
import type { ElicitationHandler, McpClient, SamplingHandler } from '@revealui/mcp/client';
import { createRevvaultVault } from '@revealui/mcp/oauth';
import {
  buildRemoteMcpClient,
  listConnectedMcpServers,
  RemoteServerNotConnectedError,
} from '@revealui/mcp/remote-client';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { type SSEStreamingApi, streamSSE } from 'hono/streaming';
import {
  awaitElicitationResponse,
  createAgentRunSession,
  deleteAgentRunSession,
} from '../lib/agent-run-sessions.js';
import { recordUsageMeter } from '../lib/metering.js';
import { getEntitlementsFromContext } from '../middleware/entitlements.js';

type Variables = {
  tenant?: { id: string };
  user?: { id: string; role: string };
  /** Set by requireAIAccess middleware  -  local = free tier inference */
  aiAccessMode?: 'local';
};

const app = new OpenAPIHono<{ Variables: Variables }>();

const agentStreamRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['agent'],
  summary: 'Stream agent execution via SSE',
  description:
    'Streams agent execution events in real-time using Server-Sent Events. Client-side: use fetch + ReadableStream (not EventSource  -  it does not support POST).',
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
            mode: z.enum(['admin', 'coding']).default('admin').optional(),
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

  // Free tier: local inference only (Ollama or inference snaps)
  const aiAccessMode = c.get('aiAccessMode');
  const isLocalOnly = aiAccessMode === 'local';

  let llmClient: unknown;
  try {
    if (isLocalOnly) {
      // Free tier: force local provider regardless of other env vars
      type LLMConfig = ConstructorParameters<typeof llmClientMod.LLMClient>[0];
      const localBaseURL = process.env.INFERENCE_SNAPS_BASE_URL ?? process.env.OLLAMA_BASE_URL;
      const localProvider = process.env.INFERENCE_SNAPS_BASE_URL ? 'inference-snaps' : 'ollama';
      llmClient = new llmClientMod.LLMClient({
        provider: localProvider as LLMConfig['provider'],
        apiKey: localProvider,
        baseURL: localBaseURL,
        model: process.env.LLM_MODEL ?? 'gemma4:e2b',
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
  const mode = body.mode ?? 'admin';

  // Load admin tools so the agent can manage content, media, users, globals
  let cmsTools: unknown[] = [];
  try {
    const cmsToolsMod = await import('@revealui/ai/tools/admin').catch(() => null);
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

      const { createInternalAdminClient } = await import('../lib/internal-admin-client.js');
      const apiClient = createInternalAdminClient(apiBase, sessionToken);

      cmsTools = cmsToolsMod.createAdminTools({ apiClient });
    }
  } catch {
    // admin tools unavailable  -  agent will work without them
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
      // Coding tools unavailable  -  agent will work with admin tools only
    }
  }

  const allTools: unknown[] = [...cmsTools, ...codingTools];

  // ─── Stage 5 + 6 integration (A.1 / A.2a / A.2b) ──────────────────────
  // Connect the tenant's OAuth-authorized MCP servers and merge their
  // tools into `allTools`. Compose a protocol-log sink that fans
  // Stage 6.1 events into the central logger and, when an `accountId`
  // is resolvable from entitlements, into `usage_meters`. Safe
  // fallback: no tenant header → `mcpClients: []`, just the logger sink.
  //
  // A.2b adds side-channel SSE chunks for sampling + elicitation so the
  // `/admin/agents/:id/run` page (A.2b-frontend) can render live:
  // `streamRef` is a late-binding reference to the SSE stream, captured
  // here via a shared mutable box so per-server handlers built before
  // `streamSSE()` starts can write into the stream once it exists.
  const mcpClients: McpClient[] = [];
  const tenant = c.get('tenant')?.id;
  const accountId = getEntitlementsFromContext(c).accountId;
  const runSession = createAgentRunSession(user.id);
  const streamRef: { current: SSEStreamingApi | undefined } = { current: undefined };

  const loggerSink = aiMod.createCoreLoggerSink();
  const meterSink = accountId
    ? aiMod.createUsageMeterSink({
        accountId,
        write: (row) => recordUsageMeter(row),
      })
    : undefined;
  // Type of the Stage 6.1 event sink, derived from @revealui/ai via
  // the lazy-imported aiMod so apps/api keeps zero static references to
  // the optional Pro package (enforced by scripts/validate/boundary.ts).
  type AiMod = NonNullable<typeof aiMod>;
  type McpEventSink = ReturnType<AiMod['createCoreLoggerSink']>;
  const onEvent: McpEventSink = meterSink
    ? (event) => {
        loggerSink(event);
        meterSink(event);
      }
    : loggerSink;

  if (tenant) {
    let serverIds: string[] = [];
    try {
      serverIds = await listConnectedMcpServers(createRevvaultVault(), tenant);
    } catch (error) {
      logger.warn('[agent-stream] failed to list MCP servers for tenant', {
        tenant,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // A.2a: Sampling handler allowlist. MCP servers may request any model
    // via `modelPreferences.hints`; we filter those hints to this list so
    // servers can't silently route us to expensive models. Models outside
    // the list fall back to `defaultModel`. Conservative set — extend when
    // specific models are validated + cost-bounded.
    const samplingAllowedModels = [
      'gemma3',
      'gemma3:e2b',
      'gemma3:e4b',
      'deepseek-r1',
      'qwen3',
    ] as const;
    const samplingDefaultModel = process.env.LLM_MODEL ?? 'gemma3';

    for (const server of serverIds) {
      try {
        // A.2a: base per-server sampling handler. The `as unknown as` cast
        // documents the known @revealui/ai vs @revealui/mcp SamplingHandler
        // type mismatch (simplified content shape vs SDK union). See
        // `.jv/docs/admin-mcp-integration-scope.md` §A.2a for the deferred
        // real fix (widening `McpSamplingRequestParams.messages[].content`).
        const innerSamplingHandler = aiMod.createSamplingHandler({
          llm: llmClient as Parameters<typeof aiMod.createSamplingHandler>[0]['llm'],
          allowedModels: samplingAllowedModels,
          defaultModel: samplingDefaultModel,
          namespace: server,
          onEvent,
        }) as unknown as SamplingHandler;

        // A.2b: wrap the sampling handler with a chunk-emit wrapper so the
        // UI can render a "sampling in progress" card alongside the event.
        // Chunk is best-effort — emit errors are swallowed so a stream
        // write never breaks the underlying MCP handler call.
        const samplingHandler: SamplingHandler = async (params) => {
          try {
            await streamRef.current?.writeSSE({
              event: 'sampling_request',
              data: JSON.stringify({
                type: 'sampling_request',
                sessionId: runSession.sessionId,
                namespace: server,
                sampling: {
                  model: samplingDefaultModel,
                  messageCount: params.messages.length,
                  maxTokens: params.maxTokens,
                },
              }),
            });
          } catch (emitError) {
            logger.warn('[agent-stream] sampling_request chunk emit failed', {
              server,
              error: emitError instanceof Error ? emitError.message : String(emitError),
            });
          }
          return innerSamplingHandler(params);
        };

        // A.2b: per-server elicitation handler. When the MCP server calls
        // `elicitation/create`, write the request to the SSE stream with a
        // unique elicitationId, then park on the run-session registry
        // until the client POSTs a response to /api/agent-stream/elicit.
        // Missing stream = cancel (client never registered, so no UI can
        // respond); missing session (e.g. after teardown) likewise cancels
        // via the registry's fallback.
        //
        // URL-mode elicitation is auto-declined — the client UI only
        // supports form mode, and URL mode routes the user-agent to a
        // server-supplied URL which is a social-engineering risk without
        // explicit UI that shows the URL and requires a user click. When
        // URL mode becomes a deliberate product decision, re-enable it
        // alongside that UI (A.2b-frontend or a follow-up).
        const elicitationHandler: ElicitationHandler = async (params) => {
          if ('mode' in params && params.mode === 'url') {
            return { action: 'decline' };
          }
          const elicitationId = crypto.randomUUID();
          const stream = streamRef.current;
          if (!stream) return { action: 'cancel' };
          try {
            await stream.writeSSE({
              event: 'elicitation_request',
              data: JSON.stringify({
                type: 'elicitation_request',
                sessionId: runSession.sessionId,
                namespace: server,
                elicitation: {
                  elicitationId,
                  requestedSchema: params.requestedSchema,
                  ...(params.message ? { message: params.message } : {}),
                },
              }),
            });
          } catch (emitError) {
            logger.warn('[agent-stream] elicitation_request chunk emit failed', {
              server,
              error: emitError instanceof Error ? emitError.message : String(emitError),
            });
            return { action: 'cancel' };
          }
          return awaitElicitationResponse(runSession.sessionId, elicitationId);
        };

        const built = await buildRemoteMcpClient({
          tenant,
          server,
          samplingHandler,
          elicitationHandler,
        });
        await built.client.connect();
        const mcpTools = await aiMod.createToolsFromMcpClient(built.client, {
          namespace: server,
          onEvent,
        });
        mcpClients.push(built.client);
        allTools.push(...mcpTools);
      } catch (error) {
        // Per-server isolation — one server failing doesn't break the
        // whole agent call. Re-auth required is silent (expected).
        if (!(error instanceof RemoteServerNotConnectedError)) {
          logger.warn('[agent-stream] failed to connect MCP server', {
            tenant,
            server,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

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
    id: mode === 'coding' ? 'coding-stream-agent' : 'admin-stream-agent',
    name: mode === 'coding' ? 'Coding Agent' : 'Admin Stream Agent',
    instructions: `You are an AI-powered ${mode === 'coding' ? 'coding and admin' : 'admin management'} assistant for RevealUI. You can help users manage their content, media, users, and settings through natural conversation.

When asked to modify the admin, use the available tools. Be conversational and explain what you're doing. For destructive operations (delete), confirm the user's intent first.${codingInstructions}

Workspace: ${workspaceId}`,
    tools: allTools as Parameters<
      typeof streamingRuntimeMod.StreamingAgentRuntime.prototype.streamTask
    >[0]['tools'],
    memory: undefined,
    getContext: () => ({ agentId: 'admin-stream-agent' }),
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

    // A.2b: publish the agent-run session id to the client as the first
    // chunk so it knows what sessionId to POST to /api/agent-stream/elicit
    // when an `elicitation_request` chunk lands. Also populates the
    // late-binding streamRef so the sampling/elicitation handlers built
    // above can now write side-channel chunks.
    streamRef.current = stream;
    await stream.writeSSE({
      event: 'session_info',
      data: JSON.stringify({
        type: 'session_info',
        sessionId: runSession.sessionId,
      }),
    });

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
    } finally {
      // Tear down any MCP clients we connected at handler entry so
      // sockets + OAuth-refresh timers don't leak across requests.
      for (const client of mcpClients) {
        await client.close().catch(() => undefined);
      }
      // A.2b: delete the run session. Any still-pending elicitation
      // handlers resolve with `{ action: 'cancel' }` so the MCP servers
      // can complete their `elicitation/create` requests cleanly.
      deleteAgentRunSession(runSession.sessionId);
      streamRef.current = undefined;
    }
  });
});

export default app;
