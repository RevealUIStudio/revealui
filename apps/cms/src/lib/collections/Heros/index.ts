import { anyone, authenticated, isAdmin } from "@/lib/access"
import type { CollectionConfig } from "payload"

const Heros: CollectionConfig = {
  slug: "heros",
  auth: false,
  access: {
    create: authenticated,
    read: anyone,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "href",
      type: "text",
      admin: {
        description: "Call to Action URL",
      },
    },
    {
      name: "altText",
      type: "text",
      required: false,
    },
  ],
}

export default Heros
