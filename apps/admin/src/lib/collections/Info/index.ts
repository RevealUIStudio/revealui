import type { CollectionConfig } from '@revealui/core';
import { anyone, authenticated, isAdmin } from '@/lib/access';

const Info: CollectionConfig = {
  slug: 'info',
  // auth is omitted - this collection does not use authentication
  labels: {
    singular: 'Main Info',
    plural: 'Main Infos',
  },
  access: {
    create: authenticated,
    read: anyone,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      required: true,
    },
    {
      name: 'subtitle',
      type: 'text',
      label: 'Subtitle',
      required: true,
    },
    {
      name: 'description',
      type: 'text',
      label: 'Description',
      required: true,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Image Source',
      required: true,
    },
  ],
};

export default Info;
