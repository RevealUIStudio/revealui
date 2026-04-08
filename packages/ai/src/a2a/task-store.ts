/**
 * A2A Task Store
 *
 * In-memory store for A2A task state. Tasks are short-lived (lifetime of a
 * request or streaming session) so persistence is not needed here.
 * The authoritative record for completed tasks lives in @revealui/db (agentActions).
 */

import type { A2AArtifact, A2AMessage, A2ATask, A2ATaskState } from '@revealui/contracts';

// Map of abort controllers so callers can cancel running tasks
const _controllers = new Map<string, AbortController>();
const _tasks = new Map<string, A2ATask>();

function now(): string {
  return new Date().toISOString();
}

/**
 * Create a new task in the 'submitted' state.
 */
export function createTask(params: {
  id?: string;
  sessionId?: string;
  message: A2AMessage;
  metadata?: Record<string, unknown>;
}): A2ATask {
  const id = params.id ?? crypto.randomUUID();
  const task: A2ATask = {
    id,
    sessionId: params.sessionId,
    status: {
      state: 'submitted',
      timestamp: now(),
    },
    history: [params.message],
    metadata: params.metadata,
  };
  _tasks.set(id, task);
  _controllers.set(id, new AbortController());
  return task;
}

/**
 * Get a task by ID.
 */
export function getTask(id: string): A2ATask | null {
  return _tasks.get(id) ?? null;
}

/**
 * Transition a task to a new state, optionally attaching a message.
 */
export function updateTaskState(
  id: string,
  state: A2ATaskState,
  message?: A2AMessage,
): A2ATask | null {
  const task = _tasks.get(id);
  if (!task) return null;

  const updated: A2ATask = {
    ...task,
    status: {
      state,
      message,
      timestamp: now(),
    },
    history: message ? [...(task.history ?? []), message] : task.history,
  };
  _tasks.set(id, updated);
  return updated;
}

/**
 * Append an artifact to a completed task.
 */
export function appendArtifact(id: string, artifact: A2AArtifact): A2ATask | null {
  const task = _tasks.get(id);
  if (!task) return null;

  const updated: A2ATask = {
    ...task,
    artifacts: [...(task.artifacts ?? []), artifact],
  };
  _tasks.set(id, updated);
  return updated;
}

/**
 * Cancel a task. Returns true if the task was cancelable.
 */
export function cancelTask(id: string): boolean {
  const task = _tasks.get(id);
  if (!task) return false;

  const cancelable = task.status.state === 'submitted' || task.status.state === 'working';
  if (!cancelable) return false;

  // Signal abort to any running execution
  _controllers.get(id)?.abort();

  updateTaskState(id, 'canceled');
  return true;
}

/**
 * Get the AbortSignal for a running task (so the executor can detect cancellation).
 */
export function getTaskSignal(id: string): AbortSignal | null {
  return _controllers.get(id)?.signal ?? null;
}

/**
 * Cleanup a task from the store (call after response has been sent).
 */
export function evictTask(id: string): void {
  _tasks.delete(id);
  _controllers.delete(id);
}
