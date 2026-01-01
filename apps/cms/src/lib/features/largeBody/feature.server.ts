/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Implement local rich text feature
// TODO: Implement local alternative
// import // @payloadcms/richtext-lexical";
import { TextField } from "revealui/cms";
// import { LargeBodyFeatureClient } from "./feature.client";
import { LargeBodyNode } from "./nodes/LargeBodyNode";

const urlField: TextField = {
  name: "url",
  type: "text",
  required: true,
};

export const LabelFeature = createServerFeature({
  feature: {
    ClientFeature: "./feature.client",
    nodes: [
      {
        node: LargeBodyNode,
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
