/* eslint-disable @typescript-eslint/no-explicit-any */

import type { TextField } from '@revealui/core'
import { createServerFeature } from '@revealui/core/richtext-lexical'
import { EmbedNode } from './nodes/EmbedNode'

const urlField: TextField = {
  name: 'url',
  type: 'text',
  required: true,
}

export const EmbedFeature = createServerFeature({
  feature: {
    // ClientFeature: EmbedFeatureClient,
    ClientFeature: './feature.client',
    nodes: [
      {
        node: EmbedNode,
      },
    ],
    generateSchemaMap: () => {
      const schemaMap = new Map<string, any>()

      const fields = [urlField]
      schemaMap.set('fields', fields)

      return schemaMap
    },
  },
  key: 'embed',
})
