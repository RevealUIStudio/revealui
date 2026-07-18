// WIRE-UP-PENDING — this `reusableContent` block config is not offered by any
// collection's `blocks` field (the Pages editor block list) and has no
// renderer in `apps/admin/src/lib/blocks/RenderBlocks.tsx`. It is config-only
// with no consumer (its Contents import is commented out). Kept on disk
// pending a per-item register-vs-delete decision in PR review.
import type { Block } from '@revealui/core';
// import Contents from "../../collections/Contents/index.js";

export const ReusableContent: Block = {
  slug: 'reusableContent',
  interfaceName: 'ReusableContent',
  fields: [
    {
      name: 'reference',
      type: 'relationship',
      maxDepth: 0,
      relationTo: 'contents',
      // relationTo: [Contents.slug],
    },
  ],
};

// import { Block } from '@revealui/core'
// import Contents from '../../../collections/Contents'

// export const ReusableContent: Block = {
//   slug: 'reusableContent',
//   interfaceName: 'ReusableContent',
//   fields: [
//     {
//       name: 'reference',
//       type: 'relationship',
//       maxDepth: 0,
//       relationTo: [Contents.slug]
//     }
//   ]
// }
