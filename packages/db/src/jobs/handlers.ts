/**
 * Job Handler Registry
 *
 * Handlers are registered at boot by their owning route/module (e.g. the
 * agent-tasks route registers `agent.dispatch`, the collab room-manager
 * registers `collab.persist`). The worker route looks up handlers by
 * `job.name` when dequeuing.
 *
 * A closed-set registry ensures an attacker cannot queue a job type that
 * does not have a registered handler — the worker simply marks the job
 * failed with "no handler registered".
 *
 * @see packages/db/src/jobs/claim.ts — the worker-side claim + dispatch loop
 * @see apps/server/src/routes/jobs/run.ts — the HTTP worker route
 */

import type { Job } from '../schema/jobs.js';

/**
 * A handler function for a single job type.
 *
 * @param data - Job payload (already typed by the caller via generics on enqueue)
 * @param job - Full job row, for access to id/retryCount/etc.
 * @returns Arbitrary JSON-serializable output stored in `jobs.output`
 */
export type JobHandler<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TOut = unknown,
> = (data: TData, job: Job) => Promise<TOut>;

// The registry is a mutable module-level map, intentionally shared across
// imports. Boot-time registration happens once per process.
const HANDLERS = new Map<string, JobHandler>();

/**
 * Register a handler for a job type. Called at boot by the route that owns
 * the job type. Duplicate registration throws — prevents silent shadowing
 * if two modules claim the same job name.
 */
export function registerHandler<TData extends Record<string, unknown>, TOut>(
  name: string,
  handler: JobHandler<TData, TOut>,
): void {
  if (HANDLERS.has(name)) {
    throw new Error(`[jobs] handler already registered for '${name}'`);
  }
  HANDLERS.set(name, handler as JobHandler);
}

/**
 * Look up a handler by job name. Returns undefined if unregistered — the
 * worker treats this as a terminal failure (no retries).
 */
export function getHandler(name: string): JobHandler | undefined {
  return HANDLERS.get(name);
}

/**
 * Clear the registry. Intended for tests — calling this in production would
 * silently break every in-flight job.
 */
export function clearHandlers(): void {
  HANDLERS.clear();
}

/**
 * List all registered handler names. Useful for startup logging / admin
 * dashboards / assertions in tests.
 */
export function listHandlers(): string[] {
  return [...HANDLERS.keys()];
}
