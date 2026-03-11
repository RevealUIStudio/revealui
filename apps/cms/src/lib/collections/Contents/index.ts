import type { CollectionConfig } from '@revealui/core';
import { ArchiveBlock } from '@/lib/blocks/ArchiveBlock/config';
import { Banner } from '@/lib/blocks/Banner/config';
import { CallToAction } from '@/lib/blocks/CallToAction/config';
import { Code } from '@/lib/blocks/Code/config';
import { Content } from '@/lib/blocks/Content/config';
import { FormBlock } from '@/lib/blocks/Form/config';
import { MediaBlock } from '@/lib/blocks/MediaBlock/config';
import { StatsBlock } from '@/lib/blocks/StatsBlock/config';

const ContentsField = {
  name: 'name',
  slug: 'slug',
  description: 'description',
};

const Contents: CollectionConfig = {
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
      blocks: [
        ArchiveBlock,
        Banner,
        CallToAction,
        Code,
        Content,
        FormBlock,
        MediaBlock,
        StatsBlock,
      ],
    },
  ],
};

export default Contents;
