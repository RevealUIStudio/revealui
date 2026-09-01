// Copy for /templates (TemplatesPage.tsx). Indexed in claims-evidence.
// Live facts only: create-revealui 0.5.22 CLI list, four GitHub twins,
// Deploy-to-Vercel clone URLs for those twins, Apify pay-per-event prices.
// starter-native has no GitHub twin and no Deploy button.
// vercel.com/templates listing is not live (owner submit only).

import { SITE } from './site';

export const CREATE_REVEALUI_NPM_VERSION = '0.5.22' as const;

export const VERCEL_CLONE_ORIGIN = 'https://vercel.com/new/clone' as const;

/** Official marketplace listing is owner-only. Do not invent a URL. */
export const VERCEL_TEMPLATES_LISTING_URL = null;

export const VERCEL_DEPLOY_REQUIRED_ENV = [
  'POSTGRES_URL',
  'REVEALUI_SECRET',
  'REVEALUI_PUBLIC_SERVER_URL',
  'NEXT_PUBLIC_SERVER_URL',
] as const;

export function vercelDeployHref(githubHref: string, projectName: string): string {
  const url = new URL(VERCEL_CLONE_ORIGIN);
  url.searchParams.set('repository-url', githubHref);
  url.searchParams.set('project-name', projectName);
  url.searchParams.set('repository-name', projectName);
  url.searchParams.set('env', VERCEL_DEPLOY_REQUIRED_ENV.join(','));
  url.searchParams.set(
    'envDescription',
    'Your Postgres URL (Neon or any Postgres) and RevealUI runtime secrets. This is your Vercel project and your database.',
  );
  return url.toString();
}

export interface TemplateCatalogItem {
  readonly id: 'basic-blog' | 'e-commerce' | 'portfolio' | 'starter' | 'starter-native';
  readonly name: string;
  readonly stack: string;
  readonly body: string;
  readonly githubHref: string | null;
  readonly deployHref: string | null;
}

export const TEMPLATES_HERO = {
  title: 'Templates',
  subtitle:
    'Scaffold a RevealUI app from the published CLI, start from a GitHub template, or deploy a Next.js twin to your Vercel account.',
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
    deployHref: vercelDeployHref(
      'https://github.com/RevealUIStudio/revealui-template-basic-blog',
      'revealui-basic-blog',
    ),
  },
  {
    id: 'e-commerce',
    name: 'e-commerce',
    stack: 'Next.js 16 + @revealui/* + Stripe',
    body: 'Product catalog with checkout.',
    githubHref: 'https://github.com/RevealUIStudio/revealui-template-e-commerce',
    deployHref: vercelDeployHref(
      'https://github.com/RevealUIStudio/revealui-template-e-commerce',
      'revealui-e-commerce',
    ),
  },
  {
    id: 'portfolio',
    name: 'portfolio',
    stack: 'Next.js 16 + @revealui/*',
    body: 'Personal portfolio site.',
    githubHref: 'https://github.com/RevealUIStudio/revealui-template-portfolio',
    deployHref: vercelDeployHref(
      'https://github.com/RevealUIStudio/revealui-template-portfolio',
      'revealui-portfolio',
    ),
  },
  {
    id: 'starter',
    name: 'starter',
    stack: 'Next.js 16 + @revealui/*',
    body: 'Blank-canvas Next.js app, no sample collections.',
    githubHref: 'https://github.com/RevealUIStudio/revealui-template-starter',
    deployHref: vercelDeployHref(
      'https://github.com/RevealUIStudio/revealui-template-starter',
      'revealui-starter',
    ),
  },
  {
    id: 'starter-native',
    name: 'starter-native',
    stack: 'Vite + @revealui/router, no Next.js',
    body: 'RevealUI-native runtime. No GitHub Use this template twin.',
    githubHref: null,
    deployHref: null,
  },
] as const;

export const TEMPLATES_GITHUB = {
  heading: 'GitHub Use this template',
  body: 'Four Next.js templates have a public GitHub twin. starter-native does not.',
} as const;

export const TEMPLATES_VERCEL = {
  heading: 'Deploy to Vercel',
  body: 'The four Next.js GitHub twins can be cloned onto your Vercel account. You bring your own Neon or Postgres. This is the runtime deploy path, not a Studio SKU and not a Starter Kit. There is no live vercel.com/templates listing URL yet; owner submit is a dashboard step.',
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
