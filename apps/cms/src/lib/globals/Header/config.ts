import type { GlobalConfig } from '@revealui/core';
import { link } from '@/lib/fields/link';
import { revalidateHeader } from './hooks/revalidateHeader';

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
    },
  ],
  hooks: {
    // @ts-expect-error - Hook signatures are flexible and runtime-compatible
    afterChange: [revalidateHeader],
  },
};
