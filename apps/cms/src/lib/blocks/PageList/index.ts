import type { Block } from '@revealui/core';

const PageListField = {
  numberOfItems: 'numberOfItems',
  filterByCategories: 'filterByCategories',
  filterByTags: 'filterByTags',
  sortBy: 'sortBy',
  pages: 'pages',
};

// filterByCategories and filterByTags reference 'pages' as placeholder.
// Update relationTo to 'categories' and 'tags' when those collections are created.
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
      relationTo: 'pages',
      maxDepth: 0,
      hasMany: true,
    },
    {
      name: PageListField.filterByTags,
      type: 'relationship',
      relationTo: 'pages',
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
