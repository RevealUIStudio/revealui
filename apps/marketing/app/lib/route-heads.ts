/**
 * Per-route document heads for revealui.com.
 * The prerender step and the live head manager both read this list.
 */

import { canonicalUrl } from './html-shell';

export const MARKETING_ORIGIN = 'https://revealui.com';

export const MARKETING_HOME_TITLE =
  'RevealUI | Build your business on software you can run yourself.';

export const MARKETING_HOME_DESCRIPTION =
  'RevealUI brings People, Content, Offers, Payments, and Agents into one self-hosted runtime. Start with the MIT core; add Pro for agent tools. Hosting and model usage are separate costs.';

export const MARKETING_NOT_FOUND_TITLE = '404 | RevealUI';

export interface MarketingRouteHead {
  path: string;
  title: string;
  description: string;
}

export const MARKETING_ROUTE_HEADS: readonly MarketingRouteHead[] = [
  {
    path: '/',
    title: MARKETING_HOME_TITLE,
    description: MARKETING_HOME_DESCRIPTION,
  },
  {
    path: '/products',
    title: 'Products | RevealUI',
    description: 'Compare self-hosted RevealUI licenses and supported features.',
  },
  {
    path: '/pricing',
    title: 'Pricing | RevealUI',
    description:
      'Compare Free, Pro, Max, and perpetual licenses. Hosting and model usage are separate costs.',
  },
  {
    path: '/contact',
    title: 'Contact | RevealUI',
    description: 'Ask about a RevealUI license, product support, or your deployment requirements.',
  },
  {
    path: '/claims',
    title: 'Claims and evidence | RevealUI',
    description:
      'Covered marketing statements and their cited evidence, with the limits of our automated checks.',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy | RevealUI',
    description:
      'How RevealUI collects and uses personal information, and how to contact us about your rights.',
  },
  {
    path: '/cookies',
    title: 'Cookie Policy | RevealUI',
    description: 'The cookies and optional analytics used on revealui.com.',
  },
  {
    path: '/terms',
    title: 'Terms of Service | RevealUI',
    description:
      'RevealUI software and subscription terms. Review license and renewal conditions before purchasing.',
  },
  {
    path: '/security',
    title: 'Security | RevealUI',
    description:
      'RevealUI security disclosures, reporting contacts, and deployment responsibilities.',
  },
  {
    path: '/support',
    title: 'Support | RevealUI',
    description: 'How to get RevealUI product support, published response commitments, and scope.',
  },
  {
    path: '/refund-policy',
    title: 'Refund Policy | RevealUI',
    description: 'RevealUI product refund conditions and how to request a refund.',
  },
  {
    path: '/status',
    title: 'Status | RevealUI',
    description: 'Check current API health endpoint reachability and read the limits of the check.',
  },
  {
    path: '/templates',
    title: 'Templates | RevealUI',
    description: 'Supported RevealUI templates and the configuration each starting point needs.',
  },
];

/** On-site notices that are real routes and are not sitemap entries. */
export const MARKETING_UNLISTED_SHELLS: readonly MarketingRouteHead[] = [
  {
    path: '/legal/hipaa',
    title: 'Moved | RevealUI',
    description:
      'A dedicated current HIPAA guide is not available here. Read our security disclosures and contact us about your deployment requirements.',
  },
  {
    path: '/legal/subprocessors',
    title: 'Moved | RevealUI',
    description:
      'A dedicated current subprocessor registry is not available here. Read our privacy disclosures and contact us for your procurement review.',
  },
];

const BY_PATH = new Map<string, MarketingRouteHead>(
  [...MARKETING_ROUTE_HEADS, ...MARKETING_UNLISTED_SHELLS].map((head) => [head.path, head]),
);

export function routeHead(path: string): MarketingRouteHead {
  const head = BY_PATH.get(path);
  if (!head) {
    throw new Error(`missing marketing route head for ${path}`);
  }
  return head;
}

export function shellHeadForPath(path: string): MarketingRouteHead | undefined {
  return BY_PATH.get(path);
}

export function marketingCanonical(path: string): string {
  return canonicalUrl(MARKETING_ORIGIN, path);
}

export function marketingOgImage(title: string, description: string): string {
  const params = new URLSearchParams({ title, description });
  return `https://api.revealui.com/api/og?${params.toString()}`;
}
