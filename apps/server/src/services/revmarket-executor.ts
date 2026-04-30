/**
 * RevMarket Task Executor (Phase 5.16-B)
 *
 * Sandboxed execution shipped via GAP-161. Agent task code runs in a
 * `child_process.fork()` per task with `--max-old-space-size` memory cap +
 * SIGTERM/SIGKILL timeout escalation (the `forkProvider` in
 * `./revmarket-sandbox/`). The PREVIEW caveat about "no process isolation"
 * is closed; remaining caveats — no syscall-level sandbox (kernel shared with
 * host), best-effort filesystem isolation (cwd is per-task tmpdir but absolute
 * paths are still reachable), no network egress firewall — are deferred to
 * Option D (containers / Vercel Sandbox) when polyglot or hostile-publisher
 * scenarios arrive.
 *
 * Trusted-only deployments (forge customer kits running operator-reviewed
 * agents) can swap in `noSandboxProvider()` via `configureExecutor` to skip
 * the fork overhead. Hosted SaaS MUST use `forkProvider`.
 *
 * Manages the lifecycle of autonomous agent task execution:
 *   1. Task claiming  -  atomic claim with priority ordering
 *   2. Timeout enforcement  -  AbortController + sandbox-side SIGTERM/SIGKILL
 *   3. Progress reporting  -  status updates to task_submissions
 *   4. Output validation  -  schema-checked results
 *   5. Audit trail  -  append-only audit_log entries
 *
 * Architecture:
 *   - Uses the existing `jobs` table as a task queue bridge
 *   - Execution is forked (Option A — `child_process.fork` per task)
 *   - Memory limit enforced via `--max-old-space-size`; timeout via SIGTERM→SIGKILL
 *   - All state transitions are atomic (single UPDATE with WHERE state = X)
 */

import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { agentSkills, auditLog, marketplaceAgents, taskSubmissions } from '@revealui/db/schema';
import { and, eq, sql } from 'drizzle-orm';

import { forkProvider, type SandboxProvider } from './revmarket-sandbox/index.js';

// =============================================================================
// Configuration
// =============================================================================

export interface ExecutorConfig {
  /** Maximum execution time per task in milliseconds (default: 5 minutes) */
  maxExecutionMs: number;
  /** Maximum concurrent task executions (default: 4) */
  maxConcurrent: number;
  /** Poll interval for queued tasks in milliseconds (default: 5 seconds) */
  pollIntervalMs: number;
  /** Maximum memory per task in MB (default: 512) */
  maxMemoryMb: number;
  /**
   * Sandbox provider used to execute agent code per task. Defaults to
   * `forkProvider()`. Override at boot for trusted-only deployments
   * (forge customer kits) with `noSandboxProvider()`, or in tests with
   * a mock provider.
   */
  sandboxProvider: SandboxProvider;
}

const DEFAULT_CONFIG: ExecutorConfig = {
  maxExecutionMs: 5 * 60 * 1000,
  maxConcurrent: 4,
  pollIntervalMs: 5_000,
  maxMemoryMb: 512,
  sandboxProvider: forkProvider(),
};

let config: ExecutorConfig = { ...DEFAULT_CONFIG };

export function configureExecutor(overrides: Partial<ExecutorConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
}

/**
 * Replace the active sandbox provider. Convenience over `configureExecutor`
 * when only the provider needs to change (e.g. in tests).
 */
export function setSandboxProvider(provider: SandboxProvider): void {
  config = { ...config, sandboxProvider: provider };
}

// =============================================================================
// Task State Machine
// =============================================================================

/**
 * Valid state transitions for task lifecycle:
 *   pending  → queued    (agent matched)
 *   queued   → running   (execution started)
 *   running  → completed (success)
 *   running  → failed    (error or timeout)
 *   pending  → cancelled (user cancelled)
 *   queued   → cancelled (user cancelled)
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['queued', 'cancelled'],
  queued: ['running', 'cancelled'],
  running: ['completed', 'failed'],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// =============================================================================
// Task Claiming (Atomic)
// =============================================================================

/**
 * Atomically claim the next queued task for execution.
 * Uses UPDATE ... WHERE state = 'queued' with priority ordering.
 * Returns null if no tasks are available.
 */
export async function claimNextTask(): Promise<string | null> {
  const db = getClient();

  // Find the highest-priority queued task
  const [candidate] = await db
    .select({ id: taskSubmissions.id })
    .from(taskSubmissions)
    .where(eq(taskSubmissions.status, 'queued'))
    .orderBy(sql`${taskSubmissions.priority} DESC, ${taskSubmissions.createdAt} ASC`)
    .limit(1);

  if (!candidate) return null;

  // Atomic transition: queued → running (CAS semantics)
  const [claimed] = await db
    .update(taskSubmissions)
    .set({
      status: 'running',
      executionMeta: {
        startedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(and(eq(taskSubmissions.id, candidate.id), eq(taskSubmissions.status, 'queued')))
    .returning();

  return claimed?.id ?? null;
}

// =============================================================================
// Task Execution
// =============================================================================

export interface TaskResult {
  success: boolean;
  output: Record<string, unknown> | null;
  artifacts: Array<{ name: string; url: string; mimeType: string }>;
  tokensUsed: number;
  durationMs: number;
  error?: string;
}

/**
 * Execute a single task with timeout enforcement and resource monitoring.
 *
 * For Phase A, execution is simulated  -  the agent definition's capabilities
 * determine the execution strategy. Full sandboxed execution (child process
 * isolation) is deferred to Phase B infrastructure expansion.
 */
export async function executeTask(taskId: string): Promise<TaskResult> {
  const db = getClient();
  const startTime = Date.now();

  // Load the task with agent details
  const [task] = await db
    .select()
    .from(taskSubmissions)
    .where(eq(taskSubmissions.id, taskId))
    .limit(1);

  if (!task) {
    return {
      success: false,
      output: null,
      artifacts: [],
      tokensUsed: 0,
      durationMs: Date.now() - startTime,
      error: 'Task not found',
    };
  }

  // Load agent definition for execution parameters
  let maxExecMs = config.maxExecutionMs;
  if (task.agentId) {
    const [agent] = await db
      .select({
        maxExecutionSecs: marketplaceAgents.maxExecutionSecs,
        resourceLimits: marketplaceAgents.resourceLimits,
      })
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.id, task.agentId))
      .limit(1);

    if (agent) {
      maxExecMs = Math.min(agent.maxExecutionSecs * 1000, config.maxExecutionMs);
    }
  }

  // Load the matching skill's output schema for validation
  let outputSchema: Record<string, unknown> | null = null;
  if (task.agentId) {
    const [skill] = await db
      .select({ outputSchema: agentSkills.outputSchema })
      .from(agentSkills)
      .where(and(eq(agentSkills.agentId, task.agentId), eq(agentSkills.name, task.skillName)))
      .limit(1);

    outputSchema = skill?.outputSchema ?? null;
  }

  // Execute with timeout. The AbortController fires at maxExecMs; the sandbox
  // provider is responsible for translating the abort into a SIGTERM-then-
  // SIGKILL escalation (forkProvider) or cooperative cancellation (other
  // providers). We don't wrap in try/catch because the provider contract
  // requires it to surface failures as { success: false, error } rather than
  // throwing — internal sandbox bugs are the only path to a thrown error.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), maxExecMs);

  try {
    const sandboxResult = await config.sandboxProvider.run({
      taskId: task.id,
      agentId: task.agentId ?? 'unassigned',
      skillName: task.skillName,
      input: (task.input as Record<string, unknown>) ?? {},
      signal: controller.signal,
      // TODO(GAP-161 Phase 2.5): honor `marketplace_agents.maxMemoryMb` per
      // task once the per-agent override path is wired (resourceLimits +
      // maxMemoryMb columns exist on the schema today as metadata-only).
      maxMemoryMb: config.maxMemoryMb,
      maxExecMs,
    });

    clearTimeout(timeout);

    // Validate output against skill schema if available.
    if (sandboxResult.success && sandboxResult.output && outputSchema) {
      const validation = validateOutput(sandboxResult.output, outputSchema);
      if (!validation.valid) {
        logger.warn('RevMarket task output failed schema validation', {
          taskId,
          errors: validation.errors,
        });
      }
    }

    return {
      success: sandboxResult.success,
      output: sandboxResult.output,
      artifacts: [...sandboxResult.artifacts],
      tokensUsed: sandboxResult.tokensUsed,
      durationMs: Date.now() - startTime,
      ...(sandboxResult.error !== undefined ? { error: sandboxResult.error } : {}),
    };
  } catch (err) {
    clearTimeout(timeout);
    return {
      success: false,
      output: null,
      artifacts: [],
      tokensUsed: 0,
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : 'Sandbox provider crashed',
    };
  }
}

// =============================================================================
// Output Validation
// =============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate task output against the skill's declared output schema.
 * Uses structural type checking (not full JSON Schema validation).
 */
function validateOutput(
  output: Record<string, unknown>,
  schema: Record<string, unknown>,
): ValidationResult {
  const errors: string[] = [];

  // Check required fields from schema
  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (typeof field === 'string' && !(field in output)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Check field types from schema properties
  if (schema.properties && typeof schema.properties === 'object') {
    for (const [key, def] of Object.entries(schema.properties)) {
      if (key in output && def && typeof def === 'object' && 'type' in def) {
        const expectedType = (def as { type: string }).type;
        const actualType = typeof output[key];
        if (expectedType === 'string' && actualType !== 'string') {
          errors.push(`Field '${key}' expected string, got ${actualType}`);
        }
        if (expectedType === 'number' && actualType !== 'number') {
          errors.push(`Field '${key}' expected number, got ${actualType}`);
        }
        if (expectedType === 'boolean' && actualType !== 'boolean') {
          errors.push(`Field '${key}' expected boolean, got ${actualType}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// =============================================================================
// Task Completion
// =============================================================================

/**
 * Complete a task with its result and update all related records.
 * Atomic: only updates if task is still in 'running' state.
 */
export async function completeTask(taskId: string, result: TaskResult): Promise<boolean> {
  const db = getClient();

  const newStatus = result.success ? 'completed' : 'failed';

  // Atomic state transition: running → completed/failed
  const [updated] = await db
    .update(taskSubmissions)
    .set({
      status: newStatus,
      output: result.output,
      artifacts: result.artifacts,
      executionMeta: {
        completedAt: new Date().toISOString(),
        durationMs: result.durationMs,
        tokensUsed: result.tokensUsed,
      },
      errorMessage: result.error ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(taskSubmissions.id, taskId), eq(taskSubmissions.status, 'running')))
    .returning();

  if (!updated) {
    logger.warn('RevMarket task completion failed  -  state race', { taskId });
    return false;
  }

  // Increment agent's task count on success
  if (result.success && updated.agentId) {
    await db
      .update(marketplaceAgents)
      .set({
        taskCount: sql`${marketplaceAgents.taskCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceAgents.id, updated.agentId));
  }

  // Write audit trail entry
  await writeAuditEntry(taskId, updated.agentId ?? 'unassigned', newStatus, result);

  logger.info('RevMarket task completed', {
    taskId,
    status: newStatus,
    durationMs: result.durationMs,
    tokensUsed: result.tokensUsed,
  });

  return true;
}

// =============================================================================
// Audit Trail
// =============================================================================

/**
 * Write an append-only audit log entry for task execution.
 * Uses the existing audit_log table (REVOKE UPDATE/DELETE enforced).
 */
async function writeAuditEntry(
  taskId: string,
  agentId: string,
  status: string,
  result: TaskResult,
): Promise<void> {
  const db = getClient();

  try {
    await db.insert(auditLog).values({
      id: crypto.randomUUID(),
      eventType: `revmarket:task:${status}`,
      severity: status === 'failed' ? 'warn' : 'info',
      agentId,
      taskId,
      payload: {
        durationMs: result.durationMs,
        tokensUsed: result.tokensUsed,
        hasOutput: result.output !== null,
        artifactCount: result.artifacts.length,
        error: result.error ?? null,
      },
      timestamp: new Date(),
    });
  } catch (err) {
    // Audit trail failures must not break task completion
    logger.error('RevMarket audit log write failed', err instanceof Error ? err : undefined, {
      taskId,
    });
  }
}

// =============================================================================
// Progress Reporting
// =============================================================================

export interface TaskProgress {
  taskId: string;
  status: string;
  progress: number; // 0-100
  message: string;
  updatedAt: string;
}

/**
 * Update task progress (for streaming status to clients).
 * Stores progress in executionMeta without changing task status.
 */
export async function updateTaskProgress(
  taskId: string,
  progress: number,
  message: string,
): Promise<void> {
  const db = getClient();

  await db
    .update(taskSubmissions)
    .set({
      executionMeta: sql`
        COALESCE(${taskSubmissions.executionMeta}, '{}'::jsonb)
        || jsonb_build_object(
          'progress', ${progress},
          'progressMessage', ${message},
          'progressUpdatedAt', ${new Date().toISOString()}
        )
      `,
      updatedAt: new Date(),
    })
    .where(and(eq(taskSubmissions.id, taskId), eq(taskSubmissions.status, 'running')));
}

/**
 * Get current task progress for polling clients.
 */
export async function getTaskProgress(taskId: string): Promise<TaskProgress | null> {
  const db = getClient();

  const [task] = await db
    .select({
      id: taskSubmissions.id,
      status: taskSubmissions.status,
      executionMeta: taskSubmissions.executionMeta,
      updatedAt: taskSubmissions.updatedAt,
    })
    .from(taskSubmissions)
    .where(eq(taskSubmissions.id, taskId))
    .limit(1);

  if (!task) return null;

  const meta = task.executionMeta as Record<string, unknown> | null;

  return {
    taskId: task.id,
    status: task.status,
    progress: (meta?.progress as number) ?? 0,
    message: (meta?.progressMessage as string) ?? '',
    updatedAt: task.updatedAt.toISOString(),
  };
}

// =============================================================================
// Executor Loop
// =============================================================================

let isRunning = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let activeTaskCount = 0;

/**
 * Start the task executor polling loop.
 * Claims and executes queued tasks up to maxConcurrent limit.
 */
export function startExecutor(): void {
  if (isRunning) return;
  isRunning = true;

  logger.info('RevMarket executor started', {
    maxConcurrent: config.maxConcurrent,
    pollIntervalMs: config.pollIntervalMs,
  });

  pollTimer = setInterval(async () => {
    if (activeTaskCount >= config.maxConcurrent) return;

    try {
      const taskId = await claimNextTask();
      if (!taskId) return;

      activeTaskCount++;
      logger.info('RevMarket task claimed', { taskId, activeTaskCount });

      // Execute in background (don't block the poll loop)
      executeTask(taskId)
        .then((result) => completeTask(taskId, result))
        .catch((err) => {
          logger.error('RevMarket task execution crashed', err instanceof Error ? err : undefined, {
            taskId,
          });
          // Attempt to mark as failed
          return completeTask(taskId, {
            success: false,
            output: null,
            artifacts: [],
            tokensUsed: 0,
            durationMs: 0,
            error: err instanceof Error ? err.message : 'Execution crashed',
          });
        })
        .finally(() => {
          activeTaskCount--;
        });
    } catch (err) {
      logger.error('RevMarket executor poll error', err instanceof Error ? err : undefined);
    }
  }, config.pollIntervalMs);
}

/**
 * Stop the task executor loop gracefully.
 * Running tasks will complete but no new tasks will be claimed.
 */
export function stopExecutor(): void {
  if (!isRunning) return;
  isRunning = false;

  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  logger.info('RevMarket executor stopped', { activeTaskCount });
}

/**
 * Get executor status for health checks.
 */
export function getExecutorStatus(): {
  running: boolean;
  activeTasks: number;
  maxConcurrent: number;
} {
  return {
    running: isRunning,
    activeTasks: activeTaskCount,
    maxConcurrent: config.maxConcurrent,
  };
}
