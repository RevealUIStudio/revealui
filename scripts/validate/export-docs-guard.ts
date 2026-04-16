/**
 * Export → Docs Guard
 *
 * When a PR changes any `packages/*\/src/index.ts` barrel in a way that
 * REMOVES an exported name, require a corresponding change somewhere
 * under `docs/` in the same diff. This is the "public API rename or
 * removal must ship with a docs update" rule from MASTER_PLAN §4.19
 * Phase C.
 *
 * Usage:
 *   pnpm validate:export-docs                  # default base: origin/test
 *   pnpm validate:export-docs --base <ref>
 *   pnpm validate:export-docs --json
 *
 * Exit codes:
 *   0 = no export removals, OR removals are paired with docs changes
 *   1 = exports removed without any docs/ changes in the same diff
 *
 * Design notes:
 * - Compares the barrel at `<base>` vs working tree using
 *   `git show <base>:<file>`, not the staged index. This is the behavior
 *   you want for a pre-push / CI check — the base is the thing you're
 *   merging INTO.
 * - Parses exports with the TS compiler (`export { ... }`, `export function`,
 *   `export const`, `export class`, etc.) so cosmetic reformats don't
 *   trigger false positives.
 * - Intentionally scoped to top-level barrels. Deep reorganisations
 *   inside a package are the package author's concern; the user-facing
 *   contract is what leaves via index.ts.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '../..');

interface GuardResult {
  base: string;
  changedBarrels: string[];
  removedByFile: Record<string, string[]>;
  hasDocsChange: boolean;
  docsChangedFiles: string[];
  verdict: 'pass' | 'fail';
}

function git(args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const e = err as { stderr?: Buffer | string };
    const stderr = typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString('utf8') ?? '');
    throw new Error(`git ${args.join(' ')} failed: ${stderr.trim()}`);
  }
}

function resolveBase(explicit: string | undefined): string {
  if (explicit) return explicit;
  // Prefer origin/test (the repo's PR target); fall back to origin/main.
  for (const candidate of ['origin/test', 'origin/main']) {
    try {
      git(['rev-parse', '--verify', candidate]);
      return candidate;
    } catch {
      /* try next */
    }
  }
  throw new Error('No base ref available (origin/test or origin/main).');
}

function listChangedFiles(base: string): string[] {
  const out = git(['diff', '--name-only', `${base}...HEAD`]);
  return out.split('\n').filter(Boolean);
}

function readAtRef(ref: string, file: string): string | null {
  try {
    return git(['show', `${ref}:${file}`]);
  } catch {
    // Missing at base = newly added file, not a removal candidate.
    return null;
  }
}

export function extractExports(source: string): Set<string> {
  const sf = ts.createSourceFile('barrel.ts', source, ts.ScriptTarget.Latest, true);
  const names = new Set<string>();

  const visit = (node: ts.Node): void => {
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) {
          names.add(el.name.text);
        }
      }
      // `export * from './foo'` — we don't resolve the target here. That
      // means star-re-export removals are invisible to the guard, which
      // is a conservative choice: the guard only fires on *explicit*
      // named removals, which are the ones a user can observe directly.
    } else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      if (node.name) names.add(node.name.text);
    } else if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) names.add(decl.name.text);
      }
    }
  };

  ts.forEachChild(sf, visit);
  return names;
}

function main(): GuardResult {
  const args = process.argv.slice(2);
  const baseArgIdx = args.indexOf('--base');
  const explicitBase = baseArgIdx >= 0 ? args[baseArgIdx + 1] : undefined;
  const jsonOutput = args.includes('--json');
  const base = resolveBase(explicitBase);

  const changed = listChangedFiles(base);

  // Only top-level package barrels — the user-facing contract surface.
  const barrelRe = /^packages\/[^/]+\/src\/index\.ts$/;
  const changedBarrels = changed.filter((f) => barrelRe.test(f));
  const docsChangedFiles = changed.filter((f) => f.startsWith('docs/'));

  const removedByFile: Record<string, string[]> = {};

  for (const barrel of changedBarrels) {
    const before = readAtRef(base, barrel);
    const afterAbs = path.join(ROOT, barrel);
    if (!fs.existsSync(afterAbs)) continue; // barrel deleted — separate concern
    const after = fs.readFileSync(afterAbs, 'utf8');

    const beforeSet = before ? extractExports(before) : new Set<string>();
    const afterSet = extractExports(after);

    const removed: string[] = [];
    for (const name of beforeSet) {
      if (!afterSet.has(name)) removed.push(name);
    }
    if (removed.length > 0) {
      removed.sort();
      removedByFile[barrel] = removed;
    }
  }

  const hasRemovals = Object.keys(removedByFile).length > 0;
  const verdict: 'pass' | 'fail' = hasRemovals && docsChangedFiles.length === 0 ? 'fail' : 'pass';

  const result: GuardResult = {
    base,
    changedBarrels,
    removedByFile,
    hasDocsChange: docsChangedFiles.length > 0,
    docsChangedFiles,
    verdict,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`· Base: ${base}`);
    console.log(`· Changed barrels: ${changedBarrels.length}`);
    console.log(`· Docs files changed: ${docsChangedFiles.length}`);

    if (!hasRemovals) {
      console.log('✓ No public exports removed — guard inactive.');
    } else if (docsChangedFiles.length > 0) {
      console.log('✓ Exports removed, docs change detected — guard satisfied.');
      for (const [file, names] of Object.entries(removedByFile)) {
        console.log(`    ${file}: -${names.join(', -')}`);
      }
    } else {
      console.error('✗ Public exports removed without any docs/ changes in this diff:');
      for (const [file, names] of Object.entries(removedByFile)) {
        console.error(`    ${file}: -${names.join(', -')}`);
      }
      console.error('');
      console.error('  Rename or removal of a public export is a user-visible contract');
      console.error('  change. Update at least one file under `docs/` in the same diff:');
      console.error('    - migration note / CHANGELOG entry');
      console.error('    - guide or reference page that mentioned the removed symbol');
      console.error('    - `docs/reference/cli-help.snapshot.json` if this was a CLI change');
      console.error('');
      console.error('  If the removal is genuinely doc-irrelevant (e.g. a symbol that');
      console.error('  was never documented), commit with `--no-verify` and explain why');
      console.error('  in the PR description.');
    }
  }

  if (verdict === 'fail') process.exit(1);
  return result;
}

// Only run when invoked directly (not when imported by tests).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfPath = path.resolve(import.meta.dirname, 'export-docs-guard.ts');
if (invokedPath === selfPath) {
  main();
}
