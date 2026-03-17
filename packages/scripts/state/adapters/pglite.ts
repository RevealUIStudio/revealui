/**
 * PGlite State Adapter
 *
 * Provides persistent state storage using PGlite (embedded PostgreSQL).
 * State is stored in .revealui/state/workflows
 *
 * Benefits over SQLite:
 * - PostgreSQL-compatible SQL syntax matches production databases (Neon/Supabase)
 * - Same query patterns work in development and production
 * - Supports PostgreSQL-specific features if needed
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode and ScriptError for validation
 * - scripts/lib/state/types.ts - State management type definitions
 * - @electric-sql/pglite - Embedded PostgreSQL (dynamic import)
 * - node:fs/promises - File system operations (mkdir)
 * - node:path - Path manipulation utilities
 */

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ErrorCode, ScriptError } from '../../errors.js';
import type {
  ApprovalRequest,
  ApprovalStatus,
  StateAdapter,
  WorkflowState,
  WorkflowStatus,
  WorkflowStep,
  WorkflowStepState,
} from '../types.js';

export interface PGliteAdapterOptions {
  /** Path to the PGlite data directory */
  dataDir?: string;
}

export class PGliteStateAdapter implements StateAdapter {
  private db: PGliteInstance | null = null;
  private dataDir: string;

  constructor(options: PGliteAdapterOptions = {}) {
    this.dataDir = options.dataDir || join(process.cwd(), '.revealui', 'state', 'workflows');
  }

  async initialize(): Promise<void> {
    // Ensure directory exists
    await mkdir(dirname(this.dataDir), { recursive: true });

    // Dynamically import @electric-sql/pglite
    try {
      const { PGlite } = await import('@electric-sql/pglite');
      this.db = new PGlite(this.dataDir) as PGliteInstance;
      await this.db.waitReady;
    } catch (_error) {
      throw new ScriptError(
        '@electric-sql/pglite is not installed. Run: pnpm add -D @electric-sql/pglite',
        ErrorCode.DEPENDENCY_ERROR,
      );
    }

    // Create tables using PostgreSQL syntax
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        steps JSONB NOT NULL,
        step_states JSONB NOT NULL DEFAULT '{}',
        current_step_index INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        error TEXT,
        metadata JSONB
      );

      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        step_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        requested_at TIMESTAMPTZ NOT NULL,
        responded_at TIMESTAMPTZ,
        responded_by TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        comment TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
      CREATE INDEX IF NOT EXISTS idx_workflows_updated ON workflows(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_approvals_token ON approvals(token);
      CREATE INDEX IF NOT EXISTS idx_approvals_workflow ON approvals(workflow_id);
    `);
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  async saveWorkflow(workflow: WorkflowState): Promise<void> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    await this.db.query(
      `
      INSERT INTO workflows
      (id, name, description, status, steps, step_states, current_step_index,
       created_at, updated_at, completed_at, error, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        steps = EXCLUDED.steps,
        step_states = EXCLUDED.step_states,
        current_step_index = EXCLUDED.current_step_index,
        updated_at = EXCLUDED.updated_at,
        completed_at = EXCLUDED.completed_at,
        error = EXCLUDED.error,
        metadata = EXCLUDED.metadata
    `,
      [
        workflow.id,
        workflow.name,
        workflow.description || null,
        workflow.status,
        JSON.stringify(workflow.steps),
        JSON.stringify(this.serializeStepStates(workflow.stepStates)),
        workflow.currentStepIndex,
        workflow.createdAt.toISOString(),
        workflow.updatedAt.toISOString(),
        workflow.completedAt?.toISOString() || null,
        workflow.error || null,
        workflow.metadata ? JSON.stringify(workflow.metadata) : null,
      ],
    );
  }

  async loadWorkflow(id: string): Promise<WorkflowState | null> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    const result = await this.db.query<WorkflowRow>('SELECT * FROM workflows WHERE id = $1', [id]);

    return result.rows.length > 0 ? this.rowToWorkflow(result.rows[0]) : null;
  }

  async listWorkflows(options?: {
    status?: WorkflowStatus;
    limit?: number;
  }): Promise<WorkflowState[]> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    let sql = 'SELECT * FROM workflows';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.status) {
      sql += ` WHERE status = $${paramIndex++}`;
      params.push(options.status);
    }

    sql += ' ORDER BY updated_at DESC';

    if (options?.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    const result = await this.db.query<WorkflowRow>(sql, params);

    return result.rows.map((row) => this.rowToWorkflow(row));
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    const result = await this.db.query('DELETE FROM workflows WHERE id = $1', [id]);

    return (result.affectedRows ?? 0) > 0;
  }

  async saveApproval(approval: ApprovalRequest): Promise<void> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    await this.db.query(
      `
      INSERT INTO approvals
      (id, workflow_id, step_id, token, status, requested_at, responded_at,
       responded_by, expires_at, comment)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        responded_at = EXCLUDED.responded_at,
        responded_by = EXCLUDED.responded_by,
        comment = EXCLUDED.comment
    `,
      [
        approval.id,
        approval.workflowId,
        approval.stepId,
        approval.token,
        approval.status,
        approval.requestedAt.toISOString(),
        approval.respondedAt?.toISOString() || null,
        approval.respondedBy || null,
        approval.expiresAt.toISOString(),
        approval.comment || null,
      ],
    );
  }

  async loadApproval(token: string): Promise<ApprovalRequest | null> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    const result = await this.db.query<ApprovalRow>('SELECT * FROM approvals WHERE token = $1', [
      token,
    ]);

    return result.rows.length > 0 ? this.rowToApproval(result.rows[0]) : null;
  }

  async loadApprovalsByWorkflow(workflowId: string): Promise<ApprovalRequest[]> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    const result = await this.db.query<ApprovalRow>(
      'SELECT * FROM approvals WHERE workflow_id = $1 ORDER BY requested_at DESC',
      [workflowId],
    );

    return result.rows.map((row) => this.rowToApproval(row));
  }

  async updateApprovalStatus(
    token: string,
    status: ApprovalStatus,
    respondedBy?: string,
    comment?: string,
  ): Promise<void> {
    if (!this.db) throw new ScriptError('Database not initialized', ErrorCode.INVALID_STATE);

    await this.db.query(
      `
      UPDATE approvals
      SET status = $1, responded_at = $2, responded_by = $3, comment = $4
      WHERE token = $5
    `,
      [status, new Date().toISOString(), respondedBy || null, comment || null, token],
    );
  }

  private serializeStepStates(
    stepStates: Map<string, WorkflowStepState>,
  ): Record<string, WorkflowStepState> {
    const result: Record<string, WorkflowStepState> = {};
    for (const [key, value] of stepStates.entries()) {
      result[key] = {
        ...value,
        startedAt: value.startedAt ? value.startedAt : undefined,
        completedAt: value.completedAt ? value.completedAt : undefined,
      };
    }
    return result;
  }

  private deserializeStepStates(
    data: Record<string, WorkflowStepState>,
  ): Map<string, WorkflowStepState> {
    const map = new Map<string, WorkflowStepState>();
    for (const [key, value] of Object.entries(data)) {
      map.set(key, {
        ...value,
        startedAt: value.startedAt ? new Date(value.startedAt) : undefined,
        completedAt: value.completedAt ? new Date(value.completedAt) : undefined,
      });
    }
    return map;
  }

  private rowToWorkflow(row: WorkflowRow): WorkflowState {
    // Handle JSONB columns - they may already be parsed objects
    const steps = typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps;
    const stepStates =
      typeof row.step_states === 'string' ? JSON.parse(row.step_states) : row.step_states;
    const metadata = row.metadata
      ? typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata
      : undefined;

    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      status: row.status as WorkflowStatus,
      steps: steps as WorkflowStep[],
      stepStates: this.deserializeStepStates(stepStates),
      currentStepIndex: row.current_step_index,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error || undefined,
      metadata,
    };
  }

  private rowToApproval(row: ApprovalRow): ApprovalRequest {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      stepId: row.step_id,
      token: row.token,
      status: row.status as ApprovalStatus,
      requestedAt: new Date(row.requested_at),
      respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
      respondedBy: row.responded_by || undefined,
      expiresAt: new Date(row.expires_at),
      comment: row.comment || undefined,
    };
  }
}

// Type definitions for PGlite - we use a minimal interface to avoid import issues
interface PGliteInstance {
  waitReady: Promise<void>;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(query: string): Promise<unknown>;
  close(): Promise<void>;
}

interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  steps: string | WorkflowStep[];
  step_states: string | Record<string, WorkflowStepState>;
  current_step_index: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error: string | null;
  metadata: string | Record<string, unknown> | null;
}

interface ApprovalRow {
  id: string;
  workflow_id: string;
  step_id: string;
  token: string;
  status: string;
  requested_at: string;
  responded_at: string | null;
  responded_by: string | null;
  expires_at: string;
  comment: string | null;
}
