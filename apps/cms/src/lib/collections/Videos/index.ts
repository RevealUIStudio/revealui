import type { CollectionConfig } from '@revealui/core';

const Videos: CollectionConfig = {
  slug: 'videos',
  // auth is omitted - this collection does not use authentication
  access: {
    // create: ({ req }) => !!user,
    // read: () => true,
    // update: ({ req }) => !!user,
    // delete: ({ req }) => !!user,
    create: () => true,
    read: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'url',
      type: 'text',
    },
  ],
};

export default Videos;
