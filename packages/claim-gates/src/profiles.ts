import fs from 'node:fs';
import path from 'node:path';
import type { ClaimProfileName } from './types.js';

/**
 * Minimal Phase 1 profiles. Fleet YAML loading lands in Phase 2; until then
 * hardcode product-runtime for the revealui monorepo shape.
 */
export interface ClaimProfile {
  readonly name: ClaimProfileName;
  readonly description: string;
}

export const PROFILES: Readonly<Record<ClaimProfileName, ClaimProfile>> = {
  'product-runtime': {
    name: 'product-runtime',
    description: 'Full revealui monorepo claim-drift (metrics, docs, marketing, license gates).',
  },
  'marketing-site': {
    name: 'marketing-site',
    description: 'Agency / marketing-site surfaces (Phase 2 enablement).',
  },
  'product-readme': {
    name: 'product-readme',
    description: 'Sibling product README and top-level claim surfaces (Phase 2).',
  },
};

/**
 * Heuristic default: monorepo with apps/ + packages/ and marketing claims
 * evidence → product-runtime; otherwise product-readme.
 */
export function resolveProfile(root: string, explicit?: ClaimProfileName): ClaimProfileName {
  if (explicit) return explicit;
  const apps = path.join(root, 'apps');
  const packages = path.join(root, 'packages');
  const marketingClaims = path.join(root, 'apps/marketing/app/content/claims-evidence.ts');
  if (
    fs.existsSync(apps) &&
    fs.existsSync(packages) &&
    (fs.existsSync(marketingClaims) || fs.existsSync(path.join(root, 'pnpm-workspace.yaml')))
  ) {
    return 'product-runtime';
  }
  return 'product-readme';
}

export function getProfile(name: ClaimProfileName): ClaimProfile {
  return PROFILES[name];
}
