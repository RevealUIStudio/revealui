import type { ArrayField, Field } from '@revealui/core';
import { deepMerge } from '@revealui/core';
import type { LinkAppearances } from './link';
import { link } from './link';

type LinkGroupType = (options?: {
  appearances?: LinkAppearances[] | false;
  overrides?: Partial<ArrayField>;
}) => Field;

export const linkGroup: LinkGroupType = ({ appearances, overrides = {} } = {}) => {
  const generatedLinkGroup: Field = {
    name: 'links',
    type: 'array',
    fields: [
      link({
        appearances,
      }),
    ],
  };

  return deepMerge(
    generatedLinkGroup as unknown as Record<string, unknown>,
    overrides,
  ) as unknown as Field;
};
