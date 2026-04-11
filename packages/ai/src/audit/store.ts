/**
 * Audit Store
 *
 * Append-only storage interface for audit entries.
 * No update or delete operations  -  the log is immutable.
 * Includes an in-memory implementation and a pluggable interface
 * for persistent backends (PostgreSQL, etc.).
 */

import type { AuditEntry, AuditFilter } from './types.js';

// ─── Store Interface ────────────────────────────────────────────────────────

/**
 * Append-only audit store.
 * Implementations MUST NOT provide update or delete methods.
 */
export interface AuditStore {
  /** Append a single entry to the log */
  append(entry: AuditEntry): Promise<void>;

  /** Append multiple entries atomically */
  appendBatch(entries: AuditEntry[]): Promise<void>;

  /** Query entries with filters (human-side only) */
  query(filter: AuditFilter): Promise<AuditEntry[]>;

  /** Get total entry count (optionally filtered by agent) */
  count(agentId?: string): Promise<number>;

  /** Get entries since a given timestamp */
  since(timestamp: Date, limit?: number): Promise<AuditEntry[]>;
}

// ─── In-Memory Implementation ───────────────────────────────────────────────

/**
 * In-memory audit store for development and testing.
 * Entries are stored in a simple array  -  not suitable for production.
 */
export class InMemoryAuditStore implements AuditStore {
  private entries: AuditEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 100_000) {
    this.maxEntries = maxEntries;
  }

  async append(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
    this.enforceLimit();
  }

  async appendBatch(entries: AuditEntry[]): Promise<void> {
    this.entries.push(...entries);
    this.enforceLimit();
  }

  async query(filter: AuditFilter): Promise<AuditEntry[]> {
    let results = this.entries;

    if (filter.agentId) {
      results = results.filter((e) => e.agentId === filter.agentId);
    }
    if (filter.taskId) {
      results = results.filter((e) => e.taskId === filter.taskId);
    }
    if (filter.sessionId) {
      results = results.filter((e) => e.sessionId === filter.sessionId);
    }
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      const types = new Set(filter.eventTypes);
      results = results.filter((e) => types.has(e.eventType));
    }
    if (filter.severity && filter.severity.length > 0) {
      const sevs = new Set(filter.severity);
      results = results.filter((e) => sevs.has(e.severity));
    }
    if (filter.startTime) {
      const startTime = filter.startTime;
      results = results.filter((e) => e.timestamp >= startTime);
    }
    if (filter.endTime) {
      const endTime = filter.endTime;
      results = results.filter((e) => e.timestamp <= endTime);
    }

    // Most recent first
    results = [...results].reverse();

    if (filter.offset) {
      results = results.slice(filter.offset);
    }
    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  async count(agentId?: string): Promise<number> {
    if (agentId) {
      return this.entries.filter((e) => e.agentId === agentId).length;
    }
    return this.entries.length;
  }

  async since(timestamp: Date, limit = 1000): Promise<AuditEntry[]> {
    return this.entries.filter((e) => e.timestamp >= timestamp).slice(-limit);
  }

  /** Evict oldest entries when over the limit */
  private enforceLimit(): void {
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(this.entries.length - this.maxEntries);
    }
  }
}
