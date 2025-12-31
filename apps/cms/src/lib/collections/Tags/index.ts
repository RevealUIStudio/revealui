import type { CollectionConfig } from "payload";

const TagsField = {
  name: "name",
  slug: "slug",
};

// eslint-disable-next-line no-redeclare
type TagsField = (typeof TagsField)[keyof typeof TagsField];

const Tags: CollectionConfig = {
  slug: "tags",
  admin: {
    useAsTitle: TagsField.name,
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: TagsField.name,
      type: "text",
      required: true,
    },
    {
      name: TagsField.slug,
      type: "text",
      required: true,
      unique: true,
      admin: {
        position: "sidebar",
      },
    },
  ],
  timestamps: false,
};

export default Tags;
