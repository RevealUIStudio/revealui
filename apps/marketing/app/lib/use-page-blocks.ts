/**
 * Static-first block hook for the marketing pages.
 *
 * Paints immediately with the static fallback derived from the content modules,
 * then swaps in the published CMS blocks once they arrive AND validate against
 * the contracts BlockSchema and match the fallback's per-position shape. Any
 * error, empty payload, or shape mismatch keeps the fallback, so a page always
 * renders with zero API dependency and can never be reshaped by a bad payload.
 *
 * In edit mode, when the active edit session (see `./edit-mode`) carries a draft
 * overlay for this page (matched by `slug`), the draft's blocks take priority
 * over both the CMS fetch and the fallback, and the returned annotation activates
 * so the shared block renderer emits `data-rvui-*` attributes for click-to-edit.
 *
 * A draft overlay only exists once the FIRST field on a page has been patched
 * (the session server materializes it lazily), so annotation cannot depend on
 * a draft alone: a brand-new session would never have one, click-to-edit would
 * never emit any `data-rvui-field`, and the very first click needed to create
 * that first patch could never fire. To bootstrap, the annotation also
 * activates (with the CMS page's own id as `docId`) whenever edit mode is
 * active and the page's CMS row is known, even with zero drafts yet — the
 * click fires, the canvas PATCHes the field, the session server materializes
 * the doc, and the draft-overlay path above takes over for further edits.
 *
 * Outside edit mode the drafts store is always empty and `isEditModeActive()`
 * is false, so this is zero-cost and `blocks`/`annotation` behave exactly as
 * before.
 */

import { type Block, BlockSchema } from '@revealui/contracts/content';
import type { PreviewDoc } from '@revealui/editor/runtime';
import type { BlockAnnotation } from '@revealui/presentation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { fetchPageBlocks } from './api';
import { getEditDrafts, isEditModeActive, subscribeEditDrafts } from './edit-mode';
import { blocksMatchFallback } from './page-blocks';

function devWarn(message: string): void {
  if (import.meta.env.DEV) {
    // biome-ignore lint/suspicious/noConsole: dev-only diagnostic for CMS payload rejection
    console.warn(`[marketing:page-blocks] ${message}`); // console-allowed
  }
}

function parseBlocks(raw: Block[]): Block[] | null {
  const parsed: Block[] = [];
  for (const candidate of raw) {
    const result = BlockSchema.safeParse(candidate);
    if (!result.success) return null;
    parsed.push(result.data as Block);
  }
  return parsed;
}

export interface PageBlocksResult {
  readonly blocks: Block[];
  /**
   * Edit-mode annotation. Active with a matching draft overlay's `docId`, or
   * (with no draft yet) the CMS page's own id whenever edit mode is active and
   * the page's CMS row is known. Inactive otherwise.
   */
  readonly annotation: BlockAnnotation;
}

/** The draft overlay (if any) among `drafts` whose page slug matches `slug`. */
function findDraftForSlug(
  drafts: readonly PreviewDoc[],
  slug: string,
  fallback: Block[],
): { docId: string; blocks: Block[] } | null {
  for (const doc of drafts) {
    if (doc.docType !== 'page') continue;
    const draft = doc.draft;
    if (typeof draft !== 'object' || draft === null) continue;
    const record = draft as Record<string, unknown>;
    if (record.slug !== slug || !Array.isArray(record.blocks)) continue;
    const parsed = parseBlocks(record.blocks as Block[]);
    if (!(parsed && blocksMatchFallback(parsed, fallback))) continue;
    return { docId: doc.docId, blocks: parsed };
  }
  return null;
}

/**
 * @param slug     the fleet-marketing page slug (`home`, `products`)
 * @param fallback the static block array derived from the content modules
 */
export function useMarketingPageBlocks(slug: string, fallback: Block[]): PageBlocksResult {
  const [blocks, setBlocks] = useState<Block[]>(fallback);
  const [cmsPageId, setCmsPageId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPageBlocks(slug).then((page) => {
      if (cancelled || !page) return;
      setCmsPageId(page.id);
      if (!page.blocks || page.blocks.length === 0) return;
      const parsed = parseBlocks(page.blocks);
      if (!parsed) {
        devWarn(`rejected CMS blocks for "${slug}": failed schema validation`);
        return;
      }
      if (!blocksMatchFallback(parsed, fallback)) {
        devWarn(`rejected CMS blocks for "${slug}": shape does not match the static fallback`);
        return;
      }
      setBlocks(parsed);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, fallback]);

  const drafts = useSyncExternalStore(subscribeEditDrafts, getEditDrafts, getEditDrafts);
  const draft = findDraftForSlug(drafts, slug, fallback);

  if (draft) {
    return { blocks: draft.blocks, annotation: { editable: true, docId: draft.docId } };
  }
  if (isEditModeActive() && cmsPageId) {
    return { blocks, annotation: { editable: true, docId: cmsPageId } };
  }
  return { blocks, annotation: { editable: false } };
}
