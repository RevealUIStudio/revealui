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
] as const;

function blob(): string {
  return JSON.stringify({
    hero: TEMPLATES_HERO,
    cli: TEMPLATES_CLI,
    items: TEMPLATES_CLI_ITEMS,
    github: TEMPLATES_GITHUB,
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
  });
});
