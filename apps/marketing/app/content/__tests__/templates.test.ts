/**
 * Honesty gate for /templates. Pins the live CLI list, GitHub twins,
 * Apify pay-per-event prices, and the dead-link denylist.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CREATE_REVEALUI_NPM_VERSION,
  TEMPLATES_APIFY,
  TEMPLATES_CLI,
  TEMPLATES_CLI_ITEMS,
  TEMPLATES_GITHUB,
  TEMPLATES_HERO,
  TEMPLATES_VERCEL,
  VERCEL_DEPLOY_REQUIRED_ENV,
  VERCEL_TEMPLATES_LISTING_URL,
  vercelDeployHref,
} from '../templates';

const CREATE_REVEALUI_PKG = JSON.parse(
  readFileSync(join(process.cwd(), '../../packages/create-revealui/package.json'), 'utf8'),
) as { version: string };

const CLI_PROMPTS = readFileSync(
  join(process.cwd(), '../../packages/cli/src/prompts/project.ts'),
  'utf8',
);

const FORBIDDEN = [
  'Railway',
  'PikaPods',
  'Elest.io',
  'RevDev',
  'RevForge',
  'RevKit',
  'Agency Founding Kit',
  'Written plan',
  'Architecture Review',
  'cal.com',
  'verify is free',
  'verify is Free',
  'Starter Kit $299',
] as const;

function blob(): string {
  return JSON.stringify({
    hero: TEMPLATES_HERO,
    cli: TEMPLATES_CLI,
    items: TEMPLATES_CLI_ITEMS,
    github: TEMPLATES_GITHUB,
    vercel: TEMPLATES_VERCEL,
    apify: TEMPLATES_APIFY,
  });
}

describe('templates catalog honesty', () => {
  it('pins create-revealui npm 0.5.22 and the published CLI command', () => {
    expect(CREATE_REVEALUI_PKG.version).toBe('0.5.22');
    expect(CREATE_REVEALUI_NPM_VERSION).toBe(CREATE_REVEALUI_PKG.version);
    expect(TEMPLATES_CLI.command).toBe('npx create-revealui@latest');
    expect(TEMPLATES_CLI.body.includes('0.5.22')).toBe(true);
    expect(TEMPLATES_CLI.body.includes(CREATE_REVEALUI_NPM_VERSION)).toBe(true);
  });

  it('lists the five shipped CLI templates in registry order', () => {
    const shipped = readdirSync(join(process.cwd(), '../../packages/cli/templates'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort();
    expect(shipped).toEqual(['basic-blog', 'e-commerce', 'portfolio', 'starter', 'starter-native']);
    expect(TEMPLATES_CLI_ITEMS.map((item) => item.id)).toEqual([
      'basic-blog',
      'e-commerce',
      'portfolio',
      'starter',
      'starter-native',
    ]);
    expect(CLI_PROMPTS.includes("'starter-native'")).toBe(true);
  });

  it('gives GitHub Use this template twins to the four Next.js templates only', () => {
    const withGithub = TEMPLATES_CLI_ITEMS.filter((item) => item.githubHref !== null);
    const withoutGithub = TEMPLATES_CLI_ITEMS.filter((item) => item.githubHref === null);
    expect(withGithub.map((item) => item.id)).toEqual([
      'basic-blog',
      'e-commerce',
      'portfolio',
      'starter',
    ]);
    expect(withoutGithub.map((item) => item.id)).toEqual(['starter-native']);
    expect(withGithub.map((item) => item.githubHref)).toEqual([
      'https://github.com/RevealUIStudio/revealui-template-basic-blog',
      'https://github.com/RevealUIStudio/revealui-template-e-commerce',
      'https://github.com/RevealUIStudio/revealui-template-portfolio',
      'https://github.com/RevealUIStudio/revealui-template-starter',
    ]);
    expect(TEMPLATES_GITHUB.body.includes('starter-native')).toBe(true);
    expect(TEMPLATES_GITHUB.body.includes('does not')).toBe(true);
  });

  it('gives Deploy to Vercel clone URLs to the four Next.js GitHub twins only', () => {
    const withDeploy = TEMPLATES_CLI_ITEMS.filter((item) => item.deployHref !== null);
    const withoutDeploy = TEMPLATES_CLI_ITEMS.filter((item) => item.deployHref === null);
    expect(withDeploy.map((item) => item.id)).toEqual([
      'basic-blog',
      'e-commerce',
      'portfolio',
      'starter',
    ]);
    expect(withoutDeploy.map((item) => item.id)).toEqual(['starter-native']);
    for (const item of withDeploy) {
      expect(item.githubHref).toBeTruthy();
      expect(item.deployHref).toBe(
        vercelDeployHref(item.githubHref as string, `revealui-${item.id}`),
      );
      const deploy = new URL(item.deployHref as string);
      expect(`${deploy.origin}${deploy.pathname}`).toBe('https://vercel.com/new/clone');
      expect(deploy.searchParams.get('repository-url')).toBe(item.githubHref);
      expect(deploy.searchParams.get('env')?.includes('POSTGRES_URL')).toBe(true);
      expect(deploy.searchParams.has('stores')).toBe(false);
    }
    expect(VERCEL_DEPLOY_REQUIRED_ENV).toEqual([
      'POSTGRES_URL',
      'REVEALUI_SECRET',
      'REVEALUI_PUBLIC_SERVER_URL',
      'NEXT_PUBLIC_SERVER_URL',
    ]);
  });

  it('does not invent a live vercel.com/templates listing URL', () => {
    expect(VERCEL_TEMPLATES_LISTING_URL).toBeNull();
    expect(TEMPLATES_VERCEL.body.includes('no live')).toBe(true);
    expect(TEMPLATES_VERCEL.body.includes('owner submit')).toBe(true);
    expect(blob().includes('vercel.com/templates/revealui')).toBe(false);
    expect(blob().includes('vercel.com/templates/template/')).toBe(false);
  });

  it('names the Vercel path as the runtime deploy, not a Studio SKU', () => {
    expect(TEMPLATES_VERCEL.body.includes('runtime deploy path')).toBe(true);
    expect(TEMPLATES_VERCEL.body.includes('not a Studio SKU')).toBe(true);
    expect(TEMPLATES_VERCEL.body.includes('not a Starter Kit')).toBe(true);
    expect(TEMPLATES_VERCEL.body.includes('your own Neon or Postgres')).toBe(true);
    expect(TEMPLATES_HERO.subtitle.includes('Vercel')).toBe(true);
  });

  it('names starter-native as Vite without Next.js', () => {
    const native = TEMPLATES_CLI_ITEMS.find((item) => item.id === 'starter-native');
    expect(native).toBeDefined();
    expect(native?.stack.includes('Vite')).toBe(true);
    expect(native?.stack.includes('Next.js')).toBe(true);
    expect(native?.stack.includes('no Next.js')).toBe(true);
  });

  it('prints Apify pay-per-event prices and does not call verify free', () => {
    expect(TEMPLATES_APIFY.href).toBe('https://apify.com/revealuistudio/governed-agent-run');
    expect(TEMPLATES_APIFY.body.includes('$0.02')).toBe(true);
    expect(TEMPLATES_APIFY.body.includes('$0.08')).toBe(true);
    expect(TEMPLATES_APIFY.body.includes('$0.00001')).toBe(true);
    expect(TEMPLATES_APIFY.body.includes('not free')).toBe(true);
    expect(TEMPLATES_APIFY.body.includes('free.')).toBe(true);
    expect(TEMPLATES_APIFY.body.toLowerCase().includes('verify is free')).toBe(false);
  });

  it('lists /templates in the public sitemap', () => {
    const sitemap = readFileSync(join(process.cwd(), 'public/sitemap.xml'), 'utf8');
    expect(sitemap.includes('https://revealui.com/templates')).toBe(true);
  });

  it('does not revive dead hosts, kits, or SKU names', () => {
    const text = blob();
    for (const phrase of FORBIDDEN) {
      expect(text.includes(phrase), `templates copy must not include ${phrase}`).toBe(false);
    }
    expect(text.includes('Fleet $')).toBe(false);
    expect(text.includes('$25,000')).toBe(false);
    expect(text.includes('$8,499')).toBe(false);
    expect(text.includes('$299')).toBe(false);
    expect(text.includes('SSO')).toBe(false);
    expect(text.includes('paying customers')).toBe(false);
    expect(text.includes('RevDev')).toBe(false);
    expect(text.includes('RevForge')).toBe(false);
    expect(text.includes('RevKit')).toBe(false);
  });

  it('locksteps the owner-submit manifest to the four GitHub twins', () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), '../../deployment/vercel/templates.json'), 'utf8'),
    ) as {
      listingStatus: string;
      listingUrl: string | null;
      submitUrl: string;
      ownerGuide: string;
      requiredEnv: readonly string[];
      templates: readonly { id: string; githubUrl: string; cliTemplate: string }[];
    };
    expect(manifest.listingStatus).toBe('not-published');
    expect(manifest.listingUrl).toBeNull();
    expect(manifest.submitUrl).toBe('https://vercel.com/templates/submit');
    expect(manifest.ownerGuide).toBe('docs/distribution/VERCEL-TEMPLATE-OWNER-PUBLISH.md');
    expect(manifest.requiredEnv).toEqual([...VERCEL_DEPLOY_REQUIRED_ENV]);
    expect(manifest.templates.map((item) => item.id)).toEqual([
      'basic-blog',
      'e-commerce',
      'portfolio',
      'starter',
    ]);
    const withGithub = TEMPLATES_CLI_ITEMS.filter((item) => item.githubHref !== null);
    expect(manifest.templates.map((item) => item.githubUrl)).toEqual(
      withGithub.map((item) => item.githubHref),
    );
    expect(manifest.templates.every((item) => item.cliTemplate === item.id)).toBe(true);
  });
});
