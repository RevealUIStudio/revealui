import { Block } from "@revealui/cms";
// import Contents from "../../collections/Contents";

export const ReusableContent: Block = {
  slug: "reusableContent",
  interfaceName: "ReusableContent",
  fields: [
    {
      name: "reference",
      type: "relationship",
      maxDepth: 0,
      relationTo: "contents",
      // relationTo: [Contents.slug],
    },
  ],
};

// import { Block } from 'payload'
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
