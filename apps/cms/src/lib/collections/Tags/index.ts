import type { CollectionConfig } from '@revealui/core';

const TagsField = {
  name: 'name',
  slug: 'slug',
};

const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: TagsField.name,
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: TagsField.name,
      type: 'text',
      required: true,
    },
    {
      name: TagsField.slug,
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
      },
    },
  ],
  timestamps: false,
};

export default Tags;
