import type { Block } from '@revealui/core';

export const SiteTitle: Block = {
  slug: 'siteTitle',
  interfaceName: 'SiteTitle',
  fields: [{ name: 'siteName', type: 'text', required: true, admin: { width: '50%' } }],
};
