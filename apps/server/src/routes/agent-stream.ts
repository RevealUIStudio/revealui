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
import { getClient } from '@revealui/db';
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
import { resolveStreamPrincipal } from '../lib/agent-principal.js';
import {
  awaitElicitationResponse,
  createAgentRunSession,
  deleteAgentRunSession,
} from '../lib/agent-run-sessions.js';
import { recordAgentMcpToolAudit } from '../lib/agent-tool-audit.js';
import { applyAgentToolGovernance } from '../lib/agent-tool-governance.js';
import { createAgentEventLoggerIfEnabled } from '../lib/ai-observability-wire.js';
import { createSkillProviderIfEnabled } from '../lib/ai-skills-wire.js';
import { createAuditStore } from '../lib/audit-signer.js';
import { asLLMNotConfigured } from '../lib/llm-not-configured.js';
import { recordUsageMeter } from '../lib/metering.js';
import { detectDeploymentMode, type EnvMap } from '../lib/validate-startup.js';
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
    409: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
            code: z.literal('LLM_NOT_CONFIGURED'),
            settingsPath: z.string(),
          }),
        },
      },
      description: 'Hosted account has no LLM provider configured (set one at /settings/api-keys)',
    },
  },
});

app.openapi(agentStreamRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  const body = c.req.valid('json');

  // Dynamically load optional Pro package @revealui/ai (must not claim Free on miss).
  const { loadAgentStreamAiModules, aiModuleUnavailableBody, aiResolveFailedBody } = await import(
    '../lib/ai-module-loader.js'
  );
  const aiMods = await loadAgentStreamAiModules();
  if (!aiMods) {
    return c.json(aiModuleUnavailableBody(), 503);
  }
  const { ai: aiMod, llmClient: llmClientMod, streamingRuntime: streamingRuntimeMod } = aiMods;

  // Free tier: local inference only (Ollama or inference snaps)
  const aiAccessMode = c.get('aiAccessMode');
  const isLocalOnly = aiAccessMode === 'local';

  let llmClient: unknown;
  if (isLocalOnly) {
    // Free tier: force local provider regardless of other env vars. Untouched
    // by GAP-360 — the free/local path never resolves a per-account key.
    try {
      type LLMConfig = ConstructorParameters<typeof llmClientMod.LLMClient>[0];
      const localBaseURL = process.env.INFERENCE_SNAPS_BASE_URL ?? process.env.OLLAMA_BASE_URL;
      const localProvider = process.env.INFERENCE_SNAPS_BASE_URL ? 'inference-snaps' : 'ollama';
      llmClient = new llmClientMod.LLMClient({
        provider: localProvider as LLMConfig['provider'],
        apiKey: localProvider,
        baseURL: localBaseURL,
        // Lockstep packages/ai DEFAULT_DAILY_OLLAMA_MODEL when ollama
        model: process.env.LLM_MODEL ?? 'qwen2.5:3b',
      });
    } catch (err) {
      logger.error('[agent-stream] local LLM client construct failed', {
        message: err instanceof Error ? err.message : String(err),
      });
      return c.json(aiResolveFailedBody('local inference client'), 500);
    }
  } else {
    // Paid path: resolve per-account BYOK on hosted, env on self-hosted. userId
    // comes from the authenticated session (§6.1), never the request body.
    try {
      const db = getClient();
      llmClient = await aiMod.resolveLLMClientForRequest(user.id, db, {
        isHosted: detectDeploymentMode(process.env as EnvMap) === 'hosted',
        workspaceId: body.workspaceId ?? c.get('tenant')?.id,
        auditStore: createAuditStore(db),
      });
    } catch (err) {
      const notConfigured = asLLMNotConfigured(err);
      if (notConfigured) {
        return c.json(notConfigured, 409);
      }
      logger.error('[agent-stream] resolveLLMClientForRequest failed', {
        message: err instanceof Error ? err.message : String(err),
      });
      return c.json(aiResolveFailedBody(), 500);
    }
  }

  const workspaceId = body.workspaceId ?? c.get('tenant')?.id ?? 'default';
  const mode = body.mode ?? 'admin';
  const accountId = getEntitlementsFromContext(c).accountId;
  const tenantId = c.get('tenant')?.id ?? null;
  const runSession = createAgentRunSession(user.id);
  // Late-bound task id for tool-audit rows (task object is built after tools).
  const taskRef: { id: string } = { id: `task-${Date.now()}` };

  // GAP-355 S6-1: server-derived principal for pre-authorize (never client input).
  const streamPrincipal = resolveStreamPrincipal({
    mode,
    userId: user.id,
    userRole: user.role,
    tenantId,
    accountId,
  });
  const streamAgentId = streamPrincipal.agentId;

  // GAP-355 S5-4: integrity audit for non-MCP tools (admin CMS + coding).
  const streamToolAudit =
    (namespace: string) =>
    async (event: {
      toolName: string;
      success: boolean;
      duration_ms: number;
      error?: string;
    }): Promise<void> => {
      await recordAgentMcpToolAudit({
        namespace,
        toolName: event.toolName,
        success: event.success,
        durationMs: event.duration_ms,
        ...(event.error !== undefined ? { error: event.error } : {}),
        sessionId: runSession.sessionId,
        accountId,
        userId: user.id,
        agentId: streamPrincipal.agentId,
        taskId: taskRef.id,
      });
    };

  const governanceCtx = (namespace: string) => ({
    principal: streamPrincipal,
    namespace,
    sessionId: runSession.sessionId,
    accountId,
    userId: user.id,
    taskId: taskRef.id,
  });

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

      // Integrity (S5) inside factory; governance (S6) wraps outside so deny
      // never executes the tool.
      const rawAdmin = cmsToolsMod.createAdminTools({
        apiClient,
        onToolAudit: streamToolAudit('admin-cms'),
      });
      cmsTools = applyAgentToolGovernance(rawAdmin, governanceCtx('admin-cms'));
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
          onToolAudit?: (event: {
            toolName: string;
            success: boolean;
            duration_ms: number;
            error?: string;
          }) => void | Promise<void>;
        }) => unknown[];
        const rawCoding = createCodingTools({
          projectRoot,
          allowedPaths: process.env.CODING_ALLOWED_PATHS?.split(','),
          // Local (free tier): only read-only tools (no file_write, file_edit, shell_exec, git_ops)
          ...(isLocalOnly && { include: readOnlyCodingTools }),
          onToolAudit: streamToolAudit('coding'),
        }) as Array<{ name: string; execute: (params: unknown) => Promise<unknown> }>;
        codingTools = applyAgentToolGovernance(rawCoding, governanceCtx('coding'));
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
  const streamRef: { current: SSEStreamingApi | undefined } = { current: undefined };

  const loggerSink = aiMod.createCoreLoggerSink();
  const meterSink = accountId
    ? aiMod.createUsageMeterSink({
        accountId,
        write: (row) => recordUsageMeter(row),
      })
    : undefined;
  // Type of the Stage 6.1 event sink, derived from @revealui/ai via
  // the lazy-imported aiMod so apps/server keeps zero static references to
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
    // servers can't silently route us off the product US-origin snap set.
    // SSOT: @revealui/ai US_ORIGIN_INFERENCE_SNAP_IDS.
    const samplingAllowedModels = [...aiMod.US_ORIGIN_INFERENCE_SNAP_IDS];
    const samplingDefaultModel = process.env.LLM_MODEL ?? aiMod.DEFAULT_US_ORIGIN_INFERENCE_SNAP;

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
          // GAP-355 S5-2: integrity audit (awaited, fail-closed on success).
          onToolAudit: async (event) => {
            await recordAgentMcpToolAudit({
              namespace: event.namespace,
              toolName: event.toolName,
              success: event.success,
              durationMs: event.duration_ms,
              ...(event.error !== undefined ? { error: event.error } : {}),
              sessionId: runSession.sessionId,
              accountId,
              userId: user.id,
              agentId: mode === 'coding' ? 'coding-stream-agent' : 'admin-stream-agent',
              taskId: taskRef.id,
            });
          },
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
    id: taskRef.id,
    type: 'instruction',
    description: body.instruction,
  };

  // GAP-406 phase 4: opt-in skills + agent event logger (env-gated wire modules).
  const skillProvider = await createSkillProviderIfEnabled();
  const agentEventLogger = await createAgentEventLoggerIfEnabled();
  if (agentEventLogger) {
    agentEventLogger.logDecision({
      timestamp: Date.now(),
      agentId: mode === 'coding' ? 'coding-stream-agent' : 'admin-stream-agent',
      sessionId: runSession.sessionId,
      reasoning: `agent_stream_start mode=${mode}`,
      context: { mode },
    });
  }

  // skillProvider is loaded via dynamic import (boundary); cast through never
  // so RuntimeConfig accepts it without a static @revealui/ai/skills type import.
  const runtime = new streamingRuntimeMod.StreamingAgentRuntime({
    maxIterations: 10,
    timeout: 120_000,
    ...(skillProvider ? { skillProvider: skillProvider as never } : {}),
  });

  const auditStore = createAuditStore(getClient());

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

    // GAP-355 S5-2: task start — fail closed if we cannot record.
    try {
      await auditStore.append({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        eventType: 'agent:task:started',
        severity: 'info',
        agentId: streamAgentId,
        taskId: task.id,
        sessionId: runSession.sessionId,
        payload: {
          mode,
          userId: user.id,
          instructionPreview: body.instruction.slice(0, 200),
        },
        policyViolations: [],
        tenant: accountId ?? null,
      });
    } catch (startAuditErr) {
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'error',
          error:
            startAuditErr instanceof Error
              ? `Audit start failed: ${startAuditErr.message}`
              : 'Audit start failed',
        }),
        event: 'error',
      });
      return;
    }

    let taskOk = false;
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

        if (chunk.type === 'done') {
          taskOk = true;
          break;
        }
        if (chunk.type === 'error') break;
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
      try {
        await auditStore.append({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          eventType: taskOk ? 'agent:task:completed' : 'agent:task:failed',
          severity: taskOk ? 'info' : 'warn',
          agentId: streamAgentId,
          taskId: task.id,
          sessionId: runSession.sessionId,
          payload: { success: taskOk, mode },
          policyViolations: [],
          tenant: accountId ?? null,
        });
      } catch {
        // Completion audit best-effort after stream ends
      }
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
