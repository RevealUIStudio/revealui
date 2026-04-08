// Revalidate the page in the background, so the user doesn't have to wait
// Notice that the hook itself is not async and we are not awaiting `revalidate`
// Only revalidate existing docs that are published

import type { RevealDocument, RevealRequest, RevealUIInstance } from '@revealui/core';
import { revalidate } from './revalidate';

interface RequestWithRevealUI extends RevealRequest {
  revealui?: RevealUIInstance;
}

interface DocWithStatus extends RevealDocument {
  _status?: string;
  slug?: string;
}

// Don't scope to `operation` in order to purge static demo pages
export function revalidatePage({
  doc,
  req,
}: {
  doc: DocWithStatus;
  req: RequestWithRevealUI;
}): DocWithStatus {
  if (doc._status === 'published' && doc.slug && req.revealui) {
    void revalidate({
      revealui: req.revealui,
      collection: 'pages',
      slug: doc.slug,
    });
  }
  // Logging removed for production - use proper logging service in production
  return doc;
}
