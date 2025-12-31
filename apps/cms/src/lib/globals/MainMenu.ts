import type { GlobalConfig } from "payload";

import { link } from "../fields/link";

export const MainMenu: GlobalConfig = {
  slug: "main-menu",
  access: {
    read: () => true,
    update: () => true,
  },
  fields: [
    {
      name: "navItems",
      type: "array",
      maxRows: 6,
      fields: [
        link({
          appearances: false,
        }),
      ],
    },
  ],
};
