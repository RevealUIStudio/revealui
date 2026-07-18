// WIRE-UP-PENDING — this `siteTitle` block config is not offered by any
// collection's `blocks` field (the Pages editor block list) and has no
// renderer in `apps/admin/src/lib/blocks/RenderBlocks.tsx`. It is config-only
// with no consumer. Kept on disk pending a per-item register-vs-delete
// decision in PR review.
import type { Block } from '@revealui/core';

export const SiteTitle: Block = {
  slug: 'siteTitle',
  interfaceName: 'SiteTitle',
  fields: [{ name: 'siteName', type: 'text', required: true, admin: { width: '50%' } }],
};
