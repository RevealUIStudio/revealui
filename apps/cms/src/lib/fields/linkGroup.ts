import { ArrayField } from "revealui/cms";

import type { LinkAppearances } from "./link";

import deepMerge from "@/lib/utilities/deepMerge";
import { link } from "./link";

type LinkGroupType = (options?: {
  appearances?: LinkAppearances[] | false;
  overrides?: Partial<ArrayField>;
}) => Field;

export const linkGroup: LinkGroupType = ({
  appearances,
  overrides = {},
} = {}) => {
  const generatedLinkGroup: Field = {
    name: "links",
    type: "array",
    fields: [
      link({
        appearances,
      }),
    ],
  };

  return deepMerge(generatedLinkGroup, overrides);
};
