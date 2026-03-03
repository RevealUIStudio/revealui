/**
 * WorkboardProtocol — types for the multi-agent coordination workboard.
 *
 * The workboard (.claude/workboard.md) is the shared coordination primitive
 * that lets multiple AI coding agents (Claude Code, Cursor, etc.) work safely
 * in parallel on the same codebase without stepping on each other.
 *
 * This module defines machine-readable types for parsing and writing the
 * workboard's markdown structure programmatically.
 */

/** A row in the ## Sessions table. */
export interface WorkboardSession {
  /** Unique session identifier, e.g. "zed-1", "terminal-2", "cursor-1" */
  id: string
  /** Human-readable environment description, e.g. "Zed/ACP", "WSL/bash" */
  env: string
  /** ISO timestamp of when the session registered */
  started: string
  /** Current task description */
  task: string
  /** Comma-separated list of file globs this session is actively modifying */
  files: string
  /** ISO timestamp of last workboard update */
  updated: string
}

/** A timestamped entry in the ## Recent section. */
export interface WorkboardEntry {
  /** ISO-derived display timestamp "[YYYY-MM-DD HH:MM]" */
  timestamp: string
  /** Session id that produced this entry */
  sessionId: string
  /** Free-form description of what was accomplished */
  description: string
}

/** Full parsed workboard state. */
export interface WorkboardState {
  sessions: WorkboardSession[]
  recent: WorkboardEntry[]
  /** Freeform markdown content of the ## Plans section */
  plans: string
  /** Freeform markdown content of the ## Context section */
  context: string
  /** Freeform markdown content of the ## Plan Reference section */
  planReference: string
}

/** Result of a conflict detection check. */
export interface ConflictResult {
  /** True if no conflicting file reservations were found */
  clean: boolean
  /** Sessions with overlapping file claims */
  conflicts: Array<{
    thisSession: string
    otherSession: string
    overlappingFiles: string[]
  }>
}
