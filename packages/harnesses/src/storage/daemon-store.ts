/**
 * DaemonStore — persistent state for the RevDev Harness daemon.
 *
 * Backed by PGlite (in-process PostgreSQL). The database file lives at
 * ~/.local/share/revealui/harness.db and survives daemon restarts.
 *
 * All methods are async (PGlite queries return promises).
 */

import type { PGlite } from '@electric-sql/pglite';
import type {
  AgentMessage,
  AgentSession,
  AgentTask,
  DaemonEvent,
  FileReservation,
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
    if (!this.db) throw new Error('DaemonStore not initialized — call init() first');
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

    // Someone else holds it — who?
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
    // Someone else owns it — who?
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
}
