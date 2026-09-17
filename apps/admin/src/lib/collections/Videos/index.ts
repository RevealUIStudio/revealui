import type { CollectionConfig } from '@revealui/core';
import { isAdmin } from '@/lib/access';

const Videos: CollectionConfig = {
  slug: 'videos',
  // auth is omitted - this collection does not use authentication
  access: {
    create: isAdmin,
    read: () => true,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'url',
      type: 'text',
    },
  ],
};

export default Videos;
