// Copy for /templates (TemplatesPage.tsx). Indexed in claims-evidence.
// Live facts only: create-revealui 0.5.22 CLI list, four GitHub twins,
// Apify pay-per-event prices. starter-native has no GitHub twin.

import { SITE } from './site';

export const CREATE_REVEALUI_NPM_VERSION = '0.5.22' as const;

export interface TemplateCatalogItem {
  readonly id: 'basic-blog' | 'e-commerce' | 'portfolio' | 'starter' | 'starter-native';
  readonly name: string;
  readonly stack: string;
  readonly body: string;
  readonly githubHref: string | null;
}

export const TEMPLATES_HERO = {
  title: 'Templates',
  subtitle: 'Scaffold a RevealUI app from the published CLI, or start from a GitHub template.',
} as const;

export const TEMPLATES_CLI = {
  heading: 'create-revealui',
  body: `Run npx create-revealui@latest. The published npm package is create-revealui ${CREATE_REVEALUI_NPM_VERSION}.`,
  command: 'npx create-revealui@latest',
} as const;

export const TEMPLATES_CLI_ITEMS: readonly TemplateCatalogItem[] = [
  {
    id: 'basic-blog',
    name: 'basic-blog',
    stack: 'Next.js 16 + @revealui/*',
    body: 'Blogs and content sites.',
    githubHref: 'https://github.com/RevealUIStudio/revealui-template-basic-blog',
  },
  {
    id: 'e-commerce',
    name: 'e-commerce',
    stack: 'Next.js 16 + @revealui/* + Stripe',
    body: 'Product catalog with checkout.',
    githubHref: 'https://github.com/RevealUIStudio/revealui-template-e-commerce',
  },
  {
    id: 'portfolio',
    name: 'portfolio',
    stack: 'Next.js 16 + @revealui/*',
    body: 'Personal portfolio site.',
    githubHref: 'https://github.com/RevealUIStudio/revealui-template-portfolio',
  },
  {
    id: 'starter',
    name: 'starter',
    stack: 'Next.js 16 + @revealui/*',
    body: 'Blank-canvas Next.js app, no sample collections.',
    githubHref: 'https://github.com/RevealUIStudio/revealui-template-starter',
  },
  {
    id: 'starter-native',
    name: 'starter-native',
    stack: 'Vite + @revealui/router, no Next.js',
    body: 'RevealUI-native runtime. No GitHub Use this template twin.',
    githubHref: null,
  },
] as const;

export const TEMPLATES_GITHUB = {
  heading: 'GitHub Use this template',
  body: 'Four Next.js templates have a public GitHub twin. starter-native does not.',
} as const;

export const TEMPLATES_APIFY = {
  heading: 'Apify actor',
  body: 'Pay-per-event pricing is $0.02 per action, $0.08 per run, and $0.00001 per verify. Verify is not free.',
  href: 'https://apify.com/revealuistudio/governed-agent-run',
  cta: 'Open on Apify',
} as const;

export const TEMPLATES_LICENSES = {
  heading: 'Licenses',
  body: 'Product licenses live on this site. Studio work is booked on Google Calendar.',
  pricing: { label: 'See product pricing', href: '/pricing' },
  book: { label: 'Book a 30-minute intro', href: SITE.urls.bookIntro, external: true },
} as const;
