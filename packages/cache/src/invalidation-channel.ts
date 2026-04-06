/**
 * Cache Invalidation Channel
 *
 * Coordinates cache invalidation across instances using a shared database table.
 * Events are written to `_cache_invalidation_events` and consumed by polling.
 *
 * Architecture:
 *   - Publisher: writes invalidation event to shared PGlite/PostgreSQL table
 *   - Subscriber: polls the table for new events and forwards to local CacheStore
 *   - Events auto-expire after TTL to prevent unbounded table growth
 *
 * Future: Replace polling with ElectricSQL shape subscriptions or LISTEN/NOTIFY
 * for real-time push-based invalidation (Phase 5.10C/E).
 */

import type { CacheStore } from './adapters/types.js';
import { getCacheLogger } from './logger.js';

// =============================================================================
// Types
// =============================================================================

export type InvalidationEventType = 'delete' | 'delete-prefix' | 'delete-tags' | 'clear';

export interface InvalidationEvent {
  id: string;
  type: InvalidationEventType;
  /** Cache keys to delete (for 'delete' type). */
  keys?: string[];
  /** Prefix to match (for 'delete-prefix' type). */
  prefix?: string;
  /** Tags to match (for 'delete-tags' type). */
  tags?: string[];
  /** Instance ID that published the event (for deduplication). */
  sourceInstance: string;
  /** Timestamp when the event was created. */
  createdAt: number;
}

export interface InvalidationChannelOptions {
  /** Unique instance identifier (used to skip self-published events). */
  instanceId: string;
  /** Poll interval in milliseconds (default: 5000). */
  pollIntervalMs?: number;
  /** Event TTL in seconds — events older than this are pruned (default: 60). */
  eventTtlSeconds?: number;
}

// =============================================================================
// PGlite interface
// =============================================================================

interface PGliteInstance {
  exec(query: string): Promise<unknown>;
  query<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
}

const CREATE_EVENTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _cache_invalidation_events (
    id               TEXT PRIMARY KEY,
    type             TEXT NOT NULL,
    keys             TEXT[],
    prefix           TEXT,
    tags             TEXT[],
    source_instance  TEXT NOT NULL,
    created_at       BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS _cache_inv_created_idx ON _cache_invalidation_events (created_at);
`;

// =============================================================================
// Invalidation Channel
// =============================================================================

export class CacheInvalidationChannel {
  private db: PGliteInstance;
  private store: CacheStore;
  private instanceId: string;
  private pollIntervalMs: number;
  private eventTtlSeconds: number;
  private lastSeenTimestamp: number;
  /** IDs processed at exactly lastSeenTimestamp (prevents re-processing on >= query). */
  private processedAtBoundary: Set<string> = new Set();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private ready: Promise<void>;

  constructor(db: PGliteInstance, store: CacheStore, options: InvalidationChannelOptions) {
    this.db = db;
    this.store = store;
    this.instanceId = options.instanceId;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    this.eventTtlSeconds = options.eventTtlSeconds ?? 60;
    this.lastSeenTimestamp = Date.now() - 1;
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    await this.db.exec(CREATE_EVENTS_TABLE_SQL);
  }

  /** Start polling for invalidation events. */
  async start(): Promise<void> {
    await this.ready;
    if (this.pollTimer) return;

    this.pollTimer = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
    if (this.pollTimer.unref) this.pollTimer.unref();
  }

  /** Stop polling. */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ─── Publishing ─────────────────────────────────────────────────────

  /** Publish a key deletion event. */
  async publishDelete(...keys: string[]): Promise<void> {
    await this.publish({ type: 'delete', keys });
  }

  /** Publish a prefix deletion event. */
  async publishDeletePrefix(prefix: string): Promise<void> {
    await this.publish({ type: 'delete-prefix', prefix });
  }

  /** Publish a tag-based deletion event. */
  async publishDeleteTags(tags: string[]): Promise<void> {
    await this.publish({ type: 'delete-tags', tags });
  }

  /** Publish a clear-all event. */
  async publishClear(): Promise<void> {
    await this.publish({ type: 'clear' });
  }

  private async publish(
    event: Pick<InvalidationEvent, 'type' | 'keys' | 'prefix' | 'tags'>,
  ): Promise<void> {
    await this.ready;
    const id = crypto.randomUUID();
    const now = Date.now();

    await this.db.query(
      `INSERT INTO _cache_invalidation_events (id, type, keys, prefix, tags, source_instance, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        event.type,
        event.keys ?? null,
        event.prefix ?? null,
        event.tags ?? null,
        this.instanceId,
        now,
      ],
    );
  }

  // ─── Polling ────────────────────────────────────────────────────────

  /** Poll for new events and apply them to the local cache store. */
  async poll(): Promise<number> {
    await this.ready;
    const logger = getCacheLogger();

    // Use >= to avoid missing events with the same millisecond timestamp.
    // Deduplication via processedAtBoundary prevents re-processing.
    const result = await this.db.query<{
      id: string;
      type: string;
      keys: string[] | null;
      prefix: string | null;
      tags: string[] | null;
      source_instance: string;
      created_at: string;
    }>(
      `SELECT id, type, keys, prefix, tags, source_instance, created_at
       FROM _cache_invalidation_events
       WHERE created_at >= $1 AND source_instance != $2
       ORDER BY created_at ASC`,
      [this.lastSeenTimestamp, this.instanceId],
    );

    let applied = 0;

    for (const row of result.rows) {
      // Skip events we already processed at the boundary timestamp
      if (this.processedAtBoundary.has(row.id)) continue;

      const createdAt = Number(row.created_at);
      if (createdAt > this.lastSeenTimestamp) {
        // Timestamp advanced — clear the old boundary set
        this.lastSeenTimestamp = createdAt;
        this.processedAtBoundary.clear();
      }
      this.processedAtBoundary.add(row.id);

      try {
        await this.applyEvent(row.type as InvalidationEventType, row);
        applied++;
      } catch (error) {
        logger.error(
          'Failed to apply invalidation event',
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }

    // Prune old events
    await this.prune();

    return applied;
  }

  private async applyEvent(
    type: InvalidationEventType,
    row: { keys: string[] | null; prefix: string | null; tags: string[] | null },
  ): Promise<void> {
    switch (type) {
      case 'delete':
        if (row.keys && row.keys.length > 0) {
          await this.store.delete(...row.keys);
        }
        break;
      case 'delete-prefix':
        if (row.prefix) {
          await this.store.deleteByPrefix(row.prefix);
        }
        break;
      case 'delete-tags':
        if (row.tags && row.tags.length > 0) {
          await this.store.deleteByTags(row.tags);
        }
        break;
      case 'clear':
        await this.store.clear();
        break;
    }
  }

  /** Remove events older than the TTL. */
  private async prune(): Promise<number> {
    const cutoff = Date.now() - this.eventTtlSeconds * 1000;
    const result = await this.db.query<{ count: string }>(
      `WITH deleted AS (DELETE FROM _cache_invalidation_events WHERE created_at < $1 RETURNING 1)
       SELECT count(*)::text AS count FROM deleted`,
      [cutoff],
    );
    return Number.parseInt(result.rows[0]?.count ?? '0', 10);
  }

  /** Release resources. */
  async close(): Promise<void> {
    this.stop();
  }
}
