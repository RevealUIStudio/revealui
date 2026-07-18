// WIRE-UP-PENDING — this `pageContent` block config is not offered by any
// collection's `blocks` field (the Pages editor block list) and has no
// renderer in `apps/admin/src/lib/blocks/RenderBlocks.tsx`. It is config-only
// with no consumer. Kept on disk pending a per-item register-vs-delete
// decision in PR review.
import type { Block } from '@revealui/core';

export const PageContent: Block = {
  slug: 'pageContent',
  interfaceName: 'PageContent',
  fields: [
    {
      name: 'description',
      type: 'textarea',
      defaultValue:
        'This block will display the content of the page (if any). Please edit the original page change the value.',
      admin: {
        readOnly: true,
      },
    },
  ],
};
