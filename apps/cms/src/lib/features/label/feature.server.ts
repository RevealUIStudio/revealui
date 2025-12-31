/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";
import { createServerFeature } from "@payloadcms/richtext-lexical";
import { TextField } from "payload";
import { LabelFeatureClient } from "./feature.client";
import { LabelNode } from "./nodes/LabelNode";

const urlField: TextField = {
  name: "url",
  type: "text",
  required: true,
};

export const LabelFeature = async () => {
  return createServerFeature({
    feature: {
      ClientFeature: LabelFeatureClient,
      nodes: [
        {
          node: LabelNode,
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
};
