// WIRE-UP-PENDING — this `info` collection config is NOT registered in
// `apps/admin/src/lib/collections/registry.ts` (`allCollections`) and is not
// consumed anywhere. It has no backing Postgres table. Kept on disk pending a
// per-item register-vs-delete decision in PR review.
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
