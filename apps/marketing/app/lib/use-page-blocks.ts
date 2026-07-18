/**
 * Static-first block hook for the marketing pages.
 *
 * Paints immediately with the static fallback derived from the content modules,
 * then swaps in the published CMS blocks once they arrive AND validate against
 * the contracts BlockSchema and match the fallback's per-position shape. Any
 * error, empty payload, or shape mismatch keeps the fallback, so a page always
 * renders with zero API dependency and can never be reshaped by a bad payload.
 */

import { type Block, BlockSchema } from '@revealui/contracts/content';
import { useEffect, useState } from 'react';
import { fetchPageBlocks } from './api';
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

/**
 * @param slug     the fleet-marketing page slug (`home`, `products`)
 * @param fallback the static block array derived from the content modules
 */
export function useMarketingPageBlocks(slug: string, fallback: Block[]): Block[] {
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

  return blocks;
}
