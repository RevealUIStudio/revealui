import type { CollectionConfig } from '@revealui/core';
import { anyone, isAdmin } from '@/lib/access';

const Events: CollectionConfig = {
  slug: 'events',
  // auth is omitted - this collection does not use authentication
  labels: {
    singular: 'Event',
    plural: 'Events',
  },
  access: {
    create: isAdmin,
    read: anyone,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'URL to the image',
      },
    },
    {
      name: 'alt',
      type: 'text',
      required: false,
    },
  ],
};

export default Events;
