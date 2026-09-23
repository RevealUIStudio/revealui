#!/usr/bin/env tsx
/**
 * Marketing deploy lockstep (GAP-466).
 *
 * Test-branch marketing honesty is not customer-visible until the production
 * Deploy workflow on main finishes green for a commit that contains the
 * honesty surfaces. This check does not promote test to main.
 *
 *   pnpm validate:marketing-deploy-lockstep
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const PRODUCTION_DEPLOY_WORKFLOW = '.github/workflows/deploy.yml';
export const PRODUCTION_DEPLOY_BRANCH = 'main';
export const DECLARATION_REL = 'scripts/validate/marketing-deploy-lockstep.json';

/** Phrases that describe test honesty as already what customers see. */
export const VISIBILITY_CLAIM_PHRASES = [
  'marketing honesty is customer-visible',
  'customers can see this marketing honesty',
  'test honesty is live',
  'live site already shows test honesty',
  'customer-visible on production',
] as const;

/** A line that carries one of these markers is explaining the ban, not claiming it. */
export const VISIBILITY_EXONERATION = [
  'do not',
  'must not',
  'not customer-visible',
  'until main deploy',
  'not claimed',
] as const;

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'coverage', '.turbo']);

export interface SurfaceDigest {
  path: string;
  sha256: string;
}

export interface MainDeployReceipt {
  sha: string;
  conclusion: string;
  branch: string;
  workflowPath: string;
}

export interface OfferLockRecord {
  revealuiPr: number;
  agencyPr: number;
  onTest: boolean;
  onMain: boolean;
  note: string;
}

export interface LockstepDeclaration {
  version: 1;
  gap: 'GAP-466';
  customerVisible: boolean;
  botPromote: 'forbidden';
  offerLock: OfferLockRecord;
  honestySurfaces: readonly string[];
}

export interface VisibilityHit {
  file: string;
  line: number;
  text: string;
  phrase: string;
}

export interface LockstepEvaluation {
  ok: boolean;
  actuallyCustomerVisible: boolean;
  reasons: string[];
}

export function digestText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function surfacesMatch(
  head: readonly SurfaceDigest[],
  green: readonly SurfaceDigest[],
): boolean {
  if (head.length === 0 || head.length !== green.length) return false;
  const greenByPath = new Map(green.map((surface) => [surface.path, surface.sha256]));
  for (const surface of head) {
    if (greenByPath.get(surface.path) !== surface.sha256) return false;
  }
  return true;
}

export function isGreenMainDeploy(receipt: MainDeployReceipt | null): boolean {
  if (receipt === null) return false;
  return (
    receipt.conclusion === 'success' &&
    receipt.branch === PRODUCTION_DEPLOY_BRANCH &&
    receipt.workflowPath === PRODUCTION_DEPLOY_WORKFLOW &&
    receipt.sha.length > 0
  );
}

export function parseLatestDeployRun(body: unknown): MainDeployReceipt | null {
  if (typeof body !== 'object' || body === null) return null;
  const runs = (body as { workflow_runs?: unknown }).workflow_runs;
  if (!Array.isArray(runs) || runs.length === 0) return null;
  const first: unknown = runs[0];
  if (typeof first !== 'object' || first === null) return null;
  const record = first as {
    head_sha?: unknown;
    conclusion?: unknown;
    head_branch?: unknown;
    path?: unknown;
  };
  if (
    typeof record.head_sha !== 'string' ||
    typeof record.conclusion !== 'string' ||
    typeof record.head_branch !== 'string' ||
    typeof record.path !== 'string'
  ) {
    return null;
  }
  return {
    sha: record.head_sha,
    conclusion: record.conclusion,
    branch: record.head_branch,
    workflowPath: record.path,
  };
}

export function isBotPromoteAttempt(input: {
  actor: string;
  baseRef: string;
  headRef: string;
}): boolean {
  const actor = input.actor.toLowerCase();
  const bot =
    actor.endsWith('[bot]') ||
    actor.endsWith('-bot') ||
    actor === 'dependabot' ||
    actor === 'github-actions' ||
    actor === 'renovate';
  return bot && input.baseRef === PRODUCTION_DEPLOY_BRANCH && input.headRef === 'test';
}

export function lineClaimsCustomerVisibleHonesty(line: string): string | null {
  const lower = line.toLowerCase();
  if (VISIBILITY_EXONERATION.some((mark) => lower.includes(mark))) return null;
  for (const phrase of VISIBILITY_CLAIM_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  const mentionsHonesty =
    lower.includes('marketing honesty') ||
    lower.includes('test honesty') ||
    lower.includes('test-branch marketing');
  if (mentionsHonesty && lower.includes('customer-visible')) return 'customer-visible';
  return null;
}

export function findVisibilityClaims(file: string, content: string): VisibilityHit[] {
  const hits: VisibilityHit[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const phrase = lineClaimsCustomerVisibleHonesty(line);
    if (phrase === null) continue;
    hits.push({ file, line: i + 1, text: line.trim(), phrase });
  }
  return hits;
}

function walkFiles(dir: string, accept: (name: string) => boolean, out: string[]): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      walkFiles(full, accept, out);
      continue;
    }
    if (accept(name)) out.push(full);
  }
}

export function scanMarketingHonestyClaims(root: string): VisibilityHit[] {
  const files: string[] = [];
  walkFiles(join(root, 'docs'), (name) => name.endsWith('.md'), files);
  walkFiles(join(root, 'apps', 'marketing'), (name) => name.endsWith('.md'), files);
  walkFiles(
    join(root, 'apps', 'marketing', 'app', 'content'),
    (name) => name.endsWith('.ts') || name.endsWith('.tsx'),
    files,
  );
  const hits: VisibilityHit[] = [];
  for (const full of files) {
    let content: string;
    try {
      content = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const rel = relative(root, full).split('\\').join('/');
    hits.push(...findVisibilityClaims(rel, content));
  }
  return hits;
}

function isSafeRelativePath(value: string): boolean {
  if (value.length === 0 || value.startsWith('/') || value.includes('\\')) return false;
  const parts = value.split('/');
  return parts.every((part) => part.length > 0 && part !== '.' && part !== '..');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseDeclaration(raw: string): {
  declaration: LockstepDeclaration | null;
  errors: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { declaration: null, errors: ['marketing-deploy-lockstep.json is not valid JSON'] };
  }
  const errors: string[] = [];
  if (!isRecord(parsed)) {
    return { declaration: null, errors: ['declaration must be an object'] };
  }
  if (parsed.version !== 1) errors.push('version must be 1');
  if (parsed.gap !== 'GAP-466') errors.push('gap must be GAP-466');
  if (typeof parsed.customerVisible !== 'boolean') errors.push('customerVisible must be a boolean');
  if (parsed.botPromote !== 'forbidden') errors.push('botPromote must stay "forbidden"');
  if (!isRecord(parsed.offerLock)) {
    errors.push('offerLock must be an object');
  } else {
    if (typeof parsed.offerLock.revealuiPr !== 'number')
      errors.push('offerLock.revealuiPr must be a number');
    if (typeof parsed.offerLock.agencyPr !== 'number')
      errors.push('offerLock.agencyPr must be a number');
    if (typeof parsed.offerLock.onTest !== 'boolean')
      errors.push('offerLock.onTest must be a boolean');
    if (typeof parsed.offerLock.onMain !== 'boolean')
      errors.push('offerLock.onMain must be a boolean');
    if (typeof parsed.offerLock.note !== 'string' || parsed.offerLock.note.length === 0) {
      errors.push('offerLock.note must be a non-empty string');
    }
    if (parsed.offerLock.onMain === false && parsed.customerVisible === true) {
      errors.push(
        'Offer lock is not on main. Do not describe marketing honesty as customer-visible.',
      );
    }
  }
  const surfaces = parsed.honestySurfaces;
  if (!Array.isArray(surfaces) || surfaces.length === 0) {
    errors.push('honestySurfaces must be a non-empty list');
  } else {
    const seen = new Set<string>();
    for (const surface of surfaces) {
      if (typeof surface !== 'string' || !isSafeRelativePath(surface)) {
        errors.push(`honesty surface is not a safe relative path: ${String(surface)}`);
        continue;
      }
      if (seen.has(surface)) errors.push(`duplicate honesty surface: ${surface}`);
      seen.add(surface);
    }
  }
  if (errors.length > 0 || !isRecord(parsed.offerLock) || !Array.isArray(surfaces)) {
    return { declaration: null, errors };
  }
  const offer = parsed.offerLock;
  const declaration: LockstepDeclaration = {
    version: 1,
    gap: 'GAP-466',
    customerVisible: parsed.customerVisible === true,
    botPromote: 'forbidden',
    offerLock: {
      revealuiPr: typeof offer.revealuiPr === 'number' ? offer.revealuiPr : 0,
      agencyPr: typeof offer.agencyPr === 'number' ? offer.agencyPr : 0,
      onTest: offer.onTest === true,
      onMain: offer.onMain === true,
      note: typeof offer.note === 'string' ? offer.note : '',
    },
    honestySurfaces: surfaces.filter((surface): surface is string => typeof surface === 'string'),
  };
  return { declaration, errors };
}

export function hashSurfaces(
  root: string,
  paths: readonly string[],
): { surfaces: SurfaceDigest[]; missing: string[] } {
  const surfaces: SurfaceDigest[] = [];
  const missing: string[] = [];
  for (const rel of paths) {
    let text: string;
    try {
      text = readFileSync(join(root, rel), 'utf8');
    } catch {
      missing.push(rel);
      continue;
    }
    surfaces.push({ path: rel, sha256: digestText(text) });
  }
  return { surfaces, missing };
}

export function evaluateMarketingDeployLockstep(input: {
  customerVisible: boolean;
  botPromoteForbidden: boolean;
  botPromoteAttempt: boolean;
  headSurfaces: readonly SurfaceDigest[];
  greenSurfaces: readonly SurfaceDigest[] | null;
  deploy: MainDeployReceipt | null;
  visibilityClaims: readonly VisibilityHit[];
  missingSurfaces: readonly string[];
}): LockstepEvaluation {
  const reasons: string[] = [];
  if (input.botPromoteAttempt) {
    reasons.push(
      'Bot must not promote test to main. Owner promotes when live should match test honesty.',
    );
  }
  if (!input.botPromoteForbidden) {
    reasons.push('botPromote must stay "forbidden". This check does not promote.');
  }
  for (const missing of input.missingSurfaces) {
    reasons.push(`honesty surface missing: ${missing}`);
  }
  const green = isGreenMainDeploy(input.deploy);
  const matched =
    green && input.greenSurfaces !== null && surfacesMatch(input.headSurfaces, input.greenSurfaces);
  if (input.customerVisible && !matched) {
    reasons.push(
      'Marketing honesty is declared customer-visible, but main Deploy is not green for these honesty surfaces.',
    );
  }
  if (!matched) {
    for (const hit of input.visibilityClaims) {
      reasons.push(
        `${hit.file}:${hit.line} describes marketing honesty as customer-visible ("${hit.phrase}") before main Deploy is green.`,
      );
    }
  }
  return { ok: reasons.length === 0, actuallyCustomerVisible: matched, reasons };
}

export function readSurfaceAtGitSha(root: string, sha: string, rel: string): string | null {
  try {
    return execFileSync('git', ['show', `${sha}:${rel}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

interface FetchResult {
  receipt: MainDeployReceipt | null;
  error: string | null;
}

export async function fetchLatestGreenMainDeploy(token: string): Promise<FetchResult> {
  const url =
    'https://api.github.com/repos/RevealUIStudio/revealui/actions/workflows/deploy.yml/runs?branch=main&status=success&per_page=1';
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'revealui-marketing-deploy-lockstep',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'network error';
    return { receipt: null, error: `main Deploy lookup failed: ${message}` };
  }
  if (!response.ok) {
    return { receipt: null, error: `main Deploy lookup returned HTTP ${response.status}` };
  }
  const body: unknown = await response.json();
  const receipt = parseLatestDeployRun(body);
  if (receipt === null) {
    return { receipt: null, error: 'main Deploy lookup returned no successful run' };
  }
  if (!isGreenMainDeploy(receipt)) {
    return {
      receipt,
      error: 'latest listed Deploy run is not a green production deploy on main',
    };
  }
  return { receipt, error: null };
}

function repoRoot(): string {
  return join(import.meta.dirname, '..', '..');
}

/** Bracket access so CI env names stay out of turbo.json (this script is not a turbo task). */
function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value : '';
}

function invokedAsCli(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return (
    entry.endsWith('marketing-deploy-lockstep.ts') || entry.endsWith('marketing-deploy-lockstep.js')
  );
}

async function main(): Promise<void> {
  const root = repoRoot();
  const raw = readFileSync(join(root, DECLARATION_REL), 'utf8');
  const parsed = parseDeclaration(raw);
  const reasons = [...parsed.errors];
  if (parsed.declaration === null) {
    report(false, reasons);
    return;
  }
  const declaration = parsed.declaration;
  const hashed = hashSurfaces(root, declaration.honestySurfaces);
  const claims = scanMarketingHonestyClaims(root);
  const botPromoteAttempt = isBotPromoteAttempt({
    actor: readEnv('GITHUB_ACTOR'),
    baseRef: readEnv('GITHUB_BASE_REF'),
    headRef: readEnv('GITHUB_HEAD_REF'),
  });

  let deploy: MainDeployReceipt | null = null;
  let greenSurfaces: SurfaceDigest[] | null = null;
  if (declaration.customerVisible) {
    const githubToken = readEnv('GITHUB_TOKEN');
    const token = githubToken.length > 0 ? githubToken : readEnv('GH_TOKEN');
    if (token.length === 0) {
      reasons.push(
        'customerVisible is true but no GITHUB_TOKEN is set, so main Deploy cannot be shown green.',
      );
    } else {
      const lookedUp = await fetchLatestGreenMainDeploy(token);
      if (lookedUp.error !== null) reasons.push(lookedUp.error);
      deploy = lookedUp.receipt;
      if (lookedUp.receipt !== null && isGreenMainDeploy(lookedUp.receipt)) {
        const atSha: SurfaceDigest[] = [];
        for (const rel of declaration.honestySurfaces) {
          const text = readSurfaceAtGitSha(root, lookedUp.receipt.sha, rel);
          if (text === null) {
            reasons.push(
              `honesty surface ${rel} is not in green Deploy sha ${lookedUp.receipt.sha}`,
            );
            continue;
          }
          atSha.push({ path: rel, sha256: digestText(text) });
        }
        if (atSha.length === declaration.honestySurfaces.length) greenSurfaces = atSha;
      }
    }
  }

  const verdict = evaluateMarketingDeployLockstep({
    customerVisible: declaration.customerVisible,
    botPromoteForbidden: declaration.botPromote === 'forbidden',
    botPromoteAttempt,
    headSurfaces: hashed.surfaces,
    greenSurfaces,
    deploy,
    visibilityClaims: claims,
    missingSurfaces: hashed.missing,
  });
  report(
    verdict.ok && reasons.length === 0,
    [...reasons, ...verdict.reasons],
    verdict.actuallyCustomerVisible,
  );
}

function report(ok: boolean, reasons: string[], actuallyCustomerVisible = false): void {
  console.log('\n================================================================');
  console.log('  Marketing deploy lockstep (GAP-466)');
  console.log('================================================================');
  if (ok) {
    console.log(
      actuallyCustomerVisible
        ? '  OK: honesty surfaces match a green production Deploy on main'
        : '  OK: marketing honesty is not described as customer-visible',
    );
    console.log('  Bot promote remains forbidden. This check does not promote.');
    console.log('================================================================\n');
    process.exit(0);
  }
  for (const reason of reasons) {
    console.log(`  FAIL: ${reason}`);
  }
  console.log('================================================================\n');
  process.exit(1);
}

if (invokedAsCli()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'lockstep check failed';
    console.log(`  FAIL: ${message}`);
    process.exit(1);
  });
}
