import type { Block } from '@revealui/core';

const PageListField = {
  numberOfItems: 'numberOfItems',
  filterByCategories: 'filterByCategories',
  filterByTags: 'filterByTags',
  sortBy: 'sortBy',
  pages: 'pages',
};

// TODO: filterByCategories and filterByTags currently point to 'pages'
// because Categories and Tags collections don't exist yet.
// When those collections are created, update relationTo accordingly.
// sortBy options are also empty pending PagesField enum.
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
      options: [],
    },
  ],
};
