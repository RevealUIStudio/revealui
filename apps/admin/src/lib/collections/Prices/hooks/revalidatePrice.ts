// Revalidate the page in the background, so the user doesn't have to wait
// Notice that the hook itself is not async and we are not awaiting `revalidate`
// Only revalidate existing docs that are published

import type { RevealAfterChangeHook } from '@revealui/core';
import type { Price } from '@revealui/core/types/cms';
import { revalidate } from '@/lib/hooks';

// Don't scope to `operation` in order to purge static demo pages
export const revalidatePrice: RevealAfterChangeHook<Price> = ({ doc, req }) => {
  if (
    doc._status === 'published' &&
    'slug' in doc &&
    typeof doc.slug === 'string' &&
    req.revealui
  ) {
    revalidate({
      revealui: req.revealui,
      collection: 'prices',
      slug: doc.slug,
    });
  }

  return doc;
};
