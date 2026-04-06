/**
 * Rate Limit Store — Pluggable backends for rate limiter state.
 *
 * - InMemoryRateLimitStore: Map-backed, zero-dep, single-instance (default)
 * - PGliteRateLimitStore: PostgreSQL-backed via PGlite, supports per-instance
 *   persistence and can be extended with ElectricSQL for distributed sync.
 */

// =============================================================================
// Store interface
// =============================================================================

export interface WindowEntry {
  count: number;
  windowStart: number;
}

/**
 * Pluggable storage backend for rate limiter window entries.
 * Implementations must handle TTL-based expiry internally.
 */
export interface RateLimitStore {
  /** Get the current window entry for a key, or null if expired/missing. */
  get(key: string): Promise<WindowEntry | null>;

  /** Set or overwrite the window entry for a key. */
  set(key: string, entry: WindowEntry): Promise<void>;

  /** Increment the count for a key. Returns the new count. */
  increment(key: string): Promise<number>;

  /**
   * Atomically increment count only if below limit.
   * Returns the new count and whether the increment happened.
   * This prevents race conditions where concurrent requests all pass
   * a non-atomic read-check-increment sequence.
   */
  incrementIfBelow(key: string, limit: number): Promise<{ count: number; incremented: boolean }>;

  /** Remove expired entries older than the given cutoff timestamp. */
  cleanup(cutoffMs: number): Promise<number>;

  /** Clear all entries. */
  clear(): Promise<void>;

  /** Release any resources (timers, connections). */
  close(): Promise<void>;
}

// =============================================================================
// In-memory store (Map-backed, default)
// =============================================================================

export class InMemoryRateLimitStore implements RateLimitStore {
  private windows = new Map<string, WindowEntry>();

  async get(key: string): Promise<WindowEntry | null> {
    return this.windows.get(key) ?? null;
  }

  async set(key: string, entry: WindowEntry): Promise<void> {
    this.windows.set(key, entry);
  }

  async increment(key: string): Promise<number> {
    const entry = this.windows.get(key);
    if (!entry) return 0;
    entry.count++;
    return entry.count;
  }

  async incrementIfBelow(
    key: string,
    limit: number,
  ): Promise<{ count: number; incremented: boolean }> {
    const entry = this.windows.get(key);
    if (!entry) return { count: 0, incremented: false };
    if (entry.count >= limit) return { count: entry.count, incremented: false };
    entry.count++;
    return { count: entry.count, incremented: true };
  }

  async cleanup(cutoffMs: number): Promise<number> {
    let removed = 0;
    for (const [key, entry] of this.windows) {
      if (entry.windowStart < cutoffMs) {
        this.windows.delete(key);
        removed++;
      }
    }
    return removed;
  }

  async clear(): Promise<void> {
    this.windows.clear();
  }

  async close(): Promise<void> {
    this.windows.clear();
  }
}

// =============================================================================
// PGlite store (SQL-backed)
// =============================================================================

/** Minimal PGlite interface — avoids importing the full @electric-sql/pglite package. */
interface PGliteInstance {
  exec(query: string): Promise<unknown>;
  query<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

const CREATE_RATE_LIMIT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _rate_limit_windows (
    key           TEXT PRIMARY KEY,
    count         INTEGER NOT NULL DEFAULT 0,
    window_start  BIGINT NOT NULL
  );
`;

interface PGliteRateLimitStoreOptions {
  /** PGlite instance (caller owns lifecycle unless closeOnDestroy is true). */
  db: PGliteInstance;
  /** Close the PGlite instance when close() is called (default: false). */
  closeOnDestroy?: boolean;
}

export class PGliteRateLimitStore implements RateLimitStore {
  private db: PGliteInstance;
  private ready: Promise<void>;
  private closeOnDestroy: boolean;

  constructor(options: PGliteRateLimitStoreOptions) {
    this.db = options.db;
    this.closeOnDestroy = options.closeOnDestroy ?? false;
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    await this.db.exec(CREATE_RATE_LIMIT_TABLE_SQL);
  }

  async get(key: string): Promise<WindowEntry | null> {
    await this.ready;
    const result = await this.db.query<{ count: number; window_start: string }>(
      'SELECT count, window_start FROM _rate_limit_windows WHERE key = $1',
      [key],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { count: row.count, windowStart: Number(row.window_start) };
  }

  async set(key: string, entry: WindowEntry): Promise<void> {
    await this.ready;
    await this.db.query(
      `INSERT INTO _rate_limit_windows (key, count, window_start)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE
       SET count = EXCLUDED.count, window_start = EXCLUDED.window_start`,
      [key, entry.count, entry.windowStart],
    );
  }

  async increment(key: string): Promise<number> {
    await this.ready;
    const result = await this.db.query<{ count: number }>(
      `UPDATE _rate_limit_windows SET count = count + 1 WHERE key = $1 RETURNING count`,
      [key],
    );
    const row = result.rows[0];
    return row?.count ?? 0;
  }

  async incrementIfBelow(
    key: string,
    limit: number,
  ): Promise<{ count: number; incremented: boolean }> {
    await this.ready;
    const result = await this.db.query<{ count: number }>(
      `UPDATE _rate_limit_windows SET count = count + 1
       WHERE key = $1 AND count < $2
       RETURNING count`,
      [key, limit],
    );
    const row = result.rows[0];
    if (row) return { count: row.count, incremented: true };
    // No rows updated — either key missing or limit reached
    const current = await this.get(key);
    return { count: current?.count ?? 0, incremented: false };
  }

  async cleanup(cutoffMs: number): Promise<number> {
    await this.ready;
    const result = await this.db.query<{ count: string }>(
      `WITH deleted AS (DELETE FROM _rate_limit_windows WHERE window_start < $1 RETURNING 1)
       SELECT count(*)::text AS count FROM deleted`,
      [cutoffMs],
    );
    return Number.parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async clear(): Promise<void> {
    await this.ready;
    await this.db.exec('DELETE FROM _rate_limit_windows');
  }

  async close(): Promise<void> {
    if (this.closeOnDestroy) {
      await this.db.close();
    }
  }
}
