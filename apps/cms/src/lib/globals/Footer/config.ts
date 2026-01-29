import type { GlobalConfig } from '@revealui/core'
import { link } from '../../fields/link.js'
import { revalidateFooter } from './hooks/revalidateFooter.js'

export const Footer: GlobalConfig = {
  slug: 'footer',
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
    afterChange: [revalidateFooter],
  },
}
