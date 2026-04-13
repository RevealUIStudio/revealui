/**
 * Conflict Resolution for Offline Edits
 *
 * Provides version-based conflict detection and configurable resolution
 * strategies for mutations queued while offline.
 *
 * Architecture:
 *   - Each mutation carries a `baseVersion` (the version of the resource
 *     at the time the edit was made offline).
 *   - On replay, the server may respond with 409 Conflict if the resource
 *     has been modified since `baseVersion`.
 *   - The resolution strategy determines how to handle the conflict:
 *     last-write-wins, server-wins, or manual merge.
 */

// ─── Types ───────���───────────────────────────────────────────────────────────

export type ConflictStrategy = 'last-write-wins' | 'server-wins' | 'manual';

export interface OfflineMutation {
  /** Unique mutation identifier. */
  id: string;
  /** API endpoint URL. */
  url: string;
  /** HTTP method. */
  method: string;
  /** Request headers (serialized). */
  headers: Record<string, string>;
  /** Request body (serialized JSON string). */
  body: string | null;
  /** Timestamp when the mutation was created offline. */
  timestamp: number;
  /** Version of the resource when the edit was made (for conflict detection). */
  baseVersion?: number;
  /** Resource identifier (e.g. "posts:123") for grouping related mutations. */
  resourceId?: string;
  /** Number of replay attempts. */
  retryCount: number;
}

export interface ConflictInfo {
  /** The mutation that caused the conflict. */
  mutation: OfflineMutation;
  /** HTTP status code from the server (typically 409). */
  statusCode: number;
  /** Server's current version of the resource. */
  serverVersion?: number;
  /** Server's current resource data (if provided in the 409 response). */
  serverData?: unknown;
}

export interface ReplayResult {
  /** Mutations that were successfully replayed. */
  succeeded: OfflineMutation[];
  /** Mutations that hit a conflict. */
  conflicts: ConflictInfo[];
  /** Mutations that failed for non-conflict reasons (network, 5xx). */
  failed: OfflineMutation[];
}

// ─── Resolution ──────────────────────────────────────────────────────────────

/**
 * Apply the configured conflict resolution strategy.
 *
 * - `last-write-wins`: Retry the mutation with a force flag, overwriting the server version.
 * - `server-wins`: Discard the offline mutation, keeping the server state.
 * - `manual`: Return the conflict for UI-level resolution (e.g. a merge dialog).
 */
export async function resolveConflict(
  conflict: ConflictInfo,
  strategy: ConflictStrategy,
): Promise<{ resolved: boolean; retryMutation?: OfflineMutation }> {
  switch (strategy) {
    case 'last-write-wins': {
      // Retry with force header to tell the server to accept regardless of version
      const retryMutation: OfflineMutation = {
        ...conflict.mutation,
        headers: {
          ...conflict.mutation.headers,
          'X-Force-Overwrite': 'true',
          'X-Base-Version': String(conflict.serverVersion ?? 0),
        },
        retryCount: conflict.mutation.retryCount + 1,
      };
      return { resolved: true, retryMutation };
    }

    case 'server-wins':
      // Discard the offline mutation
      return { resolved: true };

    case 'manual':
      // Return unresolved for UI handling
      return { resolved: false };
  }
}

// ─── Replay Engine ─────────��─────────────────────────────────────────────────

/**
 * Replay a batch of offline mutations in FIFO order.
 *
 * Mutations targeting the same resource are coalesced: only the most recent
 * mutation per resource is replayed, reducing unnecessary round-trips.
 *
 * @param mutations - Queued mutations in chronological order.
 * @param strategy - Conflict resolution strategy.
 * @returns Replay results grouped by outcome.
 */
export async function replayMutations(
  mutations: OfflineMutation[],
  strategy: ConflictStrategy = 'last-write-wins',
): Promise<ReplayResult> {
  const result: ReplayResult = {
    succeeded: [],
    conflicts: [],
    failed: [],
  };

  // Coalesce: for each resourceId, keep only the latest mutation
  const coalesced = coalesceMutations(mutations);

  for (const mutation of coalesced) {
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: {
          ...mutation.headers,
          ...(mutation.baseVersion != null ? { 'If-Match': String(mutation.baseVersion) } : {}),
        },
        body: mutation.body || undefined,
      });

      if (response.ok) {
        result.succeeded.push(mutation);
        continue;
      }

      if (response.status === 409) {
        let serverData: unknown;
        let serverVersion: number | undefined;
        try {
          const body = await response.json();
          serverData = body.data;
          serverVersion = body.version;
        } catch {
          // 409 without JSON body
        }

        const conflict: ConflictInfo = {
          mutation,
          statusCode: 409,
          serverVersion,
          serverData,
        };

        const resolution = await resolveConflict(conflict, strategy);
        if (resolution.resolved && resolution.retryMutation) {
          // Retry the mutation with force overwrite
          try {
            const retryResponse = await fetch(resolution.retryMutation.url, {
              method: resolution.retryMutation.method,
              headers: resolution.retryMutation.headers,
              body: resolution.retryMutation.body || undefined,
            });
            if (retryResponse.ok) {
              result.succeeded.push(mutation);
            } else {
              result.failed.push(mutation);
            }
          } catch {
            result.failed.push(mutation);
          }
        } else if (resolution.resolved) {
          // server-wins: mutation discarded, count as succeeded (intentionally dropped)
          result.succeeded.push(mutation);
        } else {
          // manual: surface the conflict
          result.conflicts.push(conflict);
        }
        continue;
      }

      // Server error or other non-conflict failure
      if (response.status >= 500) {
        result.failed.push(mutation);
        // Stop replaying on server errors to avoid cascading failures
        break;
      }

      // Client error (4xx other than 409): discard, not recoverable
      result.failed.push(mutation);
    } catch {
      // Network error: stop replaying
      result.failed.push(mutation);
      break;
    }
  }

  return result;
}

// ─── Coalescing ──────��───────────────────────────────────────────────────────

/**
 * Coalesce mutations targeting the same resource.
 * For each resourceId, keep only the latest mutation.
 * Mutations without a resourceId are always included.
 */
export function coalesceMutations(mutations: OfflineMutation[]): OfflineMutation[] {
  const byResource = new Map<string, OfflineMutation>();
  const ungrouped: OfflineMutation[] = [];

  for (const mutation of mutations) {
    if (mutation.resourceId) {
      const existing = byResource.get(mutation.resourceId);
      if (!existing || mutation.timestamp > existing.timestamp) {
        byResource.set(mutation.resourceId, mutation);
      }
    } else {
      ungrouped.push(mutation);
    }
  }

  // Maintain chronological order: ungrouped first, then coalesced by timestamp
  const coalesced = [...byResource.values()].sort((a, b) => a.timestamp - b.timestamp);
  return [...ungrouped, ...coalesced];
}
