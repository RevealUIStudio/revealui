/**
 * Durable agent-dispatch handler (CR8-P2-01 phase C).
 *
 * Registered at boot under `agent.dispatch` via register-handlers.ts.
 * Invoked by the queue worker when a ticket's POST handler enqueues a
 * dispatch job (see apps/api/src/routes/agent-tasks.ts).
 *
 * Durability guarantees provided by the combination of:
 *   1. The queue's visibility timeout + retry-with-backoff (phase A).
 *   2. The cron safety-net that reclaims stalled claims (phase B).
 *   3. `idempotentWrite` memoization of the LLM dispatch result so a
 *      crash-and-resume returns the cached output rather than
 *      re-calling the LLM (this file).
 *   4. Deterministic comment ids from `TicketAgentDispatcher(dispatchId)`
 *      (revealui#477) so tool-call side-effects re-issued during
 *      resume collide on the DB PK constraint instead of producing
 *      duplicate rows.
 *
 * The handler is self-contained — it reads the ticket, builds a fresh
 * dispatcher per invocation, and cleans up after itself. No state
 * leaks across jobs.
 */

import { isFeatureEnabled } from '@revealui/core/features';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import * as ticketQueries from '@revealui/db/queries/tickets';
import { idempotentWrite } from '@revealui/db/saga';
import type { Job } from '@revealui/db/schema';
import { agentMemories } from '@revealui/db/schema/agents';
import { safeVectorInsert } from '@revealui/db/validation/cross-db';
import { buildDispatcher } from '../lib/agent-dispatcher.js';

const LLM_MEMOIZE_TTL_MS = 24 * 60 * 60 * 1000;

export interface AgentDispatchPayload extends Record<string, unknown> {
  ticketId: string;
  /** Caller's tenant id at enqueue time. Worker carries it through. */
  tenantId?: string;
  /** Caller's user id at enqueue time. For audit logging / future RBAC. */
  userId: string;
  /**
   * Correlation id from the originating POST request. All logs from the
   * handler carry this so POST / worker / status-poll share a trace.
   */
  requestId?: string;
}

export interface AgentDispatchOutput extends Record<string, unknown> {
  success: boolean;
  /** Final text output produced by the agent, or null on blocked/failed. */
  output: string | null;
  /** Final ticket status written by the handler. */
  status: 'done' | 'blocked';
  /** Metadata passed through from the LLM provider. */
  executionTime?: number;
  tokensUsed?: number;
  /**
   * True when the LLM call was skipped on this attempt because the
   * memoized result from a prior attempt was still fresh. Useful for
   * crash-resume observability.
   */
  replayedFromCache?: boolean;
}

export async function agentDispatchHandler(
  data: AgentDispatchPayload,
  job: Job,
): Promise<AgentDispatchOutput> {
  const db = getClient();
  const log = (event: string, extra?: Record<string, unknown>): void => {
    logger.info(`[agent.dispatch] ${event}`, {
      jobId: job.id,
      ticketId: data.ticketId,
      requestId: data.requestId,
      ...extra,
    });
  };

  // License re-check. The POST handler already gated on requireAIAccess;
  // this catches the edge case where the license lapsed between enqueue
  // and claim. Pre-existing gap: isFeatureEnabled reads the singleton
  // license state (not per-tenant), so the tenant-scoped variant
  // depends on a future fix. Naming it here so when that lands the
  // worker gets stricter enforcement automatically.
  if (!isFeatureEnabled('ai')) {
    throw new Error('AI feature unavailable at dispatch time (license lapsed or revoked)');
  }

  const ticket = await ticketQueries.getTicketById(db, data.ticketId);
  if (!ticket) {
    throw new Error(`Ticket not found: ${data.ticketId}`);
  }

  const dispatcher = await buildDispatcher(db, data.tenantId);
  if (!dispatcher) {
    throw new Error(
      "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
    );
  }

  log('claimed', { retryCount: job.retryCount });

  // Transition to in_progress if the caller hasn't already. Idempotent:
  // re-running on the same ticket is a no-op.
  if (ticket.status !== 'in_progress') {
    await ticketQueries.updateTicket(db, ticket.id, { status: 'in_progress' });
  }

  // Memoize the LLM dispatch keyed on the job id. First attempt runs the
  // LLM, caches the result, and proceeds. Crash-resume sees the cached
  // row and returns it directly — no second LLM call, no second bill.
  const { result: memoized, alreadyProcessed } = await idempotentWrite<AgentDispatchOutput>(
    db,
    `agent.dispatch.llm:${job.id}`,
    'agent-dispatch-llm',
    async () => {
      log('llm.start');
      const raw = await dispatcher.dispatch(
        {
          id: ticket.id,
          title: ticket.title,
          description: ticket.description,
          type: ticket.type,
          priority: ticket.priority,
        },
        { dispatchId: job.id },
      );
      log('llm.done', {
        success: raw.success,
        executionTime: raw.metadata?.executionTime,
        tokensUsed: raw.metadata?.tokensUsed,
      });
      return {
        success: raw.success,
        output: raw.output ?? null,
        status: (raw.success ? 'done' : 'blocked') as 'done' | 'blocked',
        executionTime: raw.metadata?.executionTime,
        tokensUsed: raw.metadata?.tokensUsed,
      };
    },
    { ttlMs: LLM_MEMOIZE_TTL_MS, cacheResult: true },
  );

  if (!memoized) {
    // Defensive: idempotentWrite should return the fresh result on a new
    // execution or the cached one on replay. Hitting this branch means
    // the operation ran but returned nothing — treat as a handler bug.
    throw new Error('agent.dispatch: idempotentWrite returned no result');
  }

  if (alreadyProcessed) {
    log('replayed-from-cache');
  }

  // Write the final ticket status. Idempotent: updating to the same status
  // is a no-op. Skip if the memoized output already matches the current
  // status (avoids a no-op write on the happy path).
  const freshTicket = await ticketQueries.getTicketById(db, ticket.id);
  if (freshTicket && freshTicket.status !== memoized.status) {
    await ticketQueries.updateTicket(db, ticket.id, { status: memoized.status });
  }

  // Persist to agent_memories (best-effort, same as the legacy sync path).
  // Side-effect duplication on crash-resume is prevented by the memoization
  // above — this block only runs once per dispatch (the first time that
  // dispatcher.dispatch() actually executes), because subsequent replays
  // hit the `alreadyProcessed` branch and skip writes.
  if (!alreadyProcessed && memoized.output) {
    try {
      const memoryValues = {
        id: crypto.randomUUID(),
        siteId: 'system',
        content: memoized.output,
        type: 'decision',
        source: {
          type: 'agent',
          id: `ticket-agent-${ticket.id}`,
          confidence: memoized.success ? 1 : 0.5,
        },
        agentId: `ticket-agent-${ticket.id}`,
        metadata: {
          ticketId: ticket.id,
          jobId: job.id,
          success: memoized.success,
          executionTime: memoized.executionTime,
          tokensUsed: memoized.tokensUsed,
        },
      };
      await safeVectorInsert<void>(
        db,
        async () => {
          await db.insert(agentMemories).values(memoryValues);
        },
        { siteId: memoryValues.siteId },
      );
    } catch {
      // Best-effort — memory persistence failure does not fail the job.
    }
  }

  return {
    ...memoized,
    replayedFromCache: alreadyProcessed,
  };
}
