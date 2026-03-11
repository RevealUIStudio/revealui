import type { CollectionConfig } from '@revealui/core';
import { anyone, isAdmin } from '@/lib/access';
import { slugField } from '@/lib/fields/slug/index';

const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: isAdmin,
    delete: isAdmin,
    read: anyone,
    update: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    ...slugField(),
    // {
    //   name: "media",
    //   type: "upload",
    //   relationTo: "media",
    // },
  ],
};

export default Categories;
