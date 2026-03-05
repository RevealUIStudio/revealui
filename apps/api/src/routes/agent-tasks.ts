/**
 * Agent Task Routes
 *
 * The intake layer between natural language and business outcomes.
 *
 * POST /api/agent-tasks
 *   Accepts a natural language instruction, creates a ticket, dispatches
 *   an agent to resolve it, and returns the outcome.
 *
 * POST /api/agent-tasks/:ticketId/dispatch
 *   Dispatches an agent for an existing ticket. Use this when a ticket
 *   was created manually and you want to hand it to the agent system.
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { createLLMClientFromEnv, TicketAgentDispatcher } from '@revealui/ai'
import type { DatabaseClient } from '@revealui/db/client'
import * as boardQueries from '@revealui/db/queries/boards'
import * as commentQueries from '@revealui/db/queries/ticket-comments'
import * as ticketQueries from '@revealui/db/queries/tickets'
import { agentMemories } from '@revealui/db/schema/agents'

type Variables = {
  db: DatabaseClient
  tenant?: { id: string }
}

// biome-ignore lint/style/useNamingConvention: Hono requires Variables key
const app = new OpenAPIHono<{ Variables: Variables }>()

const ErrorSchema = z.object({ success: z.literal(false), error: z.string() })

// =============================================================================
// POST /api/agent-tasks — natural language → ticket → agent → outcome
// =============================================================================

app.openapi(
  createRoute({
    method: 'post',
    path: '/',
    tags: ['agent-tasks'],
    summary: 'Submit a natural language task for an agent to execute',
    description:
      'Creates a ticket from the instruction, dispatches an AI agent with CMS tools to resolve it, and returns the result.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              instruction: z.string().min(1).max(2000).openapi({
                example: 'Publish the Q3 product launch blog post and update the homepage hero',
              }),
              boardId: z.string().openapi({ description: 'Board to create the ticket on' }),
              priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              ticketId: z.string(),
              ticketNumber: z.number(),
              agentOutput: z.string().nullable(),
              status: z.string(),
            }),
          },
        },
        description: 'Agent task completed',
      },
      400: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Bad request' },
      503: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'AI not configured',
      },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const tenant = c.get('tenant')
    const { instruction, boardId, priority } = c.req.valid('json')

    // Verify board exists
    const board = await boardQueries.getBoardById(db, boardId)
    if (!board) {
      return c.json({ success: false as const, error: `Board "${boardId}" not found` }, 400)
    }

    // Create the ticket — the agent's work item
    const ticket = await ticketQueries.createTicket(db, {
      id: crypto.randomUUID(),
      boardId,
      title: instruction,
      status: 'in_progress',
      priority,
      type: 'task',
    })

    if (!ticket) {
      return c.json({ success: false as const, error: 'Failed to create ticket' }, 400)
    }

    // Build the dispatcher with DB-backed ticket mutation client
    const dispatcher = buildDispatcher(db, tenant?.id)
    if (!dispatcher) {
      // AI not configured — return the ticket but note it was not dispatched
      await ticketQueries.updateTicket(db, ticket.id, { status: 'open' })
      return c.json(
        {
          success: false as const,
          error:
            'AI agent not configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY (or OLLAMA_BASE_URL for local inference).',
        },
        503,
      )
    }

    // Dispatch and await — agent runs the agentic loop, calls CMS tools, updates ticket.
    // A timeout guard prevents requests from hanging indefinitely.  On timeout, the ticket
    // is marked blocked and a 504 is returned so the caller can retry or escalate.
    const AgentTimeoutMs = 120_000 // 2 minutes
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error('Agent dispatch timed out')),
        AgentTimeoutMs,
      )
    })

    let result: Awaited<ReturnType<typeof dispatcher.dispatch>>
    try {
      result = await Promise.race([
        dispatcher
          .dispatch({
            id: ticket.id,
            title: ticket.title,
            description: ticket.description,
            type: ticket.type,
            priority: ticket.priority,
          })
          .finally(() => clearTimeout(timeoutHandle)),
        timeoutPromise,
      ])
    } catch (dispatchErr) {
      clearTimeout(timeoutHandle)
      await ticketQueries.updateTicket(db, ticket.id, { status: 'blocked' })
      const isTimeout =
        dispatchErr instanceof Error && dispatchErr.message === 'Agent dispatch timed out'
      return c.json(
        {
          success: false as const,
          error: isTimeout ? 'Agent timed out after 2 minutes' : 'Agent dispatch failed',
        },
        503,
      )
    }

    // If agent didn't update the ticket status itself, mark it done/blocked based on result
    if (!result.success) {
      await ticketQueries.updateTicket(db, ticket.id, { status: 'blocked' })
    }

    // Persist agent outcome to agent_memories for traceability and future retrieval
    if (result.output) {
      try {
        await db.insert(agentMemories).values({
          id: crypto.randomUUID(),
          content: result.output,
          type: 'decision',
          source: {
            type: 'agent',
            id: `ticket-agent-${ticket.id}`,
            confidence: result.success ? 1 : 0.5,
          },
          agentId: `ticket-agent-${ticket.id}`,
          metadata: {
            ticketId: ticket.id,
            success: result.success,
            executionTime: result.metadata?.executionTime,
            tokensUsed: result.metadata?.tokensUsed,
          },
        })
      } catch {
        // Memory persistence is best-effort — don't fail the request
      }
    }

    // Re-fetch final ticket state
    const finalTicket = await ticketQueries.getTicketById(db, ticket.id)

    return c.json(
      {
        success: true as const,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        agentOutput: result.output ?? null,
        status: finalTicket?.status ?? (result.success ? 'done' : 'blocked'),
      },
      200,
    )
  },
)

// =============================================================================
// POST /api/agent-tasks/:ticketId/dispatch — dispatch an existing ticket
// =============================================================================

app.openapi(
  createRoute({
    method: 'post',
    path: '/{ticketId}/dispatch',
    tags: ['agent-tasks'],
    summary: 'Dispatch an agent for an existing ticket',
    request: {
      params: z.object({
        ticketId: z.string().openapi({ param: { name: 'ticketId', in: 'path' } }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              ticketId: z.string(),
              agentOutput: z.string().nullable(),
              status: z.string(),
            }),
          },
        },
        description: 'Agent dispatch completed',
      },
      404: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Ticket not found',
      },
      503: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'AI not configured',
      },
    },
  }),
  async (c) => {
    const db = c.get('db')
    const tenant = c.get('tenant')
    const { ticketId } = c.req.valid('param')

    const ticket = await ticketQueries.getTicketById(db, ticketId)
    if (!ticket) {
      return c.json({ success: false as const, error: 'Ticket not found' }, 404)
    }

    const dispatcher = buildDispatcher(db, tenant?.id)
    if (!dispatcher) {
      return c.json(
        {
          success: false as const,
          error:
            'AI agent not configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY (or OLLAMA_BASE_URL for local inference).',
        },
        503,
      )
    }

    // Mark in_progress before dispatch
    await ticketQueries.updateTicket(db, ticketId, { status: 'in_progress' })

    const AgentTimeoutMs = 120_000 // 2 minutes
    let timeoutHandle2: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise2 = new Promise<never>((_, reject) => {
      timeoutHandle2 = setTimeout(
        () => reject(new Error('Agent dispatch timed out')),
        AgentTimeoutMs,
      )
    })

    let result: Awaited<ReturnType<typeof dispatcher.dispatch>>
    try {
      result = await Promise.race([
        dispatcher
          .dispatch({
            id: ticket.id,
            title: ticket.title,
            description: ticket.description,
            type: ticket.type,
            priority: ticket.priority,
          })
          .finally(() => clearTimeout(timeoutHandle2)),
        timeoutPromise2,
      ])
    } catch (dispatchErr) {
      clearTimeout(timeoutHandle2)
      await ticketQueries.updateTicket(db, ticketId, { status: 'blocked' })
      const isTimeout =
        dispatchErr instanceof Error && dispatchErr.message === 'Agent dispatch timed out'
      return c.json(
        {
          success: false as const,
          error: isTimeout ? 'Agent timed out after 2 minutes' : 'Agent dispatch failed',
        },
        503,
      )
    }

    if (!result.success) {
      await ticketQueries.updateTicket(db, ticketId, { status: 'blocked' })
    }

    // Persist agent outcome to agent_memories
    if (result.output) {
      try {
        await db.insert(agentMemories).values({
          id: crypto.randomUUID(),
          content: result.output,
          type: 'decision',
          source: {
            type: 'agent',
            id: `ticket-agent-${ticketId}`,
            confidence: result.success ? 1 : 0.5,
          },
          agentId: `ticket-agent-${ticketId}`,
          metadata: {
            ticketId,
            success: result.success,
            executionTime: result.metadata?.executionTime,
            tokensUsed: result.metadata?.tokensUsed,
          },
        })
      } catch {
        // Memory persistence is best-effort — don't fail the request
      }
    }

    const finalTicket = await ticketQueries.getTicketById(db, ticketId)

    return c.json(
      {
        success: true as const,
        ticketId,
        agentOutput: result.output ?? null,
        status: finalTicket?.status ?? (result.success ? 'done' : 'blocked'),
      },
      200,
    )
  },
)

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a TicketAgentDispatcher backed by the real DB client.
 * Returns null if no LLM provider is configured.
 */
function buildDispatcher(
  db: DatabaseClient,
  _tenantId: string | undefined,
): TicketAgentDispatcher | null {
  let llmClient: ReturnType<typeof createLLMClientFromEnv>
  try {
    llmClient = createLLMClientFromEnv()
  } catch {
    return null
  }

  // TicketMutationClient backed by real DB queries
  const ticketClient = {
    async updateTicket(
      id: string,
      data: { status?: string; columnId?: string; metadata?: Record<string, unknown> },
    ) {
      return ticketQueries.updateTicket(db, id, data)
    },
    async createComment(id: string, body: Record<string, unknown>) {
      return commentQueries.createComment(db, {
        id: crypto.randomUUID(),
        ticketId: id,
        body,
      })
    },
  }

  // CMSAPIClient — routes through the CMS REST API if configured, otherwise no-ops
  const cmsBaseUrl = process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL
  const apiClient = buildCMSClient(cmsBaseUrl)

  return new TicketAgentDispatcher({ llmClient, apiClient, ticketClient })
}

/**
 * Build a CMSAPIClient that calls the CMS REST API.
 * If no CMS URL is available, returns a stub that reports the misconfiguration.
 */
function buildCMSClient(baseUrl: string | undefined) {
  if (!baseUrl) {
    const stub = async () => {
      throw new Error('CMS_URL not configured. Set CMS_URL to connect the agent to the CMS.')
    }
    return {
      find: stub,
      findById: stub,
      create: stub,
      update: stub,
      delete: stub,
      findGlobal: stub,
      updateGlobal: stub,
    }
  }

  const headers = () => ({
    'Content-Type': 'application/json',
    // biome-ignore lint/style/useNamingConvention: Authorization is the correct HTTP header name
    ...(process.env.CMS_API_KEY ? { Authorization: `Bearer ${process.env.CMS_API_KEY}` } : {}),
  })

  return {
    async find(options: {
      collection: string
      page?: number
      limit?: number
      where?: Record<string, unknown>
      sort?: string
    }) {
      const params = new URLSearchParams()
      if (options.page) params.set('page', String(options.page))
      if (options.limit) params.set('limit', String(options.limit))
      if (options.sort) params.set('sort', options.sort)
      const res = await fetch(`${baseUrl}/api/${options.collection}?${params}`, {
        headers: headers(),
      })
      if (!res.ok) throw new Error(`CMS find failed: ${res.statusText}`)
      const body: unknown = await res.json()
      const data =
        body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {}
      return {
        docs: Array.isArray(data.docs) ? (data.docs as unknown[]) : undefined,
        totalDocs: typeof data.totalDocs === 'number' ? data.totalDocs : undefined,
        page: typeof data.page === 'number' ? data.page : undefined,
        totalPages: typeof data.totalPages === 'number' ? data.totalPages : undefined,
      }
    },

    async findById(collection: string, id: string) {
      const res = await fetch(`${baseUrl}/api/${collection}/${id}`, { headers: headers() })
      if (!res.ok) throw new Error(`CMS findById failed: ${res.statusText}`)
      return res.json()
    },

    async create(options: { collection: string; data: Record<string, unknown> }) {
      const res = await fetch(`${baseUrl}/api/${options.collection}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(options.data),
      })
      if (!res.ok) throw new Error(`CMS create failed: ${res.statusText}`)
      return res.json()
    },

    async update(options: { collection: string; id: string; data: Record<string, unknown> }) {
      const res = await fetch(`${baseUrl}/api/${options.collection}/${options.id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(options.data),
      })
      if (!res.ok) throw new Error(`CMS update failed: ${res.statusText}`)
      return res.json()
    },

    async delete(options: { collection: string; id: string }) {
      const res = await fetch(`${baseUrl}/api/${options.collection}/${options.id}`, {
        method: 'DELETE',
        headers: headers(),
      })
      if (!res.ok) throw new Error(`CMS delete failed: ${res.statusText}`)
    },

    async findGlobal(options: { slug: string; depth?: number }) {
      const params = options.depth !== undefined ? `?depth=${options.depth}` : ''
      const res = await fetch(`${baseUrl}/api/globals/${options.slug}${params}`, {
        headers: headers(),
      })
      if (!res.ok) throw new Error(`CMS findGlobal failed: ${res.statusText}`)
      return res.json()
    },

    async updateGlobal(options: { slug: string; data: Record<string, unknown> }) {
      const res = await fetch(`${baseUrl}/api/globals/${options.slug}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(options.data),
      })
      if (!res.ok) throw new Error(`CMS updateGlobal failed: ${res.statusText}`)
      return res.json()
    },
  }
}

export default app
