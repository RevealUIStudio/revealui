// WIRE-UP-PENDING — this `pageList` block config is not offered by any
// collection's `blocks` field (the Pages editor block list) and has no
// renderer in `apps/admin/src/lib/blocks/RenderBlocks.tsx`. It is config-only
// with no consumer. Kept on disk pending a per-item register-vs-delete
// decision in PR review.
import type { Block } from '@revealui/core';

const PageListField = {
  numberOfItems: 'numberOfItems',
  filterByCategories: 'filterByCategories',
  filterByTags: 'filterByTags',
  sortBy: 'sortBy',
  pages: 'pages',
};

export const PageList: Block = {
  slug: 'pageList',
  interfaceName: 'PageList',
  fields: [
    {
      name: PageListField.numberOfItems,
      type: 'number',
      defaultValue: 5,
    },
    {
      name: PageListField.filterByCategories,
      type: 'relationship',
      relationTo: 'categories',
      maxDepth: 0,
      hasMany: true,
    },
    {
      name: PageListField.filterByTags,
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      maxDepth: 0,
    },
    {
      name: PageListField.sortBy,
      type: 'select',
      options: [
        { label: 'Title', value: 'title' },
        { label: 'Created At', value: 'createdAt' },
        { label: 'Updated At', value: 'updatedAt' },
      ],
    },
  ],
};
