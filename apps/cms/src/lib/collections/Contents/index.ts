import type { CollectionConfig } from '@revealui/core'

const ContentsField = {
  name: 'name',
  slug: 'slug',
  description: 'description',
}

const Contents: CollectionConfig = {
  // slug: ContentsField.slug,
  slug: 'contents',
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: ContentsField.name,
  },
  fields: [
    {
      name: ContentsField.name,
      type: 'text',
      required: true,
    },
    {
      name: ContentsField.description,
      type: 'text',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Hero image for this content section',
      },
    },
    {
      name: 'blocks',
      type: 'blocks',
      blocks: [],
    },
  ],
}

export default Contents
