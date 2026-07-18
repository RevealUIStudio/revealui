// WIRE-UP-PENDING — the `main-menu` global is re-exported from
// `apps/admin/src/lib/globals/index.ts` but is NOT registered in
// `apps/admin/revealui.config.ts` (`globals: [Settings, Header, Footer]`), so
// it never reaches the admin runtime. Kept on disk pending a per-item
// register-vs-delete decision in PR review.
import type { GlobalConfig } from '@revealui/core';

import { link } from '@/lib/fields/link';

export const MainMenu: GlobalConfig = {
  slug: 'main-menu',
  access: {
    read: () => true,
    update: () => true,
  },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      maxRows: 6,
      fields: [
        link({
          appearances: false,
        }),
      ],
    },
  ],
};
