import { anyone, authenticated, isAdmin } from "@/lib/access"
import type { CollectionConfig } from "@revealui/cms"

const Banners: CollectionConfig = {
  slug: "banners",
  auth: false,
  access: {
    create: authenticated,
    read: anyone,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "image",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "alt",
      type: "text",
    },
    {
      name: "heading",
      type: "text",
    },
    {
      name: "subheading",
      type: "text",
    },
    {
      name: "description",
      type: "textarea",
    },
    {
      name: "cta",
      type: "text",
    },
    {
      name: "highlight",
      type: "text",
    },
    {
      name: "punctuation",
      type: "text",
    },
    {
      name: "stats",
      type: "array",
      fields: [
        {
          name: "label",
          type: "text",
        },
        {
          name: "value",
          type: "text",
        },
      ],
    },
    {
      name: "link",
      type: "group",
      fields: [
        {
          name: "href",
          type: "text",
        },
        {
          name: "text",
          type: "text",
        },
      ],
    },
  ],
}

export default Banners
