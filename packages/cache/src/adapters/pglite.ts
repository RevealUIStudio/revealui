/**
 * PGlite Cache Store
 *
 * PostgreSQL-compatible cache store backed by PGlite (in-memory or file-based).
 * Provides the same CacheStore interface as InMemoryCacheStore but uses SQL
 * for persistence and querying  -  enabling distributed invalidation via
 * ElectricSQL shape subscriptions in Phase 5.10C.
 *
 * Table schema is auto-created on first use (no external migrations needed).
 */

import type { CacheStore } from './types.js';

/** Minimal PGlite interface  -  avoids importing the full @electric-sql/pglite package. */
interface PGliteInstance {
  exec(query: string): Promise<unknown>;
  query<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _cache_entries (
    key       TEXT PRIMARY KEY,
    value     TEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    tags      TEXT[] NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS _cache_entries_expires_idx ON _cache_entries (expires_at);
`;

interface PGliteCacheStoreOptions {
  /** PGlite instance (caller owns lifecycle unless closeOnDestroy is true). */
  db: PGliteInstance;
  /** Table name prefix to avoid collisions (default: none). */
  tablePrefix?: string;
  /** Close the PGlite instance when close() is called (default: false). */
  closeOnDestroy?: boolean;
}

export class PGliteCacheStore implements CacheStore {
  private db: PGliteInstance;
  private ready: Promise<void>;
  private closeOnDestroy: boolean;

  constructor(options: PGliteCacheStoreOptions) {
    this.db = options.db;
    this.closeOnDestroy = options.closeOnDestroy ?? false;
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    await this.db.exec(CREATE_TABLE_SQL);
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    await this.ready;
    const now = Date.now();

    const result = await this.db.query<{ value: string }>(
      'SELECT value FROM _cache_entries WHERE key = $1 AND expires_at > $2',
      [key, now],
    );

    const row = result.rows[0];
    if (!row) return null;

    return JSON.parse(row.value) as T;
  }

  async set<T = unknown>(
    key: string,
    value: T,
    ttlSeconds: number,
    tags?: string[],
  ): Promise<void> {
    await this.ready;
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const serialized = JSON.stringify(value);
    const tagArray = tags ?? [];

    await this.db.query(
      `INSERT INTO _cache_entries (key, value, expires_at, tags)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at, tags = EXCLUDED.tags`,
      [key, serialized, expiresAt, tagArray],
    );
  }

  async delete(...keys: string[]): Promise<number> {
    await this.ready;
    if (keys.length === 0) return 0;

    // Build parameterized IN clause
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const result = await this.db.query<{ count: string }>(
      `WITH deleted AS (DELETE FROM _cache_entries WHERE key IN (${placeholders}) RETURNING 1)
       SELECT count(*)::text AS count FROM deleted`,
      keys,
    );

    return Number.parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    await this.ready;
    // Escape LIKE metacharacters  -  backslash first, then % and _
    const escaped = prefix.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');

    const result = await this.db.query<{ count: string }>(
      `WITH deleted AS (DELETE FROM _cache_entries WHERE key LIKE $1 ESCAPE '\\' RETURNING 1)
       SELECT count(*)::text AS count FROM deleted`,
      [`${escaped}%`],
    );

    return Number.parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async deleteByTags(tags: string[]): Promise<number> {
    await this.ready;
    if (tags.length === 0) return 0;

    const result = await this.db.query<{ count: string }>(
      `WITH deleted AS (DELETE FROM _cache_entries WHERE tags && $1 RETURNING 1)
       SELECT count(*)::text AS count FROM deleted`,
      [tags],
    );

    return Number.parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async clear(): Promise<void> {
    await this.ready;
    await this.db.exec('DELETE FROM _cache_entries');
  }

  async size(): Promise<number> {
    await this.ready;
    const now = Date.now();
    const result = await this.db.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM _cache_entries WHERE expires_at > $1',
      [now],
    );
    return Number.parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async prune(): Promise<number> {
    await this.ready;
    const now = Date.now();
    const result = await this.db.query<{ count: string }>(
      `WITH deleted AS (DELETE FROM _cache_entries WHERE expires_at <= $1 RETURNING 1)
       SELECT count(*)::text AS count FROM deleted`,
      [now],
    );
    return Number.parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async close(): Promise<void> {
    if (this.closeOnDestroy) {
      await this.db.close();
    }
  }
}
