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

import type { DatabaseClient } from '@revealui/db/client';
import * as boardQueries from '@revealui/db/queries/boards';
import * as commentQueries from '@revealui/db/queries/ticket-comments';
import * as ticketQueries from '@revealui/db/queries/tickets';
import { agentMemories } from '@revealui/db/schema/agents';
import { safeVectorInsert } from '@revealui/db/validation/cross-db';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';

type Variables = {
  db: DatabaseClient;
  tenant?: { id: string };
  user?: { id: string; role: string };
};

const AGENT_TASK_ROLES = new Set(['admin', 'owner', 'editor', 'agent']);

function requireAgentTaskRole(c: { get: (key: string) => unknown }): { id: string; role: string } {
  const user = c.get('user') as { id: string; role: string } | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  if (!AGENT_TASK_ROLES.has(user.role)) {
    throw new HTTPException(403, {
      message: 'Editor role or higher required to dispatch agent tasks',
    });
  }
  return user;
}

const app = new OpenAPIHono<{ Variables: Variables }>();

const ErrorSchema = z.object({ success: z.literal(false), error: z.string() });

// =============================================================================
// POST /api/agent-tasks  -  natural language → ticket → agent → outcome
// =============================================================================

app.openapi(
  createRoute({
    method: 'post',
    path: '/',
    tags: ['agent-tasks'],
    summary: 'Submit a natural language task for an agent to execute',
    description:
      'Creates a ticket from the instruction, dispatches an AI agent with admin tools to resolve it, and returns the result.',
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
      403: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'AI feature requires Pro or Enterprise license',
      },
    },
  }),
  async (c) => {
    requireAgentTaskRole(c);
    const db = c.get('db');
    const tenant = c.get('tenant');
    const { instruction, boardId, priority } = c.req.valid('json');

    // Verify board exists and caller is in the same tenant
    const board = await boardQueries.getBoardById(db, boardId);
    if (!board) {
      return c.json({ success: false as const, error: `Board "${boardId}" not found` }, 400);
    }
    if (board.tenantId && board.tenantId !== tenant?.id) {
      return c.json({ success: false as const, error: `Board "${boardId}" not found` }, 400);
    }

    // Create the ticket  -  the agent's work item
    const ticket = await ticketQueries.createTicket(db, {
      id: crypto.randomUUID(),
      boardId,
      title: instruction,
      status: 'in_progress',
      priority,
      type: 'task',
    });

    if (!ticket) {
      return c.json({ success: false as const, error: 'Failed to create ticket' }, 400);
    }

    // Build the dispatcher with DB-backed ticket mutation client
    const dispatcher = await buildDispatcher(db, tenant?.id);
    if (!dispatcher) {
      // AI not configured  -  return the ticket but note it was not dispatched
      await ticketQueries.updateTicket(db, ticket.id, { status: 'open' });
      return c.json(
        {
          success: false as const,
          error:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        },
        403,
      );
    }

    // Dispatch agent with timeout, persist outcome to memory
    const dispatchResult = await dispatchWithTimeout(db, dispatcher, ticket);
    if (!dispatchResult.success) {
      return c.json({ success: false as const, error: dispatchResult.error }, 403);
    }
    const { result } = dispatchResult;

    // Re-fetch final ticket state
    const finalTicket = await ticketQueries.getTicketById(db, ticket.id);

    return c.json(
      {
        success: true as const,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        agentOutput: result.output ?? null,
        status: finalTicket?.status ?? (result.success ? 'done' : 'blocked'),
      },
      200,
    );
  },
);

// =============================================================================
// POST /api/agent-tasks/:ticketId/dispatch  -  dispatch an existing ticket
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
      403: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'AI feature requires Pro or Enterprise license',
      },
    },
  }),
  async (c) => {
    requireAgentTaskRole(c);
    const db = c.get('db');
    const tenant = c.get('tenant');
    const { ticketId } = c.req.valid('param');

    const ticket = await ticketQueries.getTicketById(db, ticketId);
    if (!ticket) {
      return c.json({ success: false as const, error: 'Ticket not found' }, 404);
    }
    const board = await boardQueries.getBoardById(db, ticket.boardId);
    if (tenant && board?.tenantId && board.tenantId !== tenant.id) {
      return c.json({ success: false as const, error: 'Ticket not found' }, 404);
    }

    const dispatcher = await buildDispatcher(db, tenant?.id);
    if (!dispatcher) {
      return c.json(
        {
          success: false as const,
          error:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        },
        403,
      );
    }

    // Mark in_progress before dispatch
    await ticketQueries.updateTicket(db, ticketId, { status: 'in_progress' });

    // Dispatch agent with timeout, persist outcome to memory
    const dispatchResult = await dispatchWithTimeout(db, dispatcher, ticket);
    if (!dispatchResult.success) {
      return c.json({ success: false as const, error: dispatchResult.error }, 403);
    }
    const { result } = dispatchResult;

    const finalTicket = await ticketQueries.getTicketById(db, ticketId);

    return c.json(
      {
        success: true as const,
        ticketId,
        agentOutput: result.output ?? null,
        status: finalTicket?.status ?? (result.success ? 'done' : 'blocked'),
      },
      200,
    );
  },
);

// =============================================================================
// Helpers
// =============================================================================

/** Agent dispatch timeout  -  configurable via AGENT_TIMEOUT_MS env var */
const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS) || 120_000;

/**
 * Dispatch an agent for a ticket with a timeout guard, then persist the
 * outcome to agent_memories. Shared by both POST handlers.
 */
async function dispatchWithTimeout(
  db: DatabaseClient,
  dispatcher: {
    dispatch: (ticket: Record<string, unknown>) => Promise<{
      success: boolean;
      output?: string;
      metadata?: { executionTime?: number; tokensUsed?: number };
    }>;
  },
  ticket: { id: string; title: string; description: unknown; type: string; priority: string },
): Promise<
  | {
      success: true;
      result: {
        success: boolean;
        output?: string;
        metadata?: { executionTime?: number; tokensUsed?: number };
      };
    }
  | { success: false; error: string }
> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('Agent dispatch timed out')),
      AGENT_TIMEOUT_MS,
    );
  });

  let result: Awaited<ReturnType<typeof dispatcher.dispatch>>;
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
    ]);
  } catch (dispatchErr) {
    clearTimeout(timeoutHandle);
    await ticketQueries.updateTicket(db, ticket.id, { status: 'blocked' });
    const isTimeout =
      dispatchErr instanceof Error && dispatchErr.message === 'Agent dispatch timed out';
    return {
      success: false,
      error: isTimeout
        ? `Agent timed out after ${Math.round(AGENT_TIMEOUT_MS / 60_000)} minutes`
        : 'Agent dispatch failed',
    };
  }

  if (!result.success) {
    await ticketQueries.updateTicket(db, ticket.id, { status: 'blocked' });
  }

  // Persist agent outcome to agent_memories (best-effort)
  if (result.output) {
    try {
      const memoryValues = {
        id: crypto.randomUUID(),
        siteId: 'system',
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
      };
      await safeVectorInsert(db, () => db.insert(agentMemories).values(memoryValues), {
        siteId: memoryValues.siteId,
      });
    } catch {
      // Memory persistence is best-effort  -  don't fail the request
    }
  }

  return { success: true, result };
}

/**
 * Build a TicketAgentDispatcher backed by the real DB client.
 * Returns null if no LLM provider is configured or @revealui/ai is not installed.
 */
async function buildDispatcher(
  db: DatabaseClient,
  _tenantId: string | undefined,
): Promise<{
  dispatch: (ticket: Record<string, unknown>) => Promise<{
    success: boolean;
    output?: string;
    metadata?: { executionTime?: number; tokensUsed?: number };
  }>;
} | null> {
  const aiMod = await import('@revealui/ai').catch(() => null);
  if (!aiMod) return null;

  let llmClient: unknown;
  try {
    llmClient = aiMod.createLLMClientFromEnv();
  } catch {
    return null;
  }

  // TicketMutationClient backed by real DB queries
  const ticketClient = {
    async updateTicket(
      id: string,
      data: { status?: string; columnId?: string; metadata?: Record<string, unknown> },
    ) {
      return ticketQueries.updateTicket(db, id, data);
    },
    async createComment(id: string, body: Record<string, unknown>, options?: { id?: string }) {
      // When the caller (createTicketTools) passes a deterministic id, use
      // it so a crash-and-resume of the same dispatch produces the same
      // row and the PK constraint dedupes naturally. Otherwise fall back
      // to a random UUID for backward compatibility.
      return commentQueries.createComment(db, {
        id: options?.id ?? crypto.randomUUID(),
        ticketId: id,
        body,
      });
    },
  };

  // AdminAPIClient  -  routes through the admin REST API if configured, otherwise no-ops
  const adminBaseUrl = process.env.ADMIN_URL ?? process.env.NEXT_PUBLIC_ADMIN_URL;
  const apiClient = buildCMSClient(adminBaseUrl);

  // Type assertions needed: TicketAgentDispatcher comes from Pro package with its own
  // type resolution path. llmClient is unknown from dynamic import; the dispatcher's
  // dispatch() accepts TicketInput (narrower than Record<string, unknown>).
  type DispatcherConfig = ConstructorParameters<typeof aiMod.TicketAgentDispatcher>[0];
  return new aiMod.TicketAgentDispatcher({
    llmClient: llmClient as DispatcherConfig['llmClient'],
    apiClient,
    ticketClient,
  }) as unknown as NonNullable<Awaited<ReturnType<typeof buildDispatcher>>>;
}

/**
 * Build a AdminAPIClient that calls the admin REST API.
 * If no admin URL is available, returns a stub that reports the misconfiguration.
 */
function buildCMSClient(baseUrl: string | undefined) {
  if (!baseUrl) {
    const stub = async () => {
      throw new Error(
        'ADMIN_URL not configured. Set ADMIN_URL to connect the agent to the admin app.',
      );
    };
    return {
      find: stub,
      findById: stub,
      create: stub,
      update: stub,
      delete: stub,
      findGlobal: stub,
      updateGlobal: stub,
    };
  }

  const headers = () => ({
    'Content-Type': 'application/json',
    ...(process.env.CMS_API_KEY ? { Authorization: `Bearer ${process.env.CMS_API_KEY}` } : {}),
  });

  return {
    async find(options: {
      collection: string;
      page?: number;
      limit?: number;
      where?: Record<string, unknown>;
      sort?: string;
    }) {
      const params = new URLSearchParams();
      if (options.page) params.set('page', String(options.page));
      if (options.limit) params.set('limit', String(options.limit));
      if (options.sort) params.set('sort', options.sort);
      const res = await fetch(`${baseUrl}/api/${options.collection}?${params}`, {
        headers: headers(),
      });
      if (!res.ok) throw new Error(`Admin find failed: ${res.statusText}`);
      const body: unknown = await res.json();
      const data =
        body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
      return {
        docs: Array.isArray(data.docs) ? (data.docs as unknown[]) : undefined,
        totalDocs: typeof data.totalDocs === 'number' ? data.totalDocs : undefined,
        page: typeof data.page === 'number' ? data.page : undefined,
        totalPages: typeof data.totalPages === 'number' ? data.totalPages : undefined,
      };
    },

    async findById(collection: string, id: string) {
      const res = await fetch(`${baseUrl}/api/${collection}/${id}`, { headers: headers() });
      if (!res.ok) throw new Error(`Admin findById failed: ${res.statusText}`);
      return res.json();
    },

    async create(options: { collection: string; data: Record<string, unknown> }) {
      const res = await fetch(`${baseUrl}/api/${options.collection}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(options.data),
      });
      if (!res.ok) throw new Error(`Admin create failed: ${res.statusText}`);
      return res.json();
    },

    async update(options: { collection: string; id: string; data: Record<string, unknown> }) {
      const res = await fetch(`${baseUrl}/api/${options.collection}/${options.id}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(options.data),
      });
      if (!res.ok) throw new Error(`Admin update failed: ${res.statusText}`);
      return res.json();
    },

    async delete(options: { collection: string; id: string }) {
      const res = await fetch(`${baseUrl}/api/${options.collection}/${options.id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      if (!res.ok) throw new Error(`Admin delete failed: ${res.statusText}`);
    },

    async findGlobal(options: { slug: string; depth?: number }) {
      const params = options.depth !== undefined ? `?depth=${options.depth}` : '';
      const res = await fetch(`${baseUrl}/api/globals/${options.slug}${params}`, {
        headers: headers(),
      });
      if (!res.ok) throw new Error(`Admin findGlobal failed: ${res.statusText}`);
      return res.json();
    },

    async updateGlobal(options: { slug: string; data: Record<string, unknown> }) {
      const res = await fetch(`${baseUrl}/api/globals/${options.slug}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(options.data),
      });
      if (!res.ok) throw new Error(`Admin updateGlobal failed: ${res.statusText}`);
      return res.json();
    },
  };
}

export default app;
