import fs from 'node:fs';
import path from 'node:path';
import type { ClaimProfileName } from './types.js';

/**
 * Per-profile scan roots and scanner switches (GAP-462 Phase 2).
 * product-runtime preserves revealui claim-drift parity.
 */

export interface ClaimProfile {
  readonly name: ClaimProfileName;
  readonly description: string;
  /** Collect monorepo metric counts (packages, MCP, tables, …). */
  readonly collectMonorepoMetrics: boolean;
  /** Run license-membership / phantom / incomplete-pro / split-anti scanners. */
  readonly licenseScanners: boolean;
  /** Run site.ts METRICS drift check. */
  readonly marketingMetrics: boolean;
  readonly scanDirs: readonly string[];
  readonly licenseScanRoots: readonly string[];
  readonly futureTenseFiles: readonly string[];
  readonly aspirationalPaths: readonly string[];
  readonly fleetAttributionFiles: readonly string[];
  /** When true, missing scan-dir entries are skipped instead of hard-fail. */
  readonly softScanDirs: boolean;
}

const PRODUCT_RUNTIME: ClaimProfile = {
  name: 'product-runtime',
  description: 'Full revealui monorepo claim-drift (metrics, docs, marketing, license gates).',
  collectMonorepoMetrics: true,
  licenseScanners: true,
  marketingMetrics: true,
  softScanDirs: false,
  scanDirs: [
    'docs',
    'apps/marketing/app',
    'apps/marketing/public/llms.txt',
    'apps/docs/public/docs-pro',
    'apps/docs/public/llms.txt',
    'README.md',
    'CLAUDE.md',
    'CONTRIBUTING.md',
    'scripts/setup',
    'packages/mcp/README.md',
    'packages/mcp/docs',
  ],
  licenseScanRoots: [
    'docs',
    'apps/marketing/app',
    // Hand-authored public docs only. Do NOT scan a materialize mirror of
    // monorepo docs/ under apps/docs/public/ (ADR 2026-07-29 virtual serve).
    'apps/docs/public/docs-pro',
    'apps/docs/public/llms.txt',
    'README.md',
    'CLAUDE.md',
    'CONTRIBUTING.md',
    '.syncpackrc.json',
    'scripts',
    'packages',
  ],
  futureTenseFiles: ['README.md', 'CLAUDE.md', 'docs/ROADMAP.md', 'docs/PRO.md'],
  aspirationalPaths: [
    'apps/marketing/app/components/landing',
    'apps/marketing/app/components/GetStarted.tsx',
    'docs/INDEX.md',
    'docs/BUILD_YOUR_BUSINESS.md',
    'docs/EXAMPLES.md',
    'docs/QUICK_START.md',
    'docs/FLEET.md',
    'apps/docs/public/docs-pro/index.md',
    'apps/docs/public/docs-pro/ai/index.md',
    'apps/docs/public/docs-pro/inference/index.md',
    'apps/docs/public/docs-pro/mcp/index.md',
    'apps/docs/public/docs-pro/editors/index.md',
    'docs/blog',
  ],
  fleetAttributionFiles: [
    'docs/BUILD_YOUR_BUSINESS.md',
    'docs/EXAMPLES.md',
    'docs/QUICK_START.md',
    'apps/docs/public/docs-pro/mcp/index.md',
  ],
};

const MARKETING_SITE: ClaimProfile = {
  name: 'marketing-site',
  description: 'Agency / marketing-site surfaces (no monorepo metrics).',
  collectMonorepoMetrics: false,
  licenseScanners: false,
  marketingMetrics: false,
  softScanDirs: true,
  scanDirs: ['app', 'README.md'],
  licenseScanRoots: ['README.md', 'app'],
  futureTenseFiles: ['README.md'],
  aspirationalPaths: ['app'],
  // Fleet-product attribution rules are tuned for revealui docs (/docs/FLEET).
  // Agency intentionally names Studio/Rev* products in About and legal copy;
  // enable a dedicated agency allowlist before turning this on hard-fail.
  fleetAttributionFiles: [],
};

const PRODUCT_README: ClaimProfile = {
  name: 'product-readme',
  description: 'Sibling product README and top-level docs (no revealui metrics).',
  collectMonorepoMetrics: false,
  licenseScanners: false,
  marketingMetrics: false,
  softScanDirs: true,
  scanDirs: ['README.md', 'CLAUDE.md', 'docs'],
  licenseScanRoots: ['README.md', 'CLAUDE.md', 'docs'],
  futureTenseFiles: ['README.md', 'CLAUDE.md'],
  aspirationalPaths: ['README.md', 'docs'],
  // Fleet-product attribution is for revealui public docs that might present
  // Studio/Rev* as if they were the runtime. Sibling product repos (revdev,
  // revvault, …) intentionally name peer fleet products in README and docs;
  // hard-fail attribution there is false-positive noise (126+ hits on revdev
  // alone). Same v1 choice as marketing-site.
  fleetAttributionFiles: [],
};

export const PROFILES: Readonly<Record<ClaimProfileName, ClaimProfile>> = {
  'product-runtime': PRODUCT_RUNTIME,
  'marketing-site': MARKETING_SITE,
  'product-readme': PRODUCT_README,
};

/**
 * Heuristic default: monorepo with apps/ + packages/ and marketing claims
 * evidence → product-runtime; agency-shaped (app/ + no packages/) → marketing-site;
 * otherwise product-readme.
 */
export function resolveProfile(root: string, explicit?: ClaimProfileName): ClaimProfileName {
  if (explicit) return explicit;
  const apps = path.join(root, 'apps');
  const packages = path.join(root, 'packages');
  const marketingClaims = path.join(root, 'apps/marketing/app/content/claims-evidence.ts');
  const agencyApp = path.join(root, 'app');
  if (
    fs.existsSync(apps) &&
    fs.existsSync(packages) &&
    (fs.existsSync(marketingClaims) || fs.existsSync(path.join(root, 'pnpm-workspace.yaml')))
  ) {
    return 'product-runtime';
  }
  if (fs.existsSync(agencyApp) && !fs.existsSync(packages)) {
    return 'marketing-site';
  }
  return 'product-readme';
}

export function getProfile(name: ClaimProfileName): ClaimProfile {
  return PROFILES[name];
}

/** Paths under root that exist (files or dirs). */
export function existingRoots(root: string, candidates: readonly string[]): string[] {
  const out: string[] = [];
  for (const rel of candidates) {
    const full = path.join(root, rel);
    try {
      const st = fs.statSync(full);
      if (st.isFile() || st.isDirectory()) out.push(rel);
    } catch {
      // skip missing
    }
  }
  return out;
}
