/**
 * A2A (Agent-to-Agent) Protocol Routes
 *
 * Implements the Google A2A specification over HTTP/JSON-RPC 2.0.
 *
 * Well-known discovery:
 *   GET /.well-known/agent.json          — platform-level agent card
 *   GET /.well-known/agents/:id/agent.json — per-agent card
 *
 * A2A task API:
 *   POST /a2a                            — JSON-RPC dispatcher (tasks/send, tasks/get, tasks/cancel)
 *   GET  /a2a/agents                     — list all registered agents as A2A cards
 *   GET  /a2a/agents/:id                 — single agent card
 *   GET  /a2a/stream/:taskId             — SSE stream for a running task
 *
 * Task execution (tasks/send, tasks/sendSubscribe) is gated behind the 'ai' feature flag.
 * Discovery endpoints (agent.json, /a2a/agents) are public — no auth required.
 */

import type { A2AJsonRpcRequest } from '@revealui/contracts'
import { A2AJsonRpcRequestSchema, AgentDefinitionSchema } from '@revealui/contracts'
import { isFeatureEnabled } from '@revealui/core/features'
import { logger } from '@revealui/core/observability/logger'
import { getClient } from '@revealui/db'
import { agentActions, marketplaceServers, registeredAgents } from '@revealui/db/schema'
import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { requireFeature } from '../middleware/license.js'
import { requireTaskQuota } from '../middleware/task-quota.js'
import { buildPaymentMethods } from '../middleware/x402.js'

// JSON-RPC error codes (inlined — avoids static import of @revealui/ai)
const RPC_PARSE_ERROR = -32700
const RPC_INVALID_REQUEST = -32600

// Lazy-loaded @revealui/ai module — cached after first successful import
let aiModulePromise: Promise<typeof import('@revealui/ai') | null> | null = null

function getAiModule(): Promise<typeof import('@revealui/ai') | null> {
  if (!aiModulePromise) {
    aiModulePromise = import('@revealui/ai').catch(() => null)
  }
  return aiModulePromise
}

let aiLlmServerPromise: Promise<typeof import('@revealui/ai/llm/server') | null> | null = null

function getAiLlmServerModule(): Promise<typeof import('@revealui/ai/llm/server') | null> {
  if (!aiLlmServerPromise) {
    aiLlmServerPromise = import('@revealui/ai/llm/server').catch(() => null)
  }
  return aiLlmServerPromise
}

interface UserContext {
  id: string
  email: string | null
  name: string
  role: string
}

const app = new Hono()

// Base URL for generating agent card URLs
// x-forwarded-proto is set by Vercel's edge when TLS is terminated at the proxy
function getBaseUrl(req: Request): string {
  const url = new URL(req.url)
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${url.host}`
}

// Build an LLMClient from BYOK headers (X-AI-Provider + X-AI-Api-Key).
// Keys are never stored — they exist only for the duration of this request.
const VALID_PROVIDERS = new Set<string>(['openai', 'anthropic', 'groq', 'ollama', 'vultr'])
async function llmClientFromRequest(req: Request): Promise<unknown | undefined> {
  const provider = req.headers.get('X-AI-Provider')
  const apiKey = req.headers.get('X-AI-Api-Key')
  if (!(provider && apiKey && VALID_PROVIDERS.has(provider))) return undefined
  const llmMod = await getAiLlmServerModule()
  if (!llmMod) return undefined
  return new llmMod.LLMClient({ provider: provider as string, apiKey })
}

// =============================================================================
// Well-known discovery endpoints (public, no auth)
// =============================================================================

/** Platform-level agent card */
app.get('/agent.json', async (c) => {
  const aiMod = await getAiModule()
  if (!aiMod) {
    return c.json({ error: 'AI package not available' }, 503)
  }
  const baseUrl = getBaseUrl(c.req.raw)
  const card = aiMod.agentCardRegistry.getCard('revealui-creator', baseUrl)
  if (!card) {
    return c.json({ error: 'Agent not found' }, 404)
  }
  return c.json(card, 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
  })
})

/** Per-agent card at /.well-known/agents/:id/agent.json */
app.get('/agents/:id/agent.json', async (c) => {
  const aiMod = await getAiModule()
  if (!aiMod) {
    return c.json({ error: 'AI package not available' }, 503)
  }
  const agentId = c.req.param('id')
  if (!/^[\w-]{1,256}$/.test(agentId)) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }
  const baseUrl = getBaseUrl(c.req.raw)
  const card = aiMod.agentCardRegistry.getCard(agentId, baseUrl)
  if (!card) {
    return c.json({ error: `Agent '${agentId}' not found` }, 404)
  }
  return c.json(card, 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
  })
})

/**
 * MCP Marketplace discovery (Phase 5.5).
 * GET /.well-known/marketplace.json
 *
 * Returns marketplace metadata and the registry URL for agent discovery.
 * Includes a lightweight summary of active servers for quick enumeration.
 */
app.get('/marketplace.json', async (c) => {
  const baseUrl = getBaseUrl(c.req.raw)

  // Fetch active server summaries (name, category, price only — not internal URLs)
  let servers: Array<{
    id: string
    name: string
    description: string
    category: string
    pricePerCallUsdc: string
    invokeUrl: string
  }> = []
  try {
    const db = getClient()
    const rows = await db
      .select({
        id: marketplaceServers.id,
        name: marketplaceServers.name,
        description: marketplaceServers.description,
        category: marketplaceServers.category,
        pricePerCallUsdc: marketplaceServers.pricePerCallUsdc,
      })
      .from(marketplaceServers)
      .where(eq(marketplaceServers.status, 'active'))
      .limit(50)

    servers = rows.map((row) => ({
      ...row,
      invokeUrl: `${baseUrl}/api/marketplace/servers/${row.id}/invoke`,
    }))
  } catch {
    // DB unavailable — return metadata without server list
  }

  return c.json(
    {
      version: '1.0',
      platform: 'revealui',
      registryUrl: `${baseUrl}/api/marketplace/servers`,
      publishUrl: `${baseUrl}/api/marketplace/servers`,
      revenueShare: { platform: 0.2, developer: 0.8 },
      paymentMethods: ['x402-usdc'],
      servers,
    },
    200,
    { 'Cache-Control': 'public, max-age=60' },
  )
})

/**
 * x402 payment methods discovery (Phase 5.2).
 * GET /.well-known/payment-methods.json
 *
 * Returns supported payment schemes for agent task micropayments.
 * Agents can discover how to pay per-task in USDC on Base.
 * Returns 404 when X402_ENABLED=false (default).
 */
app.get('/payment-methods.json', (c) => {
  const baseUrl = getBaseUrl(c.req.raw)
  const methods = buildPaymentMethods(baseUrl)
  if (!methods) {
    return c.json({ error: 'x402 payments not enabled on this instance' }, 404)
  }
  return c.json(methods, 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
  })
})

// =============================================================================
// A2A task API — /a2a/*
// =============================================================================

// biome-ignore lint/style/useNamingConvention: Hono requires PascalCase `Variables`
const a2a = new Hono<{ Variables: { user: UserContext | undefined } }>()

// Soft auth — populates user context when a session cookie is present.
// Not required — anonymous A2A requests are allowed; stored keys are used when authenticated.
a2a.use('*', authMiddleware({ required: false }))

// =============================================================================
// Registry hydration — load custom agents from DB on first request
// =============================================================================

// Built-in agents are always pre-seeded in-memory; never persisted to DB.
const BUILTIN_AGENT_IDS = new Set(['revealui-creator', 'revealui-ticket-agent'])

// Promise singleton — ensures hydration runs exactly once per server instance.
let hydrationPromise: Promise<void> | null = null

async function ensureRegistryHydrated(): Promise<void> {
  if (hydrationPromise) return hydrationPromise
  hydrationPromise = (async () => {
    try {
      const aiMod = await getAiModule()
      if (!aiMod) return // @revealui/ai not installed — skip hydration
      const db = getClient()
      const rows = await db.select().from(registeredAgents)
      for (const row of rows) {
        const parsed = AgentDefinitionSchema.safeParse(row.definition)
        if (parsed.success && !aiMod.agentCardRegistry.has(parsed.data.id)) {
          aiMod.agentCardRegistry.register(parsed.data)
        }
      }
    } catch {
      // DB unavailable — registry remains in-memory only for this instance.
      // Reset so the next request retries hydration.
      hydrationPromise = null
    }
  })()
  return hydrationPromise
}

a2a.use('*', async (_c, next) => {
  await ensureRegistryHydrated()
  return next()
})

/** List all registered agents as A2A agent cards */
a2a.get('/agents', async (c) => {
  const aiMod = await getAiModule()
  if (!aiMod) {
    return c.json({ error: 'AI package not available' }, 503)
  }
  const baseUrl = getBaseUrl(c.req.raw)
  const cards = aiMod.agentCardRegistry.listCards(baseUrl)
  return c.json({ agents: cards })
})

/** Single agent card by ID */
a2a.get('/agents/:id', async (c) => {
  const aiMod = await getAiModule()
  if (!aiMod) {
    return c.json({ error: 'AI package not available' }, 503)
  }
  const agentId = c.req.param('id')
  if (!/^[\w-]{1,256}$/.test(agentId)) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }
  const baseUrl = getBaseUrl(c.req.raw)
  const card = aiMod.agentCardRegistry.getCard(agentId, baseUrl)
  if (!card) {
    return c.json({ error: `Agent '${agentId}' not found` }, 404)
  }
  return c.json(card)
})

/** Full agent definition — admin only, requires 'ai' feature */
a2a.get('/agents/:id/def', authMiddleware({ required: true }), requireFeature('ai'), async (c) => {
  const aiMod = await getAiModule()
  if (!aiMod) {
    return c.json({ error: 'AI package not available' }, 503)
  }
  const agentId = c.req.param('id')
  if (!/^[\w-]{1,256}$/.test(agentId)) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }
  const def = aiMod.agentCardRegistry.getDef(agentId)
  if (!def) {
    return c.json({ error: `Agent '${agentId}' not found` }, 404)
  }
  return c.json({ def })
})

/** Task history for an agent — last 20 actions, requires auth + 'ai' feature */
a2a.get('/agents/:id/tasks', requireFeature('ai'), async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  const agentId = c.req.param('id')
  if (!/^[\w-]{1,256}$/.test(agentId)) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }
  try {
    const db = getClient()
    const rows = await db
      .select()
      .from(agentActions)
      .where(eq(agentActions.agentId, agentId))
      .orderBy(desc(agentActions.startedAt))
      .limit(20)
    return c.json({ tasks: rows })
  } catch {
    return c.json({ tasks: [] })
  }
})

/** Update an agent's mutable fields — requires auth + 'ai' feature */
a2a.put('/agents/:id', authMiddleware({ required: true }), requireFeature('ai'), async (c) => {
  const aiMod = await getAiModule()
  if (!aiMod) {
    return c.json({ error: 'AI package not available' }, 503)
  }
  const agentId = c.req.param('id')
  if (!/^[\w-]{1,256}$/.test(agentId)) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }
  if (!aiMod.agentCardRegistry.has(agentId)) {
    return c.json({ error: `Agent '${agentId}' not found` }, 404)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Request body must be a JSON object' }, 400)
  }

  const allowed = [
    'name',
    'description',
    'systemPrompt',
    'model',
    'temperature',
    'maxTokens',
    'capabilities',
  ] as const
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in (body as Record<string, unknown>)) {
      patch[key] = (body as Record<string, unknown>)[key]
    }
  }

  aiMod.agentCardRegistry.update(
    agentId,
    patch as Parameters<typeof aiMod.agentCardRegistry.update>[1],
  )

  // Persist update to DB for non-built-in agents (best-effort)
  if (!BUILTIN_AGENT_IDS.has(agentId)) {
    try {
      const updatedDef = aiMod.agentCardRegistry.getDef(agentId)
      if (updatedDef) {
        const db = getClient()
        await db
          .update(registeredAgents)
          .set({
            definition: updatedDef,
            updatedAt: new Date(),
          })
          .where(eq(registeredAgents.id, agentId))
      }
    } catch (err) {
      // Non-fatal — update is applied in-memory.
      logger.warn('Agent registry DB update failed (update applied in-memory only)', {
        agentId,
        error: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  const baseUrl = getBaseUrl(c.req.raw)
  const card = aiMod.agentCardRegistry.getCard(agentId, baseUrl)
  return c.json({ card })
})

/** Retire (unregister) an agent — requires auth; built-in platform agents are protected */
a2a.delete('/agents/:id', authMiddleware({ required: true }), requireFeature('ai'), async (c) => {
  const agentId = c.req.param('id')
  if (!/^[\w-]{1,256}$/.test(agentId)) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }

  // Built-in agents cannot be retired
  if (BUILTIN_AGENT_IDS.has(agentId)) {
    return c.json({ error: 'Built-in platform agents cannot be retired' }, 403)
  }

  const aiMod = await getAiModule()
  if (!aiMod) {
    return c.json({ error: 'AI package not available' }, 503)
  }

  const removed = aiMod.agentCardRegistry.unregister(agentId)
  if (!removed) {
    return c.json({ error: `Agent '${agentId}' not found` }, 404)
  }

  // Remove from DB (best-effort)
  try {
    const db = getClient()
    await db.delete(registeredAgents).where(eq(registeredAgents.id, agentId))
  } catch (err) {
    // Non-fatal — agent is unregistered from in-memory registry.
    logger.warn('Agent registry DB delete failed (agent removed from in-memory only)', {
      agentId,
      error: err instanceof Error ? err.message : 'unknown',
    })
  }

  return c.json({ success: true })
})

/**
 * Register a new agent from an AgentDefinition.
 * The agent is added to the in-memory registry for this server's lifetime.
 * Requires authentication + 'ai' feature flag.
 */
a2a.post('/agents', authMiddleware({ required: true }), async (c) => {
  if (!isFeatureEnabled('ai')) {
    return c.json({ error: "Feature 'ai' requires a Pro or Enterprise license." }, 403)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = AgentDefinitionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid agent definition', issues: parsed.error.issues }, 400)
  }

  const aiMod = await getAiModule()
  if (!aiMod) {
    return c.json({ error: 'AI package not available' }, 503)
  }

  const def = parsed.data
  if (aiMod.agentCardRegistry.has(def.id)) {
    return c.json({ error: `Agent '${def.id}' already registered` }, 409)
  }

  aiMod.agentCardRegistry.register(def)

  // Persist to DB (best-effort; registry remains functional if DB write fails)
  try {
    const db = getClient()
    await db.insert(registeredAgents).values({
      id: def.id,
      definition: def,
    })
  } catch (err) {
    // Non-fatal — agent is registered in-memory for this server instance.
    // Log so operators can detect persistent DB write failures on cold starts/redeploys.
    logger.warn('Agent registry DB persist failed (agent registered in-memory only)', {
      agentId: def.id,
      error: err instanceof Error ? err.message : 'unknown',
    })
  }

  const baseUrl = getBaseUrl(c.req.raw)
  const card = aiMod.agentCardRegistry.getCard(def.id, baseUrl)
  return c.json({ card }, 201)
})

/**
 * SSE stream endpoint for tasks/sendSubscribe.
 * The client subscribes here after receiving a taskId from tasks/send.
 *
 * This is a simplified polling-based SSE — for a full streaming implementation
 * the AgentRuntime emits events that are forwarded here.
 */
a2a.get('/stream/:taskId', requireFeature('ai'), async (c) => {
  const aiMod = await getAiModule()
  if (!aiMod) {
    return c.json({ error: 'AI package not available' }, 503)
  }
  const taskId = c.req.param('taskId')

  const getTaskFn = aiMod.getTask
  return c.body(
    new ReadableStream({
      start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        // Poll task store for status updates (simple implementation)
        let iterations = 0
        const maxIterations = 60 // 30s at 500ms interval

        const poll = () => {
          iterations++
          const task = getTaskFn(taskId)

          if (!task) {
            send({ error: `Task '${taskId}' not found` })
            controller.close()
            return
          }

          send(task)

          const terminal = ['completed', 'failed', 'canceled']
          if (terminal.includes(task.status.state) || iterations >= maxIterations) {
            controller.close()
            return
          }

          setTimeout(poll, 500)
        }

        poll()
      },
    }),
    200,
    {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      // biome-ignore lint/style/useNamingConvention: standard HTTP header name
      Connection: 'keep-alive',
    },
  )
})

/**
 * Main A2A JSON-RPC dispatcher.
 * Handles: tasks/send, tasks/get, tasks/cancel, tasks/sendSubscribe
 *
 * tasks/send and tasks/sendSubscribe require the 'ai' feature.
 * tasks/get and tasks/cancel are always allowed.
 */
a2a.post('/', async (c) => {
  const aiMod = await getAiModule()
  if (!aiMod) {
    return c.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: 'AI package not available' },
      },
      503,
    )
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: RPC_PARSE_ERROR, message: 'Parse error: invalid JSON' },
      },
      400,
    )
  }

  const parsed = A2AJsonRpcRequestSchema.safeParse(body)
  if (!parsed.success) {
    const id = (body as Record<string, unknown>)?.id ?? null
    return c.json(
      {
        jsonrpc: '2.0',
        id,
        error: { code: RPC_INVALID_REQUEST, message: 'Invalid Request' },
      },
      400,
    )
  }

  const req: A2AJsonRpcRequest = parsed.data

  // Gate task execution behind feature flag; read-only methods always allowed
  const executionMethods = new Set(['tasks/send', 'tasks/sendSubscribe'])
  if (executionMethods.has(req.method)) {
    if (!isFeatureEnabled('ai')) {
      return c.json(
        {
          jsonrpc: '2.0',
          id: req.id,
          error: {
            code: -32003,
            message: "Feature 'ai' requires a Pro or Enterprise license.",
          },
        },
        403,
      )
    }

    // Check and increment task quota (Track B metering)
    const quotaResponse = await requireTaskQuota(c, async () => {
      // No-op: quota check only, work is performed after quota validation
    })
    if (quotaResponse instanceof Response) {
      return quotaResponse
    }
  }

  // Extract optional agent ID from X-Agent-ID header
  const agentId = c.req.header('X-Agent-ID')

  // Resolve LLM client — priority order:
  //   1. Request-header BYOK (X-AI-Provider + X-AI-Api-Key) — client-side key, highest priority
  //   2. Server-stored key (user_api_keys) — Pro BYOK, resolved from session
  //   3. Stub — no key configured; handler returns a canned response
  let llmClient = await llmClientFromRequest(c.req.raw)
  if (!llmClient) {
    const userId = c.get('user')?.id
    if (userId) {
      const llmServerMod = await getAiLlmServerModule()
      if (llmServerMod) {
        const db = getClient()
        llmClient = (await llmServerMod.createLLMClientForUser(userId, db)) ?? undefined
      }
    }
  }

  const startedAt = Date.now()
  const result = await aiMod.handleA2AJsonRpc(req, agentId ?? undefined, llmClient)
  const completedAt = Date.now()

  // Fire-and-forget: persist task execution record to agentActions
  if (executionMethods.has(req.method)) {
    const taskResult = result.result as { status?: { state?: string } } | null
    const status = taskResult?.status?.state === 'failed' ? 'failed' : 'completed'
    void (async () => {
      try {
        const db = getClient()
        await db.insert(agentActions).values({
          id: crypto.randomUUID(),
          agentId: agentId ?? 'revealui-creator',
          tool: req.method,
          params: (req.params ?? null) as Record<string, unknown> | null,
          result: taskResult as Record<string, unknown> | null,
          status,
          startedAt: new Date(startedAt),
          completedAt: new Date(completedAt),
          durationMs: completedAt - startedAt,
        })
      } catch {
        // Non-fatal — in-memory task store remains authoritative for active tasks
      }
    })()
  }

  return c.json(result)
})

export { app as wellKnownRoutes, a2a as a2aRoutes }
