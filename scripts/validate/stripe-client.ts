#!/usr/bin/env tsx

/**
 * Stripe-Client Consolidation Validator (GAP-131)
 *
 * Enforces that the only place in the suite that instantiates `new Stripe(...)`
 * is the canonical `protectedStripe` wrapper at
 * `packages/services/src/stripe/stripeClient.ts`.
 *
 * Rationale: every consumer-side `new Stripe(...)` bypasses the DB-backed
 * circuit breaker, retry policy, and single API-version pin that
 * `protectedStripe` provides. Six factories were consolidated in GAP-131; this
 * gate prevents reintroduction.
 *
 * Allowlist:
 *   - `packages/services/src/stripe/stripeClient.ts` — the canonical wrapper
 *
 * Excluded paths:
 *   - `**\/__tests__/**`, `**\/*.test.ts`, `**\/*.test.tsx` (tests mock Stripe)
 *   - `**\/dist/**`, `**\/build/**`, `**\/.next/**`, `**\/node_modules/**`
 *   - `**\/coverage/**`, `**\/.turbo/**`
 *
 * Mirrors the pattern used by `validate/empty-catch.ts` /
 * `validate/raw-sql.ts` — fast file-walk + regex check, hard-fail on
 * unauthorised match.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

const ALLOWED_FILES = new Set<string>([
  // Canonical wrapper — the only legitimate `new Stripe(...)` site
  ['packages', 'services', 'src', 'stripe', 'stripeClient.ts'].join(sep),
  // The validator script itself references the literal string in its rule.
  ['scripts', 'validate', 'stripe-client.ts'].join(sep),
]);

const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '__tests__',
]);

function isExcludedDir(name: string): boolean {
  return EXCLUDED_DIR_NAMES.has(name);
}

function isExcludedFile(rel: string): boolean {
  if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) return true;
  if (rel.endsWith('.d.ts')) return true;
  return false;
}

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (isExcludedDir(entry)) continue;
    const full = join(dir, entry);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (st.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
      yield full;
    }
  }
}

interface Violation {
  file: string;
  line: number;
  text: string;
}

function checkFile(absPath: string): Violation[] {
  const rel = relative(ROOT, absPath);
  if (isExcludedFile(rel)) return [];
  if (ALLOWED_FILES.has(rel)) return [];

  let raw: string;
  try {
    raw = readFileSync(absPath, 'utf8');
  } catch {
    return [];
  }
  if (!raw.includes('new Stripe(')) return [];

  const violations: Violation[] = [];
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    // Comment-only lines that mention "new Stripe(" are ignored.
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }
    if (line.includes('new Stripe(')) {
      violations.push({ file: rel, line: i + 1, text: line.trim() });
    }
  }
  return violations;
}

function main(): void {
  const targetRoots = [join(ROOT, 'apps'), join(ROOT, 'packages'), join(ROOT, 'scripts')];

  const violations: Violation[] = [];
  for (const root of targetRoots) {
    let st: ReturnType<typeof statSync> | undefined;
    try {
      st = statSync(root);
    } catch {
      continue;
    }
    if (!st?.isDirectory()) continue;
    for (const file of walk(root)) {
      violations.push(...checkFile(file));
    }
  }

  if (violations.length === 0) {
    process.stdout.write(
      '[validate:stripe-client] OK — only the canonical protectedStripe wrapper instantiates Stripe.\n',
    );
    process.exit(0);
  }

  process.stderr.write(
    `\n[validate:stripe-client] FAIL — ${violations.length} unauthorised \`new Stripe(\` site(s) detected.\n\n`,
  );
  process.stderr.write(
    'Every consumer must use \`protectedStripe\` from \`@revealui/services\` (DB-backed\n' +
      'circuit breaker + retry + single API-version pin). The only legitimate site\n' +
      'is the canonical wrapper at packages/services/src/stripe/stripeClient.ts.\n\n' +
      'See GAP-131 for context. Migrate the offending site(s) to:\n\n' +
      "    import { protectedStripe } from '@revealui/services';\n\n",
  );
  for (const v of violations) {
    process.stderr.write(`  ${v.file}:${v.line}\n    ${v.text}\n`);
  }
  process.stderr.write('\n');
  process.exit(1);
}

main();
