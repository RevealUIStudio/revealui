/**
 * A2A Task Store
 *
 * Private in-memory execution state and trusted receipt ownership.
 * Durable receipt storage is owned by the server's agentActions boundary;
 * this cache does not survive restart and currently requires explicit eviction.
 */

import type {
  A2AArtifact,
  A2AMessage,
  A2ATask,
  A2ATaskState,
  AgentDefinition,
} from '@revealui/contracts';
import type { AgentActionScope } from '@revealui/db/schema';

export type TaskExecutionBinding = { agentId: string; definition: AgentDefinition | undefined };

// Ownership, cancellation, and one-use execution stay in the same private entry.
const _tasks = new Map<
  string,
  {
    task: A2ATask;
    owner: Readonly<AgentActionScope>;
    controller: AbortController;
    prepared: A2ATask;
    claimed: boolean;
    started: boolean;
    input: string;
    execution: Readonly<TaskExecutionBinding>;
  }
>();

function owns(entry: { owner: AgentActionScope } | undefined, scope?: AgentActionScope): boolean {
  return (
    !!entry &&
    !!scope &&
    validScope(scope) &&
    entry.owner.actorUserId === scope.actorUserId &&
    entry.owner.accountId === scope.accountId
  );
}

function validScope(scope: AgentActionScope | undefined): boolean {
  return (
    !!scope &&
    typeof scope.actorUserId === 'string' &&
    !!scope.actorUserId.trim() &&
    (scope.accountId === null || (typeof scope.accountId === 'string' && !!scope.accountId.trim()))
  );
}

function terminal(state: A2ATaskState): boolean {
  return ['completed', 'failed', 'canceled', 'unknown'].includes(state);
}

function freezeValue<T>(value: T): T {
  const freeze = (value: unknown): void => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  };
  freeze(value);
  return value;
}

function inputKey(
  params: Parameters<typeof createTask>[0],
  execution: TaskExecutionBinding,
): string {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, normalize(item)]),
      );
    return value;
  };
  return JSON.stringify(
    normalize({
      sessionId: params.sessionId,
      message: params.message,
      metadata: params.metadata,
      execution,
    }),
  );
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Create a new task in the 'submitted' state.
 */
export function createTask(
  params: {
    id?: string;
    sessionId?: string;
    message: A2AMessage;
    metadata?: Record<string, unknown>;
  },
  scope: AgentActionScope,
  execution: TaskExecutionBinding,
): A2ATask | null {
  if (!(validScope(scope) && execution?.agentId)) return null;
  const id = params.id ?? crypto.randomUUID();
  if (!id.trim() || id.length > 512 || _tasks.has(id)) return null;
  const snapshot = structuredClone(params);
  const task: A2ATask = {
    id,
    sessionId: snapshot.sessionId,
    status: {
      state: 'submitted',
      timestamp: now(),
    },
    history: [snapshot.message],
    metadata: snapshot.metadata,
  };
  freezeValue(task);
  _tasks.set(id, {
    task,
    owner: Object.freeze({ ...scope }),
    controller: new AbortController(),
    prepared: task,
    claimed: false,
    started: false,
    input: inputKey(params, execution),
    execution: freezeValue(structuredClone(execution)),
  });
  return task;
}

/** Consume the original private reservation once, before executing side effects. */
export function isTaskReservation(task: A2ATask, scope: AgentActionScope): boolean {
  const entry = _tasks.get(task.id);
  return (
    owns(entry, scope) &&
    !!entry &&
    entry.prepared === task &&
    !entry.claimed &&
    !terminal(entry.task.status.state)
  );
}

export function matchesTaskInput(
  task: A2ATask,
  scope: AgentActionScope,
  params: Parameters<typeof createTask>[0],
  execution: TaskExecutionBinding,
): boolean {
  const entry = _tasks.get(task.id);
  return (
    owns(entry, scope) &&
    !!entry &&
    entry.prepared === task &&
    entry.input === inputKey(params, execution)
  );
}

/** Private immutable execution definition; excluded from task metadata and responses. */
export function getTaskExecution(
  task: A2ATask,
  scope: AgentActionScope,
): Readonly<TaskExecutionBinding> | null {
  const entry = _tasks.get(task.id);
  return owns(entry, scope) && entry && entry.prepared === task ? entry.execution : null;
}

export function claimTask(task: A2ATask, scope: AgentActionScope): boolean {
  const entry = _tasks.get(task.id);
  if (!(entry && isTaskReservation(task, scope))) return false;
  entry.claimed = true;
  return true;
}

/** An unpaid task may continue only with the exact original trusted input. */
export function resumePendingTask(
  params: Parameters<typeof createTask>[0],
  scope: AgentActionScope,
  execution: TaskExecutionBinding,
): A2ATask | null {
  if (!params.id) return null;
  const entry = _tasks.get(params.id);
  return owns(entry, scope) &&
    entry &&
    !entry.claimed &&
    entry.task.status.state === 'pending-payment' &&
    entry.input === inputKey(params, execution)
    ? entry.prepared
    : null;
}

/** Consume a metered execution claim once; never restart an already invoked provider. */
export function startClaimedTask(task: A2ATask, scope: AgentActionScope): boolean {
  const entry = _tasks.get(task.id);
  if (
    !(owns(entry, scope) && entry) ||
    entry.prepared !== task ||
    !entry.claimed ||
    entry.started ||
    terminal(entry.task.status.state)
  )
    return false;
  entry.started = true;
  return true;
}

/**
 * Get a task by ID.
 */
export function getTask(id: string, scope: AgentActionScope): A2ATask | null {
  const entry = _tasks.get(id);
  return owns(entry, scope) ? (entry?.task ?? null) : null;
}

/**
 * Transition a task to a new state, optionally attaching a message.
 */
export function updateTaskState(
  id: string,
  state: A2ATaskState,
  message?: A2AMessage,
): A2ATask | null {
  const entry = _tasks.get(id);
  if (!entry) return null;
  const task = entry.task;
  if (terminal(task.status.state)) return task;

  const updated: A2ATask = {
    ...task,
    status: {
      state,
      message,
      timestamp: now(),
    },
    history: message ? [...(task.history ?? []), message] : task.history,
  };
  entry.task = freezeValue(updated);
  return updated;
}

/**
 * Append an artifact to a completed task.
 */
export function appendArtifact(id: string, artifact: A2AArtifact): A2ATask | null {
  const entry = _tasks.get(id);
  if (!entry) return null;
  const task = entry.task;
  if (terminal(task.status.state)) return task;

  const updated: A2ATask = {
    ...task,
    artifacts: [...(task.artifacts ?? []), artifact],
  };
  entry.task = freezeValue(updated);
  return updated;
}

/**
 * Cancel a task. Returns true if the task was cancelable.
 */
export function cancelTask(id: string, scope: AgentActionScope): boolean {
  const entry = _tasks.get(id);
  if (!(owns(entry, scope) && entry)) return false;
  const task = entry.task;

  // 'pending-payment' is cancelable so a requester who decides not to pay
  // can release the task slot rather than leaving it dangling.
  const cancelable =
    task.status.state === 'submitted' ||
    task.status.state === 'working' ||
    task.status.state === 'pending-payment';
  if (!cancelable) return false;

  // Signal abort to any running execution
  entry.controller.abort();

  updateTaskState(id, 'canceled');
  return true;
}

/**
 * Get the AbortSignal for a running task (so the executor can detect cancellation).
 */
export function getTaskSignal(id: string, scope: AgentActionScope): AbortSignal | null {
  const entry = _tasks.get(id);
  return owns(entry, scope) ? (entry?.controller.signal ?? null) : null;
}

/**
 * Cleanup a task from the store (call after response has been sent).
 */
export function evictTask(id: string): void {
  _tasks.delete(id);
}
