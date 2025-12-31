import { anyone, authenticated, isAdmin } from "@/lib/access"
import type { CollectionConfig } from "payload"

const Info: CollectionConfig = {
  slug: "info",
  auth: false,
  labels: {
    singular: "Main Info",
    plural: "Main Infos",
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
      label: "Title",
      required: true,
    },
    {
      name: "subtitle",
      type: "text",
      label: "Subtitle",
      required: true,
    },
    {
      name: "description",
      type: "text",
      label: "Description",
      required: true,
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      label: "Image Source",
      required: true,
    },
  ],
}

export default Info
