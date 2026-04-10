/**
 * Job Task and Workflow Types
 *
 * Defines types for background jobs, tasks, and workflows in RevealUI.
 * Based on agent state schemas and admin job patterns.
 */

/**
 * Job task status
 */
export type JobTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Job task priority
 */
export type JobTaskPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Individual job task
 */
export interface JobTask {
  /** Unique task identifier */
  id: string;

  /** Task description */
  description: string;

  /** Current task status */
  status: JobTaskStatus;

  /** Task progress (0.0 to 1.0) */
  progress?: number;

  /** Task priority */
  priority?: JobTaskPriority;

  /** Task type/category */
  type?: string;

  /** Task metadata */
  metadata?: Record<string, unknown>;

  /** Created timestamp */
  createdAt?: Date | string;

  /** Updated timestamp */
  updatedAt?: Date | string;

  /** Started timestamp */
  startedAt?: Date | string;

  /** Completed timestamp */
  completedAt?: Date | string;

  /** Error message if failed */
  error?: string;

  /** Retry count */
  retries?: number;

  /** Maximum retries */
  maxRetries?: number;
}

/**
 * Workflow step
 */
export interface WorkflowStep {
  /** Step identifier */
  id: string;

  /** Step name */
  name: string;

  /** Step description */
  description?: string;

  /** Step type */
  type: string;

  /** Step configuration */
  config?: Record<string, unknown>;

  /** Dependencies (step IDs that must complete first) */
  dependencies?: string[];

  /** Step status */
  status?: JobTaskStatus;

  /** Step result */
  result?: unknown;
}

/**
 * Job workflow
 */
export interface JobWorkflow {
  /** Unique workflow identifier */
  id: string;

  /** Workflow name */
  name: string;

  /** Workflow description */
  description?: string;

  /** Workflow steps */
  steps: WorkflowStep[];

  /** Current step index */
  currentStepIndex?: number;

  /** Workflow status */
  status: JobTaskStatus;

  /** Workflow metadata */
  metadata?: Record<string, unknown>;

  /** Created timestamp */
  createdAt?: Date | string;

  /** Updated timestamp */
  updatedAt?: Date | string;

  /** Started timestamp */
  startedAt?: Date | string;

  /** Completed timestamp */
  completedAt?: Date | string;

  /** Error message if failed */
  error?: string;

  /** Input data for workflow */
  input?: Record<string, unknown>;

  /** Output data from workflow */
  output?: Record<string, unknown>;
}

/**
 * Jobs configuration type
 * Maps task and workflow types to their implementations
 */
export interface JobsConfig {
  /** Available task types and their configurations */
  tasks: Record<string, JobTask> | JobTask[] | JobTask;

  /** Available workflow types and their configurations */
  workflows: Record<string, JobWorkflow> | JobWorkflow[] | JobWorkflow;
}
