import type { CollectionConfig } from "payload";

const Cards: CollectionConfig = {
  slug: "cards",
  auth: false,
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
  fields: [
    {
      name: "name",
      type: "text",
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "label",
      type: "text",
    },
    {
      name: "cta",
      type: "text",
    },
    {
      name: "href",
      type: "text",
    },
    {
      name: "loading",
      type: "radio",
      options: ["eager", "lazy"],
      defaultValue: "eager",
    },
  ],
};

export default Cards;
