/**
 * PayloadCMS Collection Template
 *
 * Usage: Create a new collection in apps/cms/src/lib/collections/
 */

import type { CollectionConfig } from "payload";
import { anyone, isAdmin } from "../../access";

export const CollectionName: CollectionConfig = {
	slug: "collection-slug",
	timestamps: true,
	admin: {
		useAsTitle: "name", // Field to use as title in admin
		defaultColumns: ["name", "createdAt"],
	},
	// Enable authentication if needed
	auth: true, // or { useAPIKey: true }
	access: {
		read: anyone,
		create: isAdmin,
		update: isAdmin,
		delete: isAdmin,
	},
	fields: [
		{
			name: "name",
			type: "text",
			required: true,
		},
		// Add more fields as needed
	],
};

export default CollectionName;
