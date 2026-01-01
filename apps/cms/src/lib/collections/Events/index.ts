import { anyone, authenticated, isAdmin } from "@/lib/access"
import type { CollectionConfig } from "@revealui/cms"

const Events: CollectionConfig = {
  slug: "events",
  auth: false,
  labels: {
    singular: "Event",
    plural: "Events",
  },
  access: {
    create: authenticated,
    read: anyone,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "title",
      type: "text",
    },
    {
      name: "name",
      type: "text",
    },
    {
      name: "description",
      type: "textarea",
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      admin: {
        description: "URL to the image",
      },
    },
    {
      name: "alt",
      type: "text",
      required: false,
    },
  ],
}

export default Events
