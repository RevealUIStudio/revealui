import type { CollectionConfig } from "payload";

const Videos: CollectionConfig = {
  slug: "videos",
  auth: false,
  access: {
    // create: ({ req: { user } }) => !!user,
    // read: () => true,
    // update: ({ req: { user } }) => !!user,
    // delete: ({ req: { user } }) => !!user,
    create: () => true,
    read: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: "url",
      type: "text",
    },
  ],
};

export default Videos;
