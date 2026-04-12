'use client';

import { useShape } from '@electric-sql/react';
import { useEffect, useRef } from 'react';
import { fetchWithTimeout } from '../fetch-with-timeout.js';

/**
 * Invalidation action triggered when shape data changes.
 * Maps to CacheInvalidationChannel event types.
 */
export type InvalidationAction =
  | { type: 'delete'; keys: string[] }
  | { type: 'delete-prefix'; prefix: string }
  | { type: 'delete-tags'; tags: string[] }
  | { type: 'clear' };

interface UseShapeCacheInvalidationOptions {
  /** ElectricSQL shape subscription URL to watch. */
  shapeUrl: string;
  /**
   * Determine which cache entries to invalidate when shape data changes.
   * Receives the new data from the shape subscription and returns one or
   * more invalidation actions.
   */
  getInvalidations: (data: unknown[]) => InvalidationAction[];
  /**
   * Callback to execute the invalidation actions. Typically this calls
   * methods on a CacheStore or CacheInvalidationChannel instance.
   */
  onInvalidate: (actions: InvalidationAction[]) => Promise<void>;
  /** Whether invalidation is enabled (default: true). */
  enabled?: boolean;
}

/**
 * Subscribe to an ElectricSQL shape and trigger cache invalidation
 * when the shape data changes.
 *
 * This hook bridges ElectricSQL's real-time sync with the cache
 * invalidation system, enabling push-based cache busting without polling.
 *
 * Example:
 *   useShapeCacheInvalidation({
 *     shapeUrl: `${ELECTRIC_URL}/v1/shape?table=posts`,
 *     getInvalidations: (data) => [
 *       { type: 'delete-tags', tags: ['posts'] },
 *     ],
 *     onInvalidate: async (actions) => {
 *       for (const action of actions) {
 *         if (action.type === 'delete-tags') {
 *           await channel.publishDeleteTags(action.tags);
 *         }
 *       }
 *     },
 *   });
 */
export function useShapeCacheInvalidation(options: UseShapeCacheInvalidationOptions): void {
  const { shapeUrl, getInvalidations, onInvalidate, enabled = true } = options;

  const shape = useShape({ url: shapeUrl, fetchClient: fetchWithTimeout });

  const prevDataRef = useRef<unknown[] | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const shapeData = shape.data;

  useEffect(() => {
    if (!enabled) return;
    if (shape.isLoading) return;
    if (!Array.isArray(shapeData)) return;

    // Skip the initial load (no previous data to compare against)
    if (prevDataRef.current === null) {
      prevDataRef.current = shapeData;
      return;
    }

    // Skip if data reference hasn't changed
    if (prevDataRef.current === shapeData) return;
    prevDataRef.current = shapeData;

    const actions = getInvalidations(shapeData);
    if (actions.length === 0) return;

    if (mounted.current) {
      onInvalidate(actions).catch(() => {
        // Invalidation is best-effort; stale cache entries will expire via TTL
      });
    }
  }, [shapeData, shape.isLoading, enabled, getInvalidations, onInvalidate]);
}
