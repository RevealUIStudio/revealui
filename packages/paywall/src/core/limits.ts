/**
 * Resource limit resolution.
 */

import type { LimitDefinition } from './types.js';

/**
 * Get the limit value for a resource at a given tier.
 * Returns `Infinity` if the limit or tier is not defined.
 */
export function getLimit<TTier extends string>(
  limits: Record<string, LimitDefinition<TTier>>,
  resource: string,
  tier: TTier,
): number {
  const def = limits[resource];
  if (!def) return Infinity;
  return def[tier] ?? Infinity;
}

/**
 * Check if a usage count exceeds the limit for a resource at a given tier.
 */
export function isOverLimit<TTier extends string>(
  limits: Record<string, LimitDefinition<TTier>>,
  resource: string,
  tier: TTier,
  currentUsage: number,
): boolean {
  const limit = getLimit(limits, resource, tier);
  return currentUsage >= limit;
}
