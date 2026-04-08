'use server';
import { createServerFeature } from '@revealui/core/richtext';
import type { TextField } from '@revealui/core/types/schema';

import { LabelNode } from './nodes/LabelNode';

const urlField: TextField = {
  name: 'url',
  type: 'text',
  required: true,
};

export const LabelFeature = async () => {
  return createServerFeature({
    feature: {
      ClientFeature: './feature.client',
      nodes: [
        {
          node: LabelNode,
        },
      ],
      generateSchemaMap: () => {
        // Schema map can contain various field types
        const schemaMap = new Map<string, TextField[] | unknown>();

        const fields = [urlField];
        schemaMap.set('fields', fields);

        return schemaMap;
      },
    },
    key: 'embed',
  });
};
