/**
 * PGlite schema for the RevDev Harness daemon.
 *
 * Five tables provide persistent state for multi-agent coordination:
 *   - agent_sessions: active and historical agent sessions
 *   - agent_messages: inter-agent mailbox (point-to-point + broadcast)
 *   - file_reservations: advisory file locks with CAS semantics
 *   - tasks: claimable work items with CAS ownership
 *   - events: append-only event log for audit trail
 *
 * Uses raw SQL (no Drizzle ORM) to keep the daemon dependency-free.
 * PGlite runs in-process — no external database needed.
 */

/** SQL statements to initialize the daemon database. */
export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS agent_sessions (
    id            TEXT PRIMARY KEY,
    env           TEXT NOT NULL DEFAULT '',
    task          TEXT NOT NULL DEFAULT '(starting)',
    files         TEXT NOT NULL DEFAULT '',
    pid           INTEGER,
    started_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at      TIMESTAMP,
    exit_summary  TEXT
  );

  CREATE TABLE IF NOT EXISTS agent_messages (
    id            SERIAL PRIMARY KEY,
    from_agent    TEXT NOT NULL,
    to_agent      TEXT NOT NULL,
    subject       TEXT NOT NULL DEFAULT '',
    body          TEXT NOT NULL DEFAULT '',
    read          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_messages_to_unread
    ON agent_messages (to_agent, read) WHERE read = FALSE;

  CREATE TABLE IF NOT EXISTS file_reservations (
    file_path     TEXT PRIMARY KEY,
    agent_id      TEXT NOT NULL,
    reserved_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMP NOT NULL,
    reason        TEXT NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_reservations_agent
    ON file_reservations (agent_id);

  CREATE TABLE IF NOT EXISTS tasks (
    id            TEXT PRIMARY KEY,
    description   TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'open',
    owner         TEXT,
    claimed_at    TIMESTAMP,
    completed_at  TIMESTAMP,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status
    ON tasks (status);

  CREATE INDEX IF NOT EXISTS idx_tasks_owner
    ON tasks (owner) WHERE owner IS NOT NULL;

  CREATE TABLE IF NOT EXISTS events (
    id            SERIAL PRIMARY KEY,
    agent_id      TEXT NOT NULL,
    event_type    TEXT NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_events_agent
    ON events (agent_id, created_at DESC);
`;

/** Session row shape. */
export interface AgentSession {
  id: string;
  env: string;
  task: string;
  files: string;
  pid: number | null;
  started_at: string;
  updated_at: string;
  ended_at: string | null;
  exit_summary: string | null;
}

/** Message row shape. */
export interface AgentMessage {
  id: number;
  from_agent: string;
  to_agent: string;
  subject: string;
  body: string;
  read: boolean;
  created_at: string;
}

/** File reservation row shape. */
export interface FileReservation {
  file_path: string;
  agent_id: string;
  reserved_at: string;
  expires_at: string;
  reason: string;
}

/** Task row shape. */
export interface AgentTask {
  id: string;
  description: string;
  status: 'open' | 'claimed' | 'completed';
  owner: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/** Event row shape. */
export interface DaemonEvent {
  id: number;
  agent_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}
