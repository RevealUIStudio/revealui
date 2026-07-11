/**
 * Draft read semantics
 *
 * A collection opts into drafts via `versions.drafts` (see the admin
 * `VersionsConfigSchema`). When drafts are enabled, a document's `_status`
 * column distinguishes `'draft'` from `'published'` state in a single row.
 *
 * These helpers centralize the ONE rule that keeps unpublished content from
 * leaking to readers who should not see it: a read of a drafts-enabled
 * collection is published-only by default, and `draft=true` relaxes ONLY that
 * default. It never touches the `access.read` clause, which find()/findByID()
 * AND-merge separately — so a caller scoped to published content by
 * `access.read` stays published-only even when it asks for `draft=true`.
 */

import type { RevealCollectionConfig, RevealWhere } from '../../types/index.js';

/**
 * True when the collection enables drafts via `versions.drafts`.
 *
 * `versions: true` (version history without drafts) does NOT enable drafts —
 * there is no `_status` lifecycle to gate, so reads are not filtered.
 */
export function collectionHasDrafts(config: RevealCollectionConfig): boolean {
  const versions = (config as { versions?: unknown }).versions;
  if (!versions || typeof versions !== 'object') return false;
  const drafts = (versions as { drafts?: unknown }).drafts;
  return drafts === true || (typeof drafts === 'object' && drafts !== null);
}

/**
 * The additional published-only read filter for a drafts-enabled collection
 * when draft mode is NOT requested. Returns `undefined` when no filter applies
 * (collection has no drafts, or `draft=true` was passed).
 *
 * SECURITY: this is layered ON TOP of `access.read`, never a replacement.
 * `draft=true` removes only this filter; the access clause is AND-merged by the
 * caller and always wins.
 */
export function publishedOnlyReadFilter(
  config: RevealCollectionConfig,
  draft: boolean,
): RevealWhere | undefined {
  if (draft) return undefined;
  if (!collectionHasDrafts(config)) return undefined;
  return { _status: { equals: 'published' } };
}
