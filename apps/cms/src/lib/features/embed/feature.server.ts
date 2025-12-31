import {createServerFeature} from "@payloadcms/richtext-lexical";
import {TextField} from "payload";
// import { EmbedFeatureClient } from "./feature.client";
import {EmbedNode} from "./nodes/EmbedNode";

const urlField: TextField = {
  name: "url",
  type: "text",
  required: true,
};

export const EmbedFeature = createServerFeature({
  feature: {
    // ClientFeature: EmbedFeatureClient,
    ClientFeature: "./feature.client",
    nodes: [
      {
        node: EmbedNode,
      },
    ],
    generateSchemaMap: () => {
      const schemaMap = new Map<string, any>();

      const fields = [urlField];
      schemaMap.set("fields", fields);

      return schemaMap;
    },
  },
  key: "embed",
});
