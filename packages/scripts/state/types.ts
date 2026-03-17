/**
 * State Management Types for RevealUI Scripts
 *
 * @dependencies
 * - None (standalone type definitions)
 */

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  command?: string;
  script?: string;
  requiresApproval: boolean;
  validation?: string[];
  rollback?: string;
  timeout?: number;
  dependsOn?: string[];
}

export interface WorkflowStepState {
  stepId: string;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  output?: string;
  retryCount: number;
}

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  stepId: string;
  token: string;
  status: ApprovalStatus;
  requestedAt: Date;
  respondedAt?: Date;
  respondedBy?: string;
  expiresAt: Date;
  comment?: string;
}

export interface WorkflowState {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  stepStates: Map<string, WorkflowStepState>;
  currentStepIndex: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type WorkflowEvent =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CANCEL' }
  | { type: 'STEP_START'; stepId: string }
  | { type: 'STEP_COMPLETE'; stepId: string; output?: string }
  | { type: 'STEP_FAIL'; stepId: string; error: string }
  | { type: 'STEP_SKIP'; stepId: string }
  | { type: 'APPROVAL_REQUEST'; stepId: string }
  | { type: 'APPROVAL_GRANTED'; stepId: string; by?: string }
  | { type: 'APPROVAL_DENIED'; stepId: string; reason?: string }
  | { type: 'COMPLETE' }
  | { type: 'FAIL'; error: string };

export interface StateAdapter {
  initialize(): Promise<void>;
  close(): Promise<void>;

  // Workflow operations
  saveWorkflow(workflow: WorkflowState): Promise<void>;
  loadWorkflow(id: string): Promise<WorkflowState | null>;
  listWorkflows(options?: { status?: WorkflowStatus; limit?: number }): Promise<WorkflowState[]>;
  deleteWorkflow(id: string): Promise<boolean>;

  // Approval operations
  saveApproval(approval: ApprovalRequest): Promise<void>;
  loadApproval(token: string): Promise<ApprovalRequest | null>;
  loadApprovalsByWorkflow(workflowId: string): Promise<ApprovalRequest[]>;
  updateApprovalStatus(
    token: string,
    status: ApprovalStatus,
    respondedBy?: string,
    comment?: string,
  ): Promise<void>;
}
