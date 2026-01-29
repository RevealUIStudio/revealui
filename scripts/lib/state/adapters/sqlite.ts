/**
 * SQLite State Adapter
 *
 * Provides persistent state storage using SQLite.
 * State is stored in .revealui/state/workflows.db
 */

import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  ApprovalRequest,
  ApprovalStatus,
  StateAdapter,
  WorkflowState,
  WorkflowStatus,
  WorkflowStep,
  WorkflowStepState,
} from '../types.js'

// SQLite types (dynamically imported)
type BetterSqlite3Database = {
  exec(sql: string): void
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number }
    get(...params: unknown[]): unknown
    all(...params: unknown[]): unknown[]
  }
  close(): void
}

type BetterSqlite3 = (filename: string, options?: { fileMustExist?: boolean }) => BetterSqlite3Database

export interface SQLiteAdapterOptions {
  /** Path to the SQLite database file */
  dbPath?: string
  /** Whether to enable WAL mode for better performance */
  walMode?: boolean
}

export class SQLiteStateAdapter implements StateAdapter {
  private db: BetterSqlite3Database | null = null
  private dbPath: string
  private walMode: boolean

  constructor(options: SQLiteAdapterOptions = {}) {
    this.dbPath = options.dbPath || join(process.cwd(), '.revealui', 'state', 'workflows.db')
    this.walMode = options.walMode ?? true
  }

  async initialize(): Promise<void> {
    // Ensure directory exists
    await mkdir(dirname(this.dbPath), { recursive: true })

    // Dynamically import better-sqlite3
    let BetterSqlite3: BetterSqlite3
    try {
      const module = await import('better-sqlite3')
      BetterSqlite3 = module.default as BetterSqlite3
    } catch {
      throw new Error(
        'better-sqlite3 is not installed. Run: pnpm add -D better-sqlite3 @types/better-sqlite3',
      )
    }

    this.db = BetterSqlite3(this.dbPath)

    // Enable WAL mode for better concurrent access
    if (this.walMode) {
      this.db.exec('PRAGMA journal_mode = WAL')
    }

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        steps TEXT NOT NULL,
        step_states TEXT NOT NULL DEFAULT '{}',
        current_step_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        error TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        requested_at TEXT NOT NULL,
        responded_at TEXT,
        responded_by TEXT,
        expires_at TEXT NOT NULL,
        comment TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
      CREATE INDEX IF NOT EXISTS idx_workflows_updated ON workflows(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_approvals_token ON approvals(token);
      CREATE INDEX IF NOT EXISTS idx_approvals_workflow ON approvals(workflow_id);
    `)
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  async saveWorkflow(workflow: WorkflowState): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workflows
      (id, name, description, status, steps, step_states, current_step_index,
       created_at, updated_at, completed_at, error, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
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
    )
  }

  async loadWorkflow(id: string): Promise<WorkflowState | null> {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('SELECT * FROM workflows WHERE id = ?')
    const row = stmt.get(id) as WorkflowRow | undefined

    return row ? this.rowToWorkflow(row) : null
  }

  async listWorkflows(options?: {
    status?: WorkflowStatus
    limit?: number
  }): Promise<WorkflowState[]> {
    if (!this.db) throw new Error('Database not initialized')

    let sql = 'SELECT * FROM workflows'
    const params: unknown[] = []

    if (options?.status) {
      sql += ' WHERE status = ?'
      params.push(options.status)
    }

    sql += ' ORDER BY updated_at DESC'

    if (options?.limit) {
      sql += ' LIMIT ?'
      params.push(options.limit)
    }

    const stmt = this.db.prepare(sql)
    const rows = stmt.all(...params) as WorkflowRow[]

    return rows.map((row) => this.rowToWorkflow(row))
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('DELETE FROM workflows WHERE id = ?')
    const result = stmt.run(id)

    return result.changes > 0
  }

  async saveApproval(approval: ApprovalRequest): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO approvals
      (id, workflow_id, step_id, token, status, requested_at, responded_at,
       responded_by, expires_at, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
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
    )
  }

  async loadApproval(token: string): Promise<ApprovalRequest | null> {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('SELECT * FROM approvals WHERE token = ?')
    const row = stmt.get(token) as ApprovalRow | undefined

    return row ? this.rowToApproval(row) : null
  }

  async loadApprovalsByWorkflow(workflowId: string): Promise<ApprovalRequest[]> {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare('SELECT * FROM approvals WHERE workflow_id = ? ORDER BY requested_at DESC')
    const rows = stmt.all(workflowId) as ApprovalRow[]

    return rows.map((row) => this.rowToApproval(row))
  }

  async updateApprovalStatus(
    token: string,
    status: ApprovalStatus,
    respondedBy?: string,
    comment?: string,
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const stmt = this.db.prepare(`
      UPDATE approvals
      SET status = ?, responded_at = ?, responded_by = ?, comment = ?
      WHERE token = ?
    `)

    stmt.run(status, new Date().toISOString(), respondedBy || null, comment || null, token)
  }

  private serializeStepStates(stepStates: Map<string, WorkflowStepState>): Record<string, WorkflowStepState> {
    const result: Record<string, WorkflowStepState> = {}
    for (const [key, value] of stepStates) {
      result[key] = {
        ...value,
        startedAt: value.startedAt ? value.startedAt : undefined,
        completedAt: value.completedAt ? value.completedAt : undefined,
      }
    }
    return result
  }

  private deserializeStepStates(data: Record<string, WorkflowStepState>): Map<string, WorkflowStepState> {
    const map = new Map<string, WorkflowStepState>()
    for (const [key, value] of Object.entries(data)) {
      map.set(key, {
        ...value,
        startedAt: value.startedAt ? new Date(value.startedAt) : undefined,
        completedAt: value.completedAt ? new Date(value.completedAt) : undefined,
      })
    }
    return map
  }

  private rowToWorkflow(row: WorkflowRow): WorkflowState {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      status: row.status as WorkflowStatus,
      steps: JSON.parse(row.steps) as WorkflowStep[],
      stepStates: this.deserializeStepStates(JSON.parse(row.step_states)),
      currentStepIndex: row.current_step_index,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      error: row.error || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }
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
    }
  }
}

interface WorkflowRow {
  id: string
  name: string
  description: string | null
  status: string
  steps: string
  step_states: string
  current_step_index: number
  created_at: string
  updated_at: string
  completed_at: string | null
  error: string | null
  metadata: string | null
}

interface ApprovalRow {
  id: string
  workflow_id: string
  step_id: string
  token: string
  status: string
  requested_at: string
  responded_at: string | null
  responded_by: string | null
  expires_at: string
  comment: string | null
}
