import type { Block } from "@revealui/core";

// import Categories from "../../collections/Categories";

// import Tags from "../../collections/Tags";

const PageListField = {
	numberOfItems: "numberOfItems",
	filterByCategories: "filterByCategories",
	filterByTags: "filterByTags",
	sortBy: "sortBy",
	pages: "pages",
};

// eslint-disable-next-line no-redeclare
type PageListField = (typeof PageListField)[keyof typeof PageListField];

export const PageList: Block = {
	slug: "pageList",
	interfaceName: "PageList",
	fields: [
		{
			name: PageListField.numberOfItems,
			type: "number",
			defaultValue: 5,
		},
		{
			name: PageListField.filterByCategories,
			type: "relationship",
			// relationTo: [Categories.slug],
			relationTo: "pages",
			maxDepth: 0,
			hasMany: true,
		},
		{
			name: PageListField.filterByTags,
			type: "relationship",
			// relationTo: [Tags.slug],
			relationTo: "pages",
			hasMany: true,
			maxDepth: 0,
		},
		{
			name: PageListField.sortBy,
			type: "select",
			options: [
				// PagesField.title,
				// PagesField.createdAt,
				// PagesField.updatedAt,
				// `-${PagesField.title}`,
				// `-${PagesField.createdAt}`,
				// `-${PagesField.updatedAt}`,
			],
		},
	],
};

// import { Block } from '@revealui/core'
// import Categories from '../../../collections/Categories'
// import { PagesField } from '../../../collections/Pages'
// import Tags from '../../../collections/Tags'

// const PageListField = {
//   numberOfItems: 'numberOfItems',
//   filterByCategories: 'filterByCategories',
//   filterByTags: 'filterByTags',
//   sortBy: 'sortBy',
//   pages: 'pages'
// }

// // eslint-disable-next-line no-redeclare
// type PageListField = (typeof PageListField)[keyof typeof PageListField]

// export const PageList: Block = {
//   slug: 'pageList',
//   interfaceName: 'PageList',
//   fields: [
//     {
//       name: PageListField.numberOfItems,
//       type: 'number',
//       defaultValue: 5
//     },
//     {
//       name: PageListField.filterByCategories,
//       type: 'relationship',
//       relationTo: [Categories.slug],
//       maxDepth: 0,
//       hasMany: true
//     },
//     {
//       name: PageListField.filterByTags,
//       type: 'relationship',
//       relationTo: [Tags.slug],
//       hasMany: true,
//       maxDepth: 0
//     },
//     {
//       name: PageListField.sortBy,
//       type: 'select',
//       options: [
//         PagesField.title,
//         PagesField.createdAt,
//         PagesField.updatedAt,
//         `-${PagesField.title}`,
//         `-${PagesField.createdAt}`,
//         `-${PagesField.updatedAt}`
//       ]
//     }
//   ]
// }
