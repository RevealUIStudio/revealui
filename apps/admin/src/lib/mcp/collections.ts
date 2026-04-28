/**
 * MCP collection introspection — summary shape + resolver.
 *
 * Stage 4.2 of the MCP v1 plan. `/api/mcp/collections` returns an array of
 * `CollectionMcpSummary` by walking every registered CollectionConfig and
 * applying `resolveCollectionMcpSummary()`. Downstream consumers:
 *
 *   - `revealui-content` MCP server factory — filters on `mcpResource: true`
 *     to decide which collections to advertise as resources.
 *   - `/mcp` page — renders the list (exposed + hidden) as the
 *     read-only "Content exposure" section.
 */

import type { CollectionConfig } from '@revealui/contracts/admin';

export interface CollectionMcpSummary {
  /** Collection slug (e.g. `posts`, `pages`). */
  slug: string;
  /** Human-readable singular label (e.g. `Post`). */
  label: string;
  /** Human-readable plural label when the admin provides one. */
  labelPlural?: string;
  /**
   * Resolved MCP-resource flag. `true` when the collection is exposed to
   * MCP clients; `false` when opted out via `mcpResource: false` on the
   * CollectionStructure. Absent on the source config resolves to `true`
   * (default behavior per Stage 4.1 contract).
   */
  mcpResource: boolean;
}

/**
 * Title-case a kebab-case slug. Used as a fallback when the collection
 * doesn't declare explicit labels — `user-preferences` → `User Preferences`.
 */
export function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * Project a CollectionConfig into the MCP-facing summary shape.
 *
 * Input is typed loosely (`CollectionConfig<any>`) because the heterogeneous
 * admin registry uses an invariant generic.
 */
export function resolveCollectionMcpSummary(
  // biome-ignore lint/suspicious/noExplicitAny: registry holds heterogeneous collections
  collection: CollectionConfig<any>,
): CollectionMcpSummary {
  const singular =
    typeof collection.labels?.singular === 'string' && collection.labels.singular.length > 0
      ? collection.labels.singular
      : undefined;
  const plural =
    typeof collection.labels?.plural === 'string' && collection.labels.plural.length > 0
      ? collection.labels.plural
      : undefined;
  return {
    slug: collection.slug,
    label: singular ?? titleCaseSlug(collection.slug),
    labelPlural: plural,
    mcpResource: collection.mcpResource !== false,
  };
}
