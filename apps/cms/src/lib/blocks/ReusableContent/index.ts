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
