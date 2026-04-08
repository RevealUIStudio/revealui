/**
 * Procedural Memory
 *
 * Stores and executes named workflows for AI agents.
 * Workflows are sequences of typed steps that can be run
 * sequentially or in parallel.
 *
 * @example
 * ```typescript
 * const mem = new ProceduralMemory()
 *
 * mem.register('onboard-user', [
 *   { id: 'welcome', type: 'action', label: 'Send welcome email',
 *     execute: async (ctx) => { ... } },
 *   { id: 'create-profile', type: 'action', label: 'Init profile',
 *     execute: async (ctx) => { ... } },
 * ])
 *
 * const result = await mem.execute('onboard-user', { userId: 'u1' })
 * ```
 */

// =============================================================================
// Types
// =============================================================================

export interface WorkflowContext {
  [key: string]: unknown;
}

export interface WorkflowStep {
  id: string;
  label: string;
  type: 'action' | 'condition' | 'parallel';
  /** True when this step and the next should run concurrently */
  parallel?: boolean;
  execute: (context: WorkflowContext) => Promise<unknown>;
}

export interface WorkflowDefinition {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  createdAt: number;
}

export interface WorkflowResult {
  workflow: string;
  success: boolean;
  steps: Array<{ id: string; status: 'ok' | 'error'; result?: unknown; error?: string }>;
  durationMs: number;
}

// =============================================================================
// ProceduralMemory
// =============================================================================

/**
 * Procedural Memory stores named workflow definitions and executes them
 * against a shared context object.
 */
export class ProceduralMemory {
  private workflows: Map<string, WorkflowDefinition> = new Map();

  /**
   * Register a new workflow.
   * If a workflow with the same name already exists it is overwritten.
   */
  register(name: string, steps: WorkflowStep[], description?: string): void {
    this.workflows.set(name, { name, description, steps, createdAt: Date.now() });
  }

  /**
   * Unregister a workflow by name.
   */
  unregister(name: string): void {
    this.workflows.delete(name);
  }

  /**
   * Check whether a workflow is registered.
   */
  has(name: string): boolean {
    return this.workflows.has(name);
  }

  /**
   * List all registered workflow names.
   */
  listWorkflows(): string[] {
    return Array.from(this.workflows.keys());
  }

  /**
   * Get the definition for a registered workflow.
   */
  getDefinition(name: string): WorkflowDefinition | undefined {
    return this.workflows.get(name);
  }

  /**
   * Execute a workflow by name.
   *
   * Steps marked `parallel: true` are executed concurrently with the
   * immediately following step(s). All other steps run sequentially.
   *
   * @param name    - Registered workflow name
   * @param context - Initial context object passed to each step
   * @throws {Error} If the workflow is not registered
   */
  async execute(name: string, context: WorkflowContext = {}): Promise<WorkflowResult> {
    const workflow = this.workflows.get(name);
    if (!workflow) {
      throw new Error(`Workflow "${name}" is not registered`);
    }

    const stepResults: WorkflowResult['steps'] = [];
    const startTime = Date.now();

    // Group steps into sequential "batches". Consecutive steps that have
    // parallel:true are collected into one batch and run with Promise.all.
    const batches = buildBatches(workflow.steps);

    for (const batch of batches) {
      if (batch.length === 1) {
        // Sequential step
        // biome-ignore lint/style/noNonNullAssertion: batch[0] is guaranteed by batch.length === 1 check above
        const step = batch[0]!;
        try {
          const result = await step.execute(context);
          stepResults.push({ id: step.id, status: 'ok', result });
        } catch (err) {
          stepResults.push({
            id: step.id,
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } else {
        // Parallel batch
        const settled = await Promise.allSettled(batch.map((s) => s.execute(context)));
        for (let i = 0; i < batch.length; i++) {
          // biome-ignore lint/style/noNonNullAssertion: i is bounded by batch.length, so settled[i] and batch[i] are always defined
          const outcome = settled[i]!;
          // biome-ignore lint/style/noNonNullAssertion: i is bounded by batch.length, so batch[i] is always defined
          const batchStep = batch[i]!;
          if (outcome.status === 'fulfilled') {
            const { value } = outcome as PromiseFulfilledResult<unknown>;
            stepResults.push({ id: batchStep.id, status: 'ok', result: value });
          } else {
            const { reason } = outcome as PromiseRejectedResult;
            stepResults.push({
              id: batchStep.id,
              status: 'error',
              error: reason instanceof Error ? reason.message : String(reason),
            });
          }
        }
      }
    }

    const success = stepResults.every((r) => r.status === 'ok');

    return {
      workflow: name,
      success,
      steps: stepResults,
      durationMs: Date.now() - startTime,
    };
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Group steps into sequential batches.
 * A step with `parallel: true` is placed in the same batch as the next step.
 */
function buildBatches(steps: WorkflowStep[]): WorkflowStep[][] {
  const batches: WorkflowStep[][] = [];
  let current: WorkflowStep[] = [];

  for (const step of steps) {
    current.push(step);
    if (!step.parallel) {
      batches.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}
