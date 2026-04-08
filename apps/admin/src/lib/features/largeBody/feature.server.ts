import type { TextField } from '@revealui/core';
import { createServerFeature } from '@revealui/core/richtext';
import { LargeBodyNode } from './nodes/LargeBodyNode';

const urlField: TextField = {
  name: 'url',
  type: 'text',
  required: true,
};

export const LabelFeature = createServerFeature({
  feature: {
    ClientFeature: './feature.client',
    nodes: [
      {
        node: LargeBodyNode,
      },
    ],
    generateSchemaMap: () => {
      const schemaMap = new Map<string, unknown>();
      const fields: TextField[] = [urlField];
      schemaMap.set('fields', fields);

      return schemaMap;
    },
  },
  key: 'embed',
});
