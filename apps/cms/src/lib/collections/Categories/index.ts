import type { CollectionConfig } from "@revealui/core";
import { anyone, authenticated } from "@/lib/access";

const Categories: CollectionConfig = {
	slug: "categories",
	access: {
		create: authenticated,
		delete: authenticated,
		read: anyone,
		update: authenticated,
	},
	admin: {
		useAsTitle: "title",
	},
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
		},
		// {
		//   name: "media",
		//   type: "upload",
		//   relationTo: "media",
		// },
	],
};

export default Categories;
