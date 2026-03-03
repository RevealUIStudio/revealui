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

import {
  agentCardRegistry,
  getTask,
  handleA2AJsonRpc,
  RPC_INVALID_REQUEST,
  RPC_PARSE_ERROR,
} from '@revealui/ai'
import type { A2AJsonRpcRequest } from '@revealui/contracts'
import { A2AJsonRpcRequestSchema, AgentDefinitionSchema } from '@revealui/contracts'
import { isFeatureEnabled } from '@revealui/core/features'
import { Hono } from 'hono'
import { requireFeature } from '../middleware/license.js'

const app = new Hono()

// Base URL for generating agent card URLs
// x-forwarded-proto is set by Vercel's edge when TLS is terminated at the proxy
function getBaseUrl(req: Request): string {
  const url = new URL(req.url)
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${url.host}`
}

// =============================================================================
// Well-known discovery endpoints (public, no auth)
// =============================================================================

/** Platform-level agent card */
app.get('/agent.json', (c) => {
  const baseUrl = getBaseUrl(c.req.raw)
  const card = agentCardRegistry.getCard('revealui-creator', baseUrl)
  if (!card) {
    return c.json({ error: 'Agent not found' }, 404)
  }
  return c.json(card, 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
  })
})

/** Per-agent card at /.well-known/agents/:id/agent.json */
app.get('/agents/:id/agent.json', (c) => {
  const agentId = c.req.param('id')
  const baseUrl = getBaseUrl(c.req.raw)
  const card = agentCardRegistry.getCard(agentId, baseUrl)
  if (!card) {
    return c.json({ error: `Agent '${agentId}' not found` }, 404)
  }
  return c.json(card, 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
  })
})

// =============================================================================
// A2A task API — /a2a/*
// =============================================================================

const a2a = new Hono()

/** List all registered agents as A2A agent cards */
a2a.get('/agents', (c) => {
  const baseUrl = getBaseUrl(c.req.raw)
  const cards = agentCardRegistry.listCards(baseUrl)
  return c.json({ agents: cards })
})

/** Single agent card by ID */
a2a.get('/agents/:id', (c) => {
  const agentId = c.req.param('id')
  const baseUrl = getBaseUrl(c.req.raw)
  const card = agentCardRegistry.getCard(agentId, baseUrl)
  if (!card) {
    return c.json({ error: `Agent '${agentId}' not found` }, 404)
  }
  return c.json(card)
})

/** Full agent definition — admin only, requires 'ai' feature */
a2a.get('/agents/:id/def', requireFeature('ai'), (c) => {
  const agentId = c.req.param('id')
  const def = agentCardRegistry.getDef(agentId)
  if (!def) {
    return c.json({ error: `Agent '${agentId}' not found` }, 404)
  }
  return c.json({ def })
})

/** Update an agent's mutable fields — requires 'ai' feature */
a2a.put('/agents/:id', requireFeature('ai'), async (c) => {
  const agentId = c.req.param('id')
  if (!agentCardRegistry.has(agentId)) {
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

  agentCardRegistry.update(agentId, patch as Parameters<typeof agentCardRegistry.update>[1])
  const baseUrl = getBaseUrl(c.req.raw)
  const card = agentCardRegistry.getCard(agentId, baseUrl)
  return c.json({ card })
})

/**
 * Register a new agent from an AgentDefinition.
 * The agent is added to the in-memory registry for this server's lifetime.
 * Requires 'ai' feature flag.
 */
a2a.post('/agents', async (c) => {
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

  const def = parsed.data
  if (agentCardRegistry.has(def.id)) {
    return c.json({ error: `Agent '${def.id}' already registered` }, 409)
  }

  agentCardRegistry.register(def)
  const baseUrl = getBaseUrl(c.req.raw)
  const card = agentCardRegistry.getCard(def.id, baseUrl)
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
  const taskId = c.req.param('taskId')

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
          const task = getTask(taskId)

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
  }

  // Extract optional agent ID from X-Agent-ID header
  const agentId = c.req.header('X-Agent-ID')
  const result = await handleA2AJsonRpc(req, agentId ?? undefined)

  return c.json(result)
})

export { app as wellKnownRoutes, a2a as a2aRoutes }
