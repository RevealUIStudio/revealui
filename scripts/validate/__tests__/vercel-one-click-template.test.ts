import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const TEMPLATE_JSON = join(REPO_ROOT, 'deployment/vercel/template.json');
const VERCEL_JSON = join(REPO_ROOT, 'deployment/vercel/vercel.json');
const STARTER_VERCEL_JSON = join(REPO_ROOT, 'packages/cli/templates/starter/vercel.json');
const README = join(REPO_ROOT, 'deployment/vercel/README.md');
const OWNER_PUBLISH = join(REPO_ROOT, 'docs/distribution/VERCEL-TEMPLATE-OWNER-PUBLISH.md');
const CIRCUIT_R_MASTER = join(
  REPO_ROOT,
  'packages/presentation/src/assets/brand/revealui-logo.svg',
);

interface TemplateEnv {
  readonly key: string;
  readonly required: boolean;
}

interface TemplateStore {
  readonly type: string;
  readonly integrationSlug: string;
  readonly productSlug: string;
  readonly protocol: string;
}

interface TemplateMeta {
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly framework: string;
  readonly repositoryUrl: string;
  readonly projectName: string;
  readonly repositoryName: string;
  readonly envDescription: string;
  readonly envLink: string;
  readonly env: readonly TemplateEnv[];
  readonly stores: readonly TemplateStore[];
}

function loadMeta(): TemplateMeta {
  return JSON.parse(readFileSync(TEMPLATE_JSON, 'utf8')) as TemplateMeta;
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
  it('ships listing metadata, vercel.json, and the starter scaffold copy', () => {
    expect(existsSync(TEMPLATE_JSON)).toBe(true);
    expect(existsSync(VERCEL_JSON)).toBe(true);
    expect(existsSync(STARTER_VERCEL_JSON)).toBe(true);
    expect(existsSync(README)).toBe(true);
    expect(existsSync(OWNER_PUBLISH)).toBe(true);
  });

  it('points at the existing starter twin, not a new product', () => {
    const meta = loadMeta();
    expect(meta.name).toBe('RevealUI starter');
    expect(meta.slug).toBe('revealui-starter');
    expect(meta.framework).toBe('nextjs');
    expect(meta.repositoryUrl).toBe('https://github.com/RevealUIStudio/revealui-template-starter');
    expect(meta.projectName).toBe('revealui-starter');
    expect(meta.repositoryName).toBe('revealui-starter');
    expect(meta.envLink).toBe(
      'https://github.com/RevealUIStudio/revealui-template-starter/blob/main/.env.example',
    );
  });

  it('keeps buyer-account copy honest', () => {
    const meta = loadMeta();
    const readme = readFileSync(README, 'utf8');
    const leftover = readFileSync(OWNER_PUBLISH, 'utf8');
    const blob = `${meta.description}\n${meta.envDescription}\n${readme}\n${leftover}`;
    expect(meta.description.includes('your Vercel')).toBe(true);
    expect(meta.description.includes('Neon you control')).toBe(true);
    expect(meta.description.includes('Not managed hosting')).toBe(true);
    expect(meta.description.includes('Not the Starter Kit')).toBe(true);
    expect(meta.description.includes('Not a studio invoice')).toBe(true);
    expect(blob.includes('$299')).toBe(false);
    expect(blob.toLowerCase().includes('paying customers')).toBe(false);
    expect(blob.includes('SSO shipped')).toBe(false);
    expect(blob.includes('RevDev')).toBe(false);
    expect(blob.includes('RevForge')).toBe(false);
    expect(blob.includes('RevKit')).toBe(false);
    expect(blob.includes('vercel.com/templates/revealui')).toBe(false);
    expect(leftover.includes('owner dashboard')).toBe(true);
    expect(leftover.includes('do not invent a live listing URL')).toBe(true);
  });

  it('provisions Neon on the buyer account and prompts required runtime env', () => {
    const meta = loadMeta();
    expect(meta.stores).toEqual([
      {
        type: 'integration',
        integrationSlug: 'neon',
        productSlug: 'neon',
        protocol: 'storage',
      },
    ]);
    expect(meta.env.map((item) => item.key)).toEqual([
      'REVEALUI_SECRET',
      'REVEALUI_PUBLIC_SERVER_URL',
      'NEXT_PUBLIC_SERVER_URL',
      'REVEALUI_ADMIN_EMAIL',
      'REVEALUI_ADMIN_PASSWORD',
    ]);
    expect(meta.env.every((item) => item.required)).toBe(true);
    expect(meta.envDescription.includes('DATABASE_URL')).toBe(true);
    expect(meta.envDescription.includes('POSTGRES_URL')).toBe(true);
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
    expect(leftover.includes('revealui-logo.svg')).toBe(true);
    expect(leftover.includes('translate(256,256) scale(1.06) translate(-300,-320)')).toBe(true);
    expect(leftover.includes('No white plate')).toBe(true);
    expect(leftover.includes('No redraw')).toBe(true);
  });
});
