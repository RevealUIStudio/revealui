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
 * Outside edit mode the drafts store is always empty, so this is zero-cost and
 * the return shape's `blocks`/`annotation` behave exactly as before.
 */

import { type Block, BlockSchema } from '@revealui/contracts/content';
import type { PreviewDoc } from '@revealui/editor/runtime';
import type { BlockAnnotation } from '@revealui/presentation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { fetchPageBlocks } from './api';
import { getEditDrafts, subscribeEditDrafts } from './edit-mode';
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
  /** Edit-mode annotation: active with a docId only when a matching draft overlay exists. */
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

  useEffect(() => {
    let cancelled = false;
    fetchPageBlocks(slug).then((raw) => {
      if (cancelled || !raw || raw.length === 0) return;
      const parsed = parseBlocks(raw);
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
  return { blocks, annotation: { editable: false } };
}
