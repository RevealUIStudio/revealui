import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  VERCEL_DEPLOY_REQUIRED_ENV,
  vercelDeployHref,
} from '../../../apps/marketing/app/content/templates';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const TEMPLATES_JSON = join(REPO_ROOT, 'deployment/vercel/templates.json');
const RETIRED_TEMPLATE_JSON = join(REPO_ROOT, 'deployment/vercel/template.json');
const RETIRED_MARKETING_HELPER = join(REPO_ROOT, 'apps/marketing/app/content/vercel-one-click.ts');
const VERCEL_JSON = join(REPO_ROOT, 'deployment/vercel/vercel.json');
const STARTER_VERCEL_JSON = join(REPO_ROOT, 'packages/cli/templates/starter/vercel.json');
const README = join(REPO_ROOT, 'deployment/vercel/README.md');
const DEPLOY_BUTTON = join(REPO_ROOT, 'deployment/vercel/deploy-button.md');
const OWNER_PUBLISH = join(REPO_ROOT, 'docs/distribution/VERCEL-TEMPLATE-OWNER-PUBLISH.md');
const CIRCUIT_R_MASTER = join(
  REPO_ROOT,
  'packages/presentation/src/assets/brand/revealui-logo.svg',
);

const REQUIRED_ENV = [
  'POSTGRES_URL',
  'REVEALUI_SECRET',
  'REVEALUI_PUBLIC_SERVER_URL',
  'NEXT_PUBLIC_SERVER_URL',
] as const;

interface TemplateRow {
  readonly id: string;
  readonly githubUrl: string;
  readonly projectName: string;
  readonly cliTemplate: string;
}

interface TemplatesManifest {
  readonly listingStatus: string;
  readonly listingUrl: string | null;
  readonly submitUrl: string;
  readonly ownerGuide: string;
  readonly requiredEnv: readonly string[];
  readonly templates: readonly TemplateRow[];
}

function loadManifest(): TemplatesManifest {
  return JSON.parse(readFileSync(TEMPLATES_JSON, 'utf8')) as TemplatesManifest;
}

function loadVercelJson(path: string): {
  framework?: string;
  installCommand?: string;
  buildCommand?: string;
} {
  return JSON.parse(readFileSync(path, 'utf8')) as {
    framework?: string;
    installCommand?: string;
    buildCommand?: string;
  };
}

describe('Vercel one-click template listing', () => {
  it('ships official submit metadata, vercel.json, and the starter scaffold copy', () => {
    expect(existsSync(TEMPLATES_JSON)).toBe(true);
    expect(existsSync(VERCEL_JSON)).toBe(true);
    expect(existsSync(STARTER_VERCEL_JSON)).toBe(true);
    expect(existsSync(README)).toBe(true);
    expect(existsSync(DEPLOY_BUTTON)).toBe(true);
    expect(existsSync(OWNER_PUBLISH)).toBe(true);
  });

  it('does not keep the retired Neon-stores listing files', () => {
    expect(existsSync(RETIRED_TEMPLATE_JSON)).toBe(false);
    expect(existsSync(RETIRED_MARKETING_HELPER)).toBe(false);
  });

  it('points at the existing starter twin, not a new product', () => {
    const starter = loadManifest().templates.find((row) => row.id === 'starter');
    expect(starter).toBeDefined();
    expect(starter?.githubUrl).toBe('https://github.com/RevealUIStudio/revealui-template-starter');
    expect(starter?.projectName).toBe('revealui-starter');
    expect(starter?.cliTemplate).toBe('starter');
  });

  it('keeps buyer-account copy honest', () => {
    const manifest = loadManifest();
    const readme = readFileSync(README, 'utf8');
    const leftover = readFileSync(OWNER_PUBLISH, 'utf8');
    const listing = `${JSON.stringify(manifest)}\n${readme}`;
    expect(readme.includes('their Vercel')).toBe(true);
    expect(readme.includes('POSTGRES_URL')).toBe(true);
    expect(readme.includes('does **not** provision Neon through Vercel `stores`')).toBe(true);
    expect(listing.includes('Not a Starter Kit') || listing.includes('not a Starter Kit')).toBe(
      true,
    );
    expect(listing.includes('$299')).toBe(false);
    expect(listing.toLowerCase().includes('paying customers')).toBe(false);
    expect(listing.includes('SSO shipped')).toBe(false);
    expect(listing.includes('RevDev')).toBe(false);
    expect(listing.includes('RevForge')).toBe(false);
    expect(listing.includes('RevKit')).toBe(false);
    expect(manifest.listingUrl).toBeNull();
    expect(manifest.listingStatus).toBe('not-published');
    expect(leftover.includes('owner dashboard')).toBe(true);
    expect(leftover.includes('Do not invent a')).toBe(true);
    expect(leftover.includes('listing URL')).toBe(true);
    expect(leftover.includes('Do not add Neon or Blob `stores`')).toBe(true);
  });

  it('requires paste-own Postgres and does not provision Neon or Blob stores', () => {
    const manifest = loadManifest();
    const deployButton = readFileSync(DEPLOY_BUTTON, 'utf8');
    const readme = readFileSync(README, 'utf8');
    expect(manifest.requiredEnv).toEqual([...REQUIRED_ENV]);
    expect(VERCEL_DEPLOY_REQUIRED_ENV).toEqual([...REQUIRED_ENV]);
    expect(Object.hasOwn(manifest, 'stores')).toBe(false);
    expect(JSON.stringify(manifest).includes('integrationSlug')).toBe(false);
    expect(deployButton.includes('stores=')).toBe(false);
    expect(deployButton.includes('POSTGRES_URL')).toBe(true);
    expect(deployButton.includes('REVEALUI_ADMIN_EMAIL')).toBe(false);
    expect(readme.includes('REVEALUI_ADMIN_EMAIL')).toBe(false);
    expect(readme.includes('DATABASE_URL')).toBe(false);

    const starter = manifest.templates.find((row) => row.id === 'starter');
    expect(starter).toBeDefined();
    const href = vercelDeployHref(starter?.githubUrl ?? '', starter?.projectName ?? '');
    const deploy = new URL(href);
    expect(deploy.searchParams.get('env')).toBe(REQUIRED_ENV.join(','));
    expect(deploy.searchParams.has('stores')).toBe(false);
    expect(href.includes('stores=')).toBe(false);
  });

  it('keeps starter vercel.json lockstep with the listing file', () => {
    const listing = loadVercelJson(VERCEL_JSON);
    const starter = loadVercelJson(STARTER_VERCEL_JSON);
    expect(listing.framework).toBe('nextjs');
    expect(listing.installCommand).toBe('pnpm install');
    expect(listing.buildCommand).toBe('pnpm build');
    expect(starter).toEqual(listing);
  });

  it('points Circuit-R leftover at the locked navy master, not a redraw', () => {
    const leftover = readFileSync(OWNER_PUBLISH, 'utf8');
    expect(existsSync(CIRCUIT_R_MASTER)).toBe(true);
    const master = readFileSync(CIRCUIT_R_MASTER, 'utf8');
    expect(master.includes('translate(256,256) scale(1.06) translate(-300,-320)')).toBe(true);
    expect(leftover.includes('Circuit-R')).toBe(true);
    expect(leftover.includes('navy letter, scythe, empty bowl')).toBe(true);
    expect(leftover.includes('white plate')).toBe(true);
    expect(leftover.includes('Do not invent')).toBe(true);
  });
});
