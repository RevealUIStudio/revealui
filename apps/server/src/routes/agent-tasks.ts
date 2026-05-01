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
 *
 * GET /api/agent-tasks/:ticketId/status (CR8-P2-01 phase C)
 *   Returns the canonical dispatch status for a ticket — usable by any
 *   caller (admin UI, external agent, RevDev) to poll after receiving a
 *   202 from the POST endpoints.
 *
 * Durable dispatch (CR8-P2-01 phase C):
 *   When REVEALUI_JOBS_AGENT_DISPATCH_ENABLED=true, POST handlers enqueue
 *   an `agent.dispatch` job and poll for up to 22 s. Completion within
 *   the window returns 200 with the dispatch result (same shape as the
 *   legacy sync path). Timeout returns 202 with a jobId and statusUrl
 *   the caller can poll. Crashes mid-dispatch are reclaimed by the cron
 *   safety-net (phase B); the LLM call is memoized so a resume doesn't
 *   double-bill (phase C handler). When the flag is off, the route
 *   behaves exactly as it did pre-phase-C.
 */

import type { DatabaseClient } from '@revealui/db/client';
import { enqueue, getJobById } from '@revealui/db/jobs';
import * as boardQueries from '@revealui/db/queries/boards';
import * as ticketQueries from '@revealui/db/queries/tickets';
import type { Job } from '@revealui/db/schema';
import { agentMemories } from '@revealui/db/schema/agents';
import { safeVectorInsert } from '@revealui/db/validation/cross-db';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import type { AgentDispatchOutput, AgentDispatchPayload } from '../jobs/agent-dispatch.js';
import { buildDispatcher, type Dispatcher } from '../lib/agent-dispatcher.js';

type Variables = {
  db: DatabaseClient;
  tenant?: { id: string };
  user?: { id: string; role: string };
  requestId?: string;
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

function isDurableDispatchEnabled(): boolean {
  return process.env.REVEALUI_JOBS_AGENT_DISPATCH_ENABLED === 'true';
}

const app = new OpenAPIHono<{ Variables: Variables }>();

const ErrorSchema = z.object({ success: z.literal(false), error: z.string() });

const DispatchSuccessShape = {
  success: z.literal(true),
  ticketId: z.string(),
  agentOutput: z.string().nullable(),
  status: z.string(),
  /** Present when the dispatch ran through the durable queue. */
  jobId: z.string().optional(),
};

const DispatchPendingShape = {
  success: z.literal(true),
  ticketId: z.string(),
  ticketNumber: z.number().optional(),
  jobId: z.string(),
  statusUrl: z.string(),
  /** Human-readable hint for UIs while polling. */
  message: z.string(),
};

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
      'Creates a ticket from the instruction, dispatches an AI agent with admin tools to resolve it, and returns the result. When durable dispatch is enabled and the agent takes longer than ~22 s, returns 202 with a jobId the caller can poll at /status.',
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
              ...DispatchSuccessShape,
              ticketNumber: z.number(),
            }),
          },
        },
        description: 'Agent task completed within the sync/poll window',
      },
      202: {
        content: { 'application/json': { schema: z.object(DispatchPendingShape) } },
        description:
          'Dispatch enqueued but still running at the poll-window timeout. Caller polls the statusUrl.',
      },
      400: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Bad request' },
      403: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'AI feature requires Pro or Enterprise license',
      },
    },
  }),
  async (c) => {
    const user = requireAgentTaskRole(c);
    const db = c.get('db');
    const tenant = c.get('tenant');
    const { instruction, boardId, priority } = c.req.valid('json');

    const board = await boardQueries.getBoardById(db, boardId);
    if (!board) {
      return c.json({ success: false as const, error: `Board "${boardId}" not found` }, 400);
    }
    if (board.tenantId && board.tenantId !== tenant?.id) {
      return c.json({ success: false as const, error: `Board "${boardId}" not found` }, 400);
    }

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

    // --- Durable dispatch path (flag on) ---
    if (isDurableDispatchEnabled()) {
      const outcome = await runDurableDispatch(db, ticket, user, tenant, c.get('requestId'));
      if (outcome.kind === 'complete') {
        return c.json(
          {
            success: true as const,
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            agentOutput: outcome.agentOutput,
            status: outcome.status,
            jobId: outcome.jobId,
          },
          200,
        );
      }
      if (outcome.kind === 'failed') {
        return c.json({ success: false as const, error: outcome.error }, 403);
      }
      return c.json(
        {
          success: true as const,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          jobId: outcome.jobId,
          statusUrl: outcome.statusUrl,
          message: 'Dispatch is running; poll statusUrl for completion.',
        },
        202,
      );
    }

    // --- Legacy sync path (flag off) ---
    const dispatcher = await buildDispatcher(db, tenant?.id);
    if (!dispatcher) {
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

    const dispatchResult = await dispatchWithTimeout(db, dispatcher, ticket);
    if (!dispatchResult.success) {
      return c.json({ success: false as const, error: dispatchResult.error }, 403);
    }
    const { result } = dispatchResult;
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
        content: { 'application/json': { schema: z.object(DispatchSuccessShape) } },
        description: 'Agent dispatch completed within the sync/poll window',
      },
      202: {
        content: { 'application/json': { schema: z.object(DispatchPendingShape) } },
        description: 'Dispatch enqueued but still running at the poll-window timeout',
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
    const user = requireAgentTaskRole(c);
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

    // --- Durable dispatch path ---
    if (isDurableDispatchEnabled()) {
      await ticketQueries.updateTicket(db, ticketId, { status: 'in_progress' });
      const outcome = await runDurableDispatch(db, ticket, user, tenant, c.get('requestId'));
      if (outcome.kind === 'complete') {
        return c.json(
          {
            success: true as const,
            ticketId,
            agentOutput: outcome.agentOutput,
            status: outcome.status,
            jobId: outcome.jobId,
          },
          200,
        );
      }
      if (outcome.kind === 'failed') {
        return c.json({ success: false as const, error: outcome.error }, 403);
      }
      return c.json(
        {
          success: true as const,
          ticketId,
          jobId: outcome.jobId,
          statusUrl: outcome.statusUrl,
          message: 'Dispatch is running; poll statusUrl for completion.',
        },
        202,
      );
    }

    // --- Legacy sync path ---
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

    await ticketQueries.updateTicket(db, ticketId, { status: 'in_progress' });

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
// GET /api/agent-tasks/:ticketId/status  -  canonical dispatch status
// =============================================================================

const StatusShape = z.object({
  success: z.literal(true),
  ticketId: z.string(),
  jobId: z.string().nullable(),
  status: z.enum(['idle', 'pending', 'running', 'completed', 'failed']),
  output: z.string().nullable(),
  error: z.string().nullable(),
  attemptsMade: z.number().nullable(),
  nextAttemptAt: z.string().nullable(),
});

app.openapi(
  createRoute({
    method: 'get',
    path: '/{ticketId}/status',
    tags: ['agent-tasks'],
    summary: 'Fetch the canonical dispatch status for a ticket',
    description:
      'Returns the current state of the most recent dispatch job for a ticket. `status = idle` means no job was ever queued (legacy sync dispatch or ticket never dispatched). Safe to poll; returns 200 even when nothing is in flight.',
    request: {
      params: z.object({
        ticketId: z.string().openapi({ param: { name: 'ticketId', in: 'path' } }),
      }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: StatusShape } },
        description: 'Dispatch status',
      },
      404: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Ticket not found',
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

    const job = await getJobById(jobIdForTicket(ticketId));
    if (!job) {
      return c.json(
        {
          success: true as const,
          ticketId,
          jobId: null,
          status: 'idle' as const,
          output: null,
          error: null,
          attemptsMade: null,
          nextAttemptAt: null,
        },
        200,
      );
    }

    return c.json(serializeStatus(ticketId, job), 200);
  },
);

// =============================================================================
// Durable dispatch helper (CR8-P2-01 phase C)
// =============================================================================

/** Poll window before falling back to 202. Leaves ~8 s of Vercel's 30 s budget
 *  for ticket create + response serialization + network. */
const POLL_WINDOW_MS = 22_000;
/** Capped exponential backoff for the poll loop. */
const POLL_INITIAL_MS = 200;
const POLL_MAX_MS = 2_000;

type DispatchOutcome =
  | {
      kind: 'complete';
      jobId: string;
      agentOutput: string | null;
      status: string;
    }
  | {
      kind: 'failed';
      error: string;
    }
  | {
      kind: 'pending';
      jobId: string;
      statusUrl: string;
    };

async function runDurableDispatch(
  db: DatabaseClient,
  ticket: { id: string },
  user: { id: string },
  tenant: { id: string } | undefined,
  requestId: string | undefined,
): Promise<DispatchOutcome> {
  const jobId = jobIdForTicket(ticket.id);

  await enqueue<AgentDispatchPayload>(
    'agent.dispatch',
    {
      ticketId: ticket.id,
      tenantId: tenant?.id,
      userId: user.id,
      requestId,
    },
    { idempotencyKey: jobId, retryLimit: 3 },
  );

  const deadline = Date.now() + POLL_WINDOW_MS;
  let backoff = POLL_INITIAL_MS;
  while (Date.now() < deadline) {
    await sleep(Math.min(backoff, deadline - Date.now()));
    backoff = Math.min(backoff * 2, POLL_MAX_MS);

    const job = await getJobById(jobId);
    if (!job) continue;

    if (job.state === 'completed') {
      const output = (job.output ?? {}) as Partial<AgentDispatchOutput>;
      const finalTicket = await ticketQueries.getTicketById(db, ticket.id);
      return {
        kind: 'complete',
        jobId,
        agentOutput: output.output ?? null,
        status: finalTicket?.status ?? output.status ?? 'done',
      };
    }

    if (job.state === 'failed') {
      return {
        kind: 'failed',
        error: job.lastError ?? 'Agent dispatch failed',
      };
    }
    // else state === 'created' or 'active' — keep polling
  }

  return {
    kind: 'pending',
    jobId,
    statusUrl: `/api/agent-tasks/${ticket.id}/status`,
  };
}

/**
 * One job per ticket: the job id is derived from the ticket id so
 * repeated POSTs for the same ticket dedupe at `enqueue()` via the
 * ON CONFLICT DO NOTHING branch. Re-dispatching a completed ticket
 * returns the cached result; force-re-dispatch is a future tracker.
 */
function jobIdForTicket(ticketId: string): string {
  return `agent.dispatch:${ticketId}`;
}

function serializeStatus(
  ticketId: string,
  job: Job,
): {
  success: true;
  ticketId: string;
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output: string | null;
  error: string | null;
  attemptsMade: number;
  nextAttemptAt: string | null;
} {
  const outputValue = job.output as Partial<AgentDispatchOutput> | null;
  const status: 'pending' | 'running' | 'completed' | 'failed' =
    job.state === 'completed'
      ? 'completed'
      : job.state === 'failed'
        ? 'failed'
        : job.state === 'active'
          ? 'running'
          : 'pending';
  const nextAttemptAt =
    status === 'pending' && job.startAfter && job.startAfter > new Date()
      ? job.startAfter.toISOString()
      : null;
  return {
    success: true,
    ticketId,
    jobId: job.id,
    status,
    output: outputValue?.output ?? null,
    error: job.lastError ?? null,
    attemptsMade: job.retryCount,
    nextAttemptAt,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

// =============================================================================
// Legacy sync dispatch helper (flag-off path)
// =============================================================================

/** Agent dispatch timeout  -  configurable via AGENT_TIMEOUT_MS env var */
const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS) || 120_000;

/**
 * Legacy in-request dispatch with in-process timeout + best-effort memory
 * write. Preserved so the flag-off path behaves exactly as it did pre-
 * phase-C. When the flag flips default-on and the deletion PR lands,
 * this helper and dispatchWithTimeout go away.
 */
async function dispatchWithTimeout(
  db: DatabaseClient,
  dispatcher: Dispatcher,
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

  let result: Awaited<ReturnType<Dispatcher['dispatch']>>;
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
      // Memory persistence is best-effort
    }
  }

  return { success: true, result };
}

export default app;
