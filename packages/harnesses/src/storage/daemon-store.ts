/**
 * DaemonStore  -  persistent state for the RevDev Harness daemon.
 *
 * Backed by PGlite (in-process PostgreSQL). The database file lives at
 * ~/.local/share/revealui/harness.db and survives daemon restarts.
 *
 * All methods are async (PGlite queries return promises).
 */

import type { PGlite } from '@electric-sql/pglite';
import type {
  AgentMemoryEntry,
  AgentMessage,
  AgentSession,
  AgentTask,
  AgentWorktree,
  DaemonEvent,
  FileReservation,
  MergeRequest,
} from './schema.js';
import { SCHEMA_SQL } from './schema.js';

/** Configuration for DaemonStore. */
export interface DaemonStoreConfig {
  /** PGlite data directory (default: ~/.local/share/revealui/harness.db) */
  dataDir: string;
}

export class DaemonStore {
  private db: PGlite | null = null;
  private readonly dataDir: string;

  constructor(config: DaemonStoreConfig) {
    this.dataDir = config.dataDir;
  }

  /** Initialize PGlite and create tables. */
  async init(): Promise<void> {
    const { PGlite: PGliteClass } = await import('@electric-sql/pglite');
    this.db = new PGliteClass(this.dataDir);
    await this.db.exec(SCHEMA_SQL);
  }

  /** Shut down the database. */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  private getDb(): PGlite {
    if (!this.db) throw new Error('DaemonStore not initialized  -  call init() first');
    return this.db;
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  /** Register or update an agent session. */
  async registerSession(session: {
    id: string;
    env: string;
    task?: string;
    pid?: number;
  }): Promise<AgentSession> {
    const db = this.getDb();
    const result = await db.query<AgentSession>(
      `INSERT INTO agent_sessions (id, env, task, pid)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         env = EXCLUDED.env,
         task = COALESCE(EXCLUDED.task, agent_sessions.task),
         pid = COALESCE(EXCLUDED.pid, agent_sessions.pid),
         updated_at = NOW(),
         ended_at = NULL
       RETURNING *`,
      [session.id, session.env, session.task ?? '(starting)', session.pid ?? null],
    );
    // RETURNING * always produces a row for INSERT ... ON CONFLICT DO UPDATE
    return result.rows[0] as AgentSession;
  }

  /** Update a session's task and/or files. */
  async updateSession(
    id: string,
    updates: { task?: string; files?: string },
  ): Promise<AgentSession | null> {
    const db = this.getDb();
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (updates.task !== undefined) {
      sets.push(`task = $${paramIdx++}`);
      params.push(updates.task);
    }
    if (updates.files !== undefined) {
      sets.push(`files = $${paramIdx++}`);
      params.push(updates.files);
    }
    params.push(id);

    const result = await db.query<AgentSession>(
      `UPDATE agent_sessions SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params,
    );
    return result.rows[0] ?? null;
  }

  /** End a session (mark ended_at, record exit summary). */
  async endSession(id: string, exitSummary?: string): Promise<void> {
    const db = this.getDb();
    await db.query(
      `UPDATE agent_sessions SET ended_at = NOW(), exit_summary = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, exitSummary ?? null],
    );
  }

  /** Get all active sessions (ended_at IS NULL). */
  async getActiveSessions(): Promise<AgentSession[]> {
    const db = this.getDb();
    const result = await db.query<AgentSession>(
      'SELECT * FROM agent_sessions WHERE ended_at IS NULL ORDER BY started_at',
    );
    return result.rows;
  }

  /** Get session history for an agent (most recent first). */
  async getSessionHistory(agentId: string, limit: number): Promise<AgentSession[]> {
    const db = this.getDb();
    const result = await db.query<AgentSession>(
      'SELECT * FROM agent_sessions WHERE id = $1 ORDER BY started_at DESC LIMIT $2',
      [agentId, limit],
    );
    return result.rows;
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  /** Send a message from one agent to another. */
  async sendMessage(msg: {
    fromAgent: string;
    toAgent: string;
    subject: string;
    body?: string;
  }): Promise<AgentMessage> {
    const db = this.getDb();
    const result = await db.query<AgentMessage>(
      `INSERT INTO agent_messages (from_agent, to_agent, subject, body)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [msg.fromAgent, msg.toAgent, msg.subject, msg.body ?? ''],
    );
    // RETURNING * always produces a row for a plain INSERT
    return result.rows[0] as AgentMessage;
  }

  /** Broadcast a message to all active agents (except sender). */
  async broadcastMessage(msg: {
    fromAgent: string;
    subject: string;
    body?: string;
  }): Promise<number> {
    const active = await this.getActiveSessions();
    let sent = 0;
    for (const session of active) {
      if (session.id === msg.fromAgent) continue;
      await this.sendMessage({
        fromAgent: msg.fromAgent,
        toAgent: session.id,
        subject: msg.subject,
        body: msg.body,
      });
      sent++;
    }
    return sent;
  }

  /** Get unread messages for an agent. */
  async getInbox(agentId: string, unreadOnly: boolean): Promise<AgentMessage[]> {
    const db = this.getDb();
    const whereClause = unreadOnly ? 'WHERE to_agent = $1 AND read = FALSE' : 'WHERE to_agent = $1';
    const result = await db.query<AgentMessage>(
      `SELECT * FROM agent_messages ${whereClause} ORDER BY created_at DESC LIMIT 50`,
      [agentId],
    );
    return result.rows;
  }

  /** Mark messages as read. */
  async markRead(messageIds: number[]): Promise<void> {
    if (messageIds.length === 0) return;
    const db = this.getDb();
    const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(', ');
    await db.query(
      `UPDATE agent_messages SET read = TRUE WHERE id IN (${placeholders})`,
      messageIds,
    );
  }

  // ---------------------------------------------------------------------------
  // File Reservations
  // ---------------------------------------------------------------------------

  /** Reserve a file for an agent (CAS: fails if already reserved by another). */
  async reserveFile(reservation: {
    filePath: string;
    agentId: string;
    ttlSeconds: number;
    reason?: string;
  }): Promise<{ success: boolean; holder?: string }> {
    const db = this.getDb();

    // Clean expired reservations first
    await db.query('DELETE FROM file_reservations WHERE expires_at < NOW()');

    // Try to insert (CAS semantics via ON CONFLICT)
    const result = await db.query<FileReservation>(
      `INSERT INTO file_reservations (file_path, agent_id, expires_at, reason)
       VALUES ($1, $2, NOW() + ($3 || ' seconds')::INTERVAL, $4)
       ON CONFLICT (file_path) DO UPDATE SET
         agent_id = EXCLUDED.agent_id,
         reserved_at = NOW(),
         expires_at = EXCLUDED.expires_at,
         reason = EXCLUDED.reason
       WHERE file_reservations.agent_id = $2 OR file_reservations.expires_at < NOW()
       RETURNING *`,
      [
        reservation.filePath,
        reservation.agentId,
        String(reservation.ttlSeconds),
        reservation.reason ?? '',
      ],
    );

    if (result.rows.length > 0) {
      return { success: true };
    }

    // Someone else holds it  -  who?
    const existing = await db.query<FileReservation>(
      'SELECT agent_id FROM file_reservations WHERE file_path = $1',
      [reservation.filePath],
    );
    return { success: false, holder: existing.rows[0]?.agent_id };
  }

  /** Check who holds a file reservation. */
  async checkReservation(filePath: string): Promise<FileReservation | null> {
    const db = this.getDb();
    // Clean expired first
    await db.query('DELETE FROM file_reservations WHERE expires_at < NOW()');
    const result = await db.query<FileReservation>(
      'SELECT * FROM file_reservations WHERE file_path = $1',
      [filePath],
    );
    return result.rows[0] ?? null;
  }

  /** Release all reservations held by an agent. */
  async releaseAllReservations(agentId: string): Promise<number> {
    const db = this.getDb();
    const result = await db.query('DELETE FROM file_reservations WHERE agent_id = $1', [agentId]);
    return result.affectedRows ?? 0;
  }

  /** Get all reservations for an agent. */
  async getReservations(agentId: string): Promise<FileReservation[]> {
    const db = this.getDb();
    await db.query('DELETE FROM file_reservations WHERE expires_at < NOW()');
    const result = await db.query<FileReservation>(
      'SELECT * FROM file_reservations WHERE agent_id = $1 ORDER BY reserved_at',
      [agentId],
    );
    return result.rows;
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  /** Create a new task. */
  async createTask(task: { id: string; description: string }): Promise<AgentTask> {
    const db = this.getDb();
    const result = await db.query<AgentTask>(
      `INSERT INTO tasks (id, description) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description
       RETURNING *`,
      [task.id, task.description],
    );
    return result.rows[0] as AgentTask;
  }

  /** Claim a task atomically (CAS: fails if already claimed by another agent). */
  async claimTask(taskId: string, agentId: string): Promise<{ success: boolean; owner?: string }> {
    const db = this.getDb();
    // Atomic: only claim if status is 'open' OR already owned by the same agent
    const result = await db.query<AgentTask>(
      `UPDATE tasks SET status = 'claimed', owner = $2, claimed_at = NOW()
       WHERE id = $1 AND (status = 'open' OR owner = $2)
       RETURNING *`,
      [taskId, agentId],
    );
    if (result.rows.length > 0) {
      return { success: true };
    }
    // Someone else owns it  -  who?
    const existing = await db.query<AgentTask>('SELECT owner FROM tasks WHERE id = $1', [taskId]);
    if (existing.rows.length === 0) {
      return { success: false, owner: undefined };
    }
    return { success: false, owner: (existing.rows[0] as AgentTask).owner ?? undefined };
  }

  /** Complete a task (only the owner can complete it). */
  async completeTask(taskId: string, agentId: string): Promise<boolean> {
    const db = this.getDb();
    const result = await db.query(
      `UPDATE tasks SET status = 'completed', completed_at = NOW()
       WHERE id = $1 AND owner = $2
       RETURNING id`,
      [taskId, agentId],
    );
    return (result.rows?.length ?? 0) > 0;
  }

  /** Release a claimed task back to open (only the owner can release). */
  async releaseTask(taskId: string, agentId: string): Promise<boolean> {
    const db = this.getDb();
    const result = await db.query(
      `UPDATE tasks SET status = 'open', owner = NULL, claimed_at = NULL
       WHERE id = $1 AND owner = $2
       RETURNING id`,
      [taskId, agentId],
    );
    return (result.rows?.length ?? 0) > 0;
  }

  /** List tasks, optionally filtered by status and/or owner. */
  async listTasks(filter?: { status?: string; owner?: string }): Promise<AgentTask[]> {
    const db = this.getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter?.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(filter.status);
    }
    if (filter?.owner) {
      conditions.push(`owner = $${paramIdx++}`);
      params.push(filter.owner);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query<AgentTask>(
      `SELECT * FROM tasks ${where} ORDER BY created_at`,
      params,
    );
    return result.rows;
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /** Append an event to the audit log. */
  async logEvent(event: {
    agentId: string;
    eventType: string;
    payload?: Record<string, unknown>;
  }): Promise<DaemonEvent> {
    const db = this.getDb();
    const result = await db.query<DaemonEvent>(
      `INSERT INTO events (agent_id, event_type, payload)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [event.agentId, event.eventType, JSON.stringify(event.payload ?? {})],
    );
    // RETURNING * always produces a row for a plain INSERT
    return result.rows[0] as DaemonEvent;
  }

  /** Get recent events (newest first). */
  async getRecentEvents(limit: number): Promise<DaemonEvent[]> {
    const db = this.getDb();
    const result = await db.query<DaemonEvent>(
      'SELECT * FROM events ORDER BY created_at DESC LIMIT $1',
      [limit],
    );
    return result.rows;
  }

  /** Prune events older than a given number of days. */
  async pruneEvents(olderThanDays: number): Promise<number> {
    const db = this.getDb();
    const result = await db.query(
      `DELETE FROM events WHERE created_at < NOW() - ($1 || ' days')::INTERVAL`,
      [String(olderThanDays)],
    );
    return result.affectedRows ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Worktrees
  // ---------------------------------------------------------------------------

  /** Register a worktree for an agent. */
  async registerWorktree(wt: {
    agentId: string;
    branch: string;
    worktreePath: string;
    baseBranch?: string;
  }): Promise<AgentWorktree> {
    const db = this.getDb();
    const result = await db.query<AgentWorktree>(
      `INSERT INTO worktrees (agent_id, branch, worktree_path, base_branch)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (agent_id) DO UPDATE SET
         branch = EXCLUDED.branch,
         worktree_path = EXCLUDED.worktree_path,
         base_branch = EXCLUDED.base_branch,
         status = 'active'
       RETURNING *`,
      [wt.agentId, wt.branch, wt.worktreePath, wt.baseBranch ?? 'test'],
    );
    return result.rows[0] as AgentWorktree;
  }

  /** Get a worktree by agent ID. */
  async getWorktree(agentId: string): Promise<AgentWorktree | null> {
    const db = this.getDb();
    const result = await db.query<AgentWorktree>('SELECT * FROM worktrees WHERE agent_id = $1', [
      agentId,
    ]);
    return result.rows[0] ?? null;
  }

  /** List all active worktrees. */
  async getActiveWorktrees(): Promise<AgentWorktree[]> {
    const db = this.getDb();
    const result = await db.query<AgentWorktree>(
      "SELECT * FROM worktrees WHERE status = 'active' ORDER BY created_at",
    );
    return result.rows;
  }

  /** Update worktree status (active → merged | abandoned). */
  async updateWorktreeStatus(agentId: string, status: 'merged' | 'abandoned'): Promise<boolean> {
    const db = this.getDb();
    const result = await db.query(
      'UPDATE worktrees SET status = $2 WHERE agent_id = $1 RETURNING agent_id',
      [agentId, status],
    );
    return (result.rows?.length ?? 0) > 0;
  }

  /** Remove a worktree record. */
  async removeWorktree(agentId: string): Promise<boolean> {
    const db = this.getDb();
    const result = await db.query('DELETE FROM worktrees WHERE agent_id = $1 RETURNING agent_id', [
      agentId,
    ]);
    return (result.rows?.length ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // Agent Memory
  // ---------------------------------------------------------------------------

  /** Store a memory entry. */
  async storeMemory(entry: {
    agentId: string;
    memoryType: AgentMemoryEntry['memory_type'];
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<AgentMemoryEntry> {
    const db = this.getDb();
    const result = await db.query<AgentMemoryEntry>(
      `INSERT INTO agent_memory (agent_id, memory_type, content, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [entry.agentId, entry.memoryType, entry.content, JSON.stringify(entry.metadata ?? {})],
    );
    return result.rows[0] as AgentMemoryEntry;
  }

  /** Recall memory entries by agent and type (newest first). */
  async recallMemory(query: {
    agentId?: string;
    memoryType?: AgentMemoryEntry['memory_type'];
    keyword?: string;
    limit?: number;
  }): Promise<AgentMemoryEntry[]> {
    const db = this.getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (query.agentId) {
      conditions.push(`agent_id = $${paramIdx++}`);
      params.push(query.agentId);
    }
    if (query.memoryType) {
      conditions.push(`memory_type = $${paramIdx++}`);
      params.push(query.memoryType);
    }
    if (query.keyword) {
      conditions.push(`content ILIKE $${paramIdx++}`);
      params.push(`%${query.keyword}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit ?? 20;
    params.push(limit);

    const result = await db.query<AgentMemoryEntry>(
      `SELECT * FROM agent_memory ${where} ORDER BY created_at DESC LIMIT $${paramIdx}`,
      params,
    );
    return result.rows;
  }

  /** Get a summary of recent memory (last N per type for context injection). */
  async summarizeMemory(agentId: string, perType: number): Promise<AgentMemoryEntry[]> {
    const db = this.getDb();
    // Use a window function to get the last N entries per memory_type
    const result = await db.query<AgentMemoryEntry>(
      `SELECT * FROM (
         SELECT *, ROW_NUMBER() OVER (PARTITION BY memory_type ORDER BY created_at DESC) AS rn
         FROM agent_memory WHERE agent_id = $1
       ) sub WHERE rn <= $2
       ORDER BY memory_type, created_at DESC`,
      [agentId, perType],
    );
    return result.rows;
  }

  /** Prune old memory entries (keep last N per agent). */
  async pruneMemory(keepPerAgent: number): Promise<number> {
    const db = this.getDb();
    const result = await db.query(
      `DELETE FROM agent_memory WHERE id IN (
         SELECT id FROM (
           SELECT id, ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY created_at DESC) AS rn
           FROM agent_memory
         ) sub WHERE rn > $1
       )`,
      [keepPerAgent],
    );
    return result.affectedRows ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Merge Requests
  // ---------------------------------------------------------------------------

  /** Create a merge request for an agent's branch. */
  async createMergeRequest(mr: {
    id: string;
    agentId: string;
    taskId?: string;
    sourceBranch: string;
    baseBranch?: string;
  }): Promise<MergeRequest> {
    const db = this.getDb();
    const result = await db.query<MergeRequest>(
      `INSERT INTO merge_requests (id, agent_id, task_id, source_branch, base_branch)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         status = 'pending',
         retry_count = merge_requests.retry_count,
         updated_at = NOW()
       RETURNING *`,
      [mr.id, mr.agentId, mr.taskId ?? null, mr.sourceBranch, mr.baseBranch ?? 'test'],
    );
    return result.rows[0] as MergeRequest;
  }

  /** Get a merge request by ID. */
  async getMergeRequest(id: string): Promise<MergeRequest | null> {
    const db = this.getDb();
    const result = await db.query<MergeRequest>('SELECT * FROM merge_requests WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  /** Get a merge request by source branch. */
  async getMergeRequestByBranch(branch: string): Promise<MergeRequest | null> {
    const db = this.getDb();
    const result = await db.query<MergeRequest>(
      "SELECT * FROM merge_requests WHERE source_branch = $1 AND status NOT IN ('merged', 'escalated') ORDER BY created_at DESC LIMIT 1",
      [branch],
    );
    return result.rows[0] ?? null;
  }

  /** Get a merge request by PR number. */
  async getMergeRequestByPr(prNumber: number): Promise<MergeRequest | null> {
    const db = this.getDb();
    const result = await db.query<MergeRequest>(
      'SELECT * FROM merge_requests WHERE pr_number = $1 ORDER BY created_at DESC LIMIT 1',
      [prNumber],
    );
    return result.rows[0] ?? null;
  }

  /** Update a merge request's fields. */
  async updateMergeRequest(
    id: string,
    updates: {
      status?: MergeRequest['status'];
      prNumber?: number;
      prUrl?: string;
      errorMessage?: string;
      ciOutput?: string;
    },
  ): Promise<MergeRequest | null> {
    const db = this.getDb();
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (updates.status !== undefined) {
      sets.push(`status = $${paramIdx++}`);
      params.push(updates.status);
    }
    if (updates.prNumber !== undefined) {
      sets.push(`pr_number = $${paramIdx++}`);
      params.push(updates.prNumber);
    }
    if (updates.prUrl !== undefined) {
      sets.push(`pr_url = $${paramIdx++}`);
      params.push(updates.prUrl);
    }
    if (updates.errorMessage !== undefined) {
      sets.push(`error_message = $${paramIdx++}`);
      params.push(updates.errorMessage);
    }
    if (updates.ciOutput !== undefined) {
      sets.push(`ci_output = $${paramIdx++}`);
      params.push(updates.ciOutput);
    }

    params.push(id);
    const result = await db.query<MergeRequest>(
      `UPDATE merge_requests SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params,
    );
    return result.rows[0] ?? null;
  }

  /** Increment the retry count for a merge request. */
  async incrementMergeRetry(id: string): Promise<number> {
    const db = this.getDb();
    const result = await db.query<{ retry_count: number }>(
      `UPDATE merge_requests SET retry_count = retry_count + 1, updated_at = NOW()
       WHERE id = $1 RETURNING retry_count`,
      [id],
    );
    return result.rows[0]?.retry_count ?? 0;
  }

  /** List merge requests, optionally filtered by status and/or agent. */
  async listMergeRequests(filter?: { status?: string; agentId?: string }): Promise<MergeRequest[]> {
    const db = this.getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filter?.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(filter.status);
    }
    if (filter?.agentId) {
      conditions.push(`agent_id = $${paramIdx++}`);
      params.push(filter.agentId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query<MergeRequest>(
      `SELECT * FROM merge_requests ${where} ORDER BY created_at DESC`,
      params,
    );
    return result.rows;
  }
}
