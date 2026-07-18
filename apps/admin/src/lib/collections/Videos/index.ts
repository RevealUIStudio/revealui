// WIRE-UP-PENDING — this `videos` collection config is NOT registered in
// `apps/admin/src/lib/collections/registry.ts` (`allCollections`) and is not
// consumed anywhere. It has no backing Postgres table. Kept on disk pending a
// per-item register-vs-delete decision in PR review.
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
