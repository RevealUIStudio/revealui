import type { CollectionConfig } from "@revealui/core";

// import { Menu, PageContent, PageList, SiteTitle } from 'reveal'

const ContentsField = {
	name: "name",
	slug: "slug",
	description: "description",
};

const Contents: CollectionConfig = {
	// slug: ContentsField.slug,
	slug: "contents",
	access: {
		read: () => true,
	},
	admin: {
		useAsTitle: ContentsField.name,
	},
	fields: [
		{
			name: ContentsField.name,
			type: "text",
			required: true,
		},
		{
			name: ContentsField.description,
			type: "text",
		},
		{
			name: "image",
			type: "upload",
			relationTo: "media",
			admin: {
				description: "Hero image for this content section",
			},
		},
		{
			name: "blocks",
			type: "blocks",
			blocks: [],
			// blocks: [Menu, PageContent, PageList, SiteTitle]
		},
	],
};

export default Contents;

// import { CollectionConfig } from "@revealui/core";
// import { Menu } from "../../blocks/Menu";
// import { PageContent } from "../../blocks/PageContent";
// import { PageList } from "../../blocks/PageList";
// import { SiteTitle } from "../../blocks/SiteTitle";

// const ContentsField = {
//   name: "name",
//   slug: "slug",
//   description: "description",
// };
// type ContentsField = (typeof ContentsField)[keyof typeof ContentsField];

// const Contents: CollectionConfig = {
//   slug: "contents",
//   access: {
//     read: () => true,
//   },
//   admin: {
//     useAsTitle: ContentsField.name,
//   },
//   fields: [
//     {
//       name: ContentsField.name,
//       type: "text",
//       required: true,
//     },
//     {
//       name: ContentsField.slug,
//       type: "text",
//       unique: true,
//       admin: {
//         position: "sidebar",
//       },
//     },
//     {
//       name: ContentsField.description,
//       type: "text",
//     },
//     {
//       name: "blocks",
//       type: "blocks",
//       blocks: [Menu, PageContent, PageList, SiteTitle],
//     },
//   ],
// };

// export default Contents;
