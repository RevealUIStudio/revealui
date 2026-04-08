// blocks/StatsBlock.ts
import type { Block } from '@revealui/core';

export const StatsBlock: Block = {
  slug: 'stats-block', // Unique identifier for the block
  fields: [
    {
      name: 'style',
      type: 'select',
      defaultValue: 'info',
      options: [
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warning' },
        { label: 'Error', value: 'error' },
        { label: 'Success', value: 'success' },
      ],
      required: true,
    },
    {
      name: 'stats',
      type: 'array',
      label: 'Stats',
      labels: {
        singular: 'Stat',
        plural: 'Stats',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          label: 'Label',
        },
        {
          name: 'value',
          type: 'text',
          required: true,
          label: 'Value',
        },
        {
          name: 'icon',
          type: 'upload',
          relationTo: 'media', // Assuming you have a media collection
          label: 'Icon (Optional)',
          required: false,
        },
      ],
    },
  ],
  interfaceName: 'StatsBlock',
};
