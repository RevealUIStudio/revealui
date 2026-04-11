/**
 * WorkboardProtocol  -  types for the multi-agent coordination workboard (v2).
 *
 * The workboard (.claude/workboard.md) is the shared coordination primitive
 * that lets multiple AI coding agents work safely in parallel.
 *
 * v2 adds a task board with claiming protocol:
 *   Agents   -  who's running (hook-managed)
 *   Tasks    -  what needs doing (agent-managed, claimable)
 *   Blocked  -  waiting on external action
 *   Done     -  recently completed
 *   Log      -  audit trail
 *
 * Status values: available | claimed | partial | blocked | done
 * Priority values: P0 | P1 | P2 | P3
 */

/** Valid task statuses. */
export type TaskStatus = 'available' | 'claimed' | 'partial' | 'blocked' | 'done';

/** Valid task priorities. */
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';

/** A row in the ## Agents table (managed by hooks). */
export interface WorkboardAgent {
  /** Unique agent identifier, e.g. "agent-edit", "agent-system", "wsl-root" */
  id: string;
  /** Human-readable environment description */
  env: string;
  /** ISO timestamp of when the session registered */
  started: string;
  /** Current task description */
  task: string;
  /** Comma-separated list of file globs this agent is actively modifying */
  files: string;
  /** ISO timestamp of last workboard update */
  updated: string;
}

/** A row in the ## Tasks table (managed by agents). */
export interface WorkboardTask {
  /** Task identifier, e.g. "T-001" */
  id: string;
  /** Short task description */
  task: string;
  /** Priority: P0 (drop everything), P1 (must do), P2 (should do), P3 (nice to have) */
  pri: TaskPriority;
  /** Current status */
  status: TaskStatus;
  /** Agent id that owns this task (empty if available) */
  owner: string;
  /** GitHub issue or PR number, e.g. "#88", "PR #110" */
  gh: string;
  /** ISO date of last update */
  updated: string;
  /** Free-form notes about progress or remaining work */
  notes: string;
}

/** A row in the ## Blocked table. */
export interface WorkboardBlockedTask {
  /** Task identifier */
  id: string;
  /** Short task description */
  task: string;
  /** What's blocking this task */
  blocker: string;
  /** GitHub issue or PR number */
  gh: string;
  /** Additional notes */
  notes: string;
}

/** A row in the ## Done table. */
export interface WorkboardDoneTask {
  /** Task identifier */
  id: string;
  /** Short task description */
  task: string;
  /** Agent that completed the task */
  owner: string;
  /** ISO date of completion */
  completed: string;
  /** GitHub issue or PR number */
  gh: string;
  /** Additional notes */
  notes: string;
}

/** Full parsed workboard state (v2). */
export interface WorkboardState {
  /** Lines before the first ## section (title, protocol docs) */
  preamble: string[];
  /** Active agent sessions */
  agents: WorkboardAgent[];
  /** Task board  -  claimable work items */
  tasks: WorkboardTask[];
  /** Blocked tasks  -  waiting on external action */
  blocked: WorkboardBlockedTask[];
  /** Recently completed tasks */
  done: WorkboardDoneTask[];
  /** Timestamped log entries (raw markdown list items) */
  log: string[];
  /** Unknown sections preserved as raw markdown, keyed by section title */
  _extra: Record<string, string>;
}

/** Result of a conflict detection check. */
export interface ConflictResult {
  /** True if no conflicting file reservations were found */
  clean: boolean;
  /** Sessions with overlapping file claims */
  conflicts: Array<{
    thisSession: string;
    otherSession: string;
    overlappingFiles: string[];
  }>;
}

// ---------------------------------------------------------------------------
// Backward compat  -  re-export old names as aliases
// ---------------------------------------------------------------------------

/** @deprecated Use WorkboardAgent instead */
export type WorkboardSession = WorkboardAgent;

/** @deprecated Use WorkboardState.log entries instead */
export interface WorkboardEntry {
  timestamp: string;
  sessionId: string;
  description: string;
}
