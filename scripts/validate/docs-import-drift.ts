/**
 * Docs Import Drift Detector
 *
 * Extracts TypeScript/TSX code fences from `docs/**` and verifies that
 * every `import { X } from '@revealui/pkg'` names an identifier that
 * the current workspace package actually exports. Catches the most
 * common class of doc drift — samples that reference removed or
 * renamed public API — without running the full TypeScript compiler.
 *
 * Usage:
 *   pnpm validate:docs-imports
 *   pnpm validate:docs-imports --json
 *   pnpm validate:docs-imports --warn  # never exit nonzero (CI default)
 *
 * Exit codes:
 *   0 = every doc import matches a real workspace export (or --warn)
 *   1 = drift detected (list printed)
 *
 * NOTE: the initial scan (2026-04-16) reports ~225 findings against
 * existing docs. The check ships in CI as warn-only until that backlog
 * is drained. Once findings approach zero, flip the gate entry to hard-fail.
 *
 * Design notes:
 * - Only validates workspace `@revealui/*` imports. Third-party imports
 *   (react, zod, commander, etc.) are out of scope — they have their
 *   own versioning.
 * - Reads the package's built `.d.ts` (from its `exports["."]["types"]`
 *   entry) to build the export manifest. This is the same surface users
 *   actually see; if the .d.ts isn't built the check is skipped (warn).
 * - Subpath imports (`@revealui/core/utils/deep-clone`) check against
 *   the matching `exports["./utils/deep-clone"]` entry when declared.
 * - Side-effect imports (`import '@revealui/pkg';`) are ignored.
 * - Default imports (`import foo from ...`) are accepted as long as the
 *   module has a default export.
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DOCS_DIR = path.join(ROOT, 'docs');
const PACKAGES_DIR = path.join(ROOT, 'packages');

interface ImportRef {
  file: string;
  line: number;
  module: string;
  /** Named imports in this statement; `default` sentinel for default imports. */
  names: string[];
  /** True when any name was a default import. */
  hasDefault: boolean;
}

interface PackageExports {
  /** Map of subpath (".", "./utils", etc.) → resolved absolute .d.ts path. */
  subpaths: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Fence extraction
// ---------------------------------------------------------------------------

const FENCE_RE = /^```(ts|tsx|typescript)(?:\s+[^\n]*)?$/;
const FENCE_CLOSE = '```';

function extractFences(markdown: string): Array<{ startLine: number; code: string }> {
  const out: Array<{ startLine: number; code: string }> = [];
  const lines = markdown.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line && FENCE_RE.test(line)) {
      // Line number of the first line *inside* the fence, 1-indexed.
      // Combined with the 0-indexed per-snippet offset from ts.SourceFile,
      // this yields the real file line of the import.
      const startLine = i + 2;
      const buf: string[] = [];
      i++;
      while (i < lines.length && lines[i] !== FENCE_CLOSE) {
        buf.push(lines[i] as string);
        i++;
      }
      out.push({ startLine, code: buf.join('\n') });
    }
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Import parsing
// ---------------------------------------------------------------------------

function parseImports(code: string, file: string, baseLine: number): ImportRef[] {
  const sf = ts.createSourceFile('snippet.ts', code, ts.ScriptTarget.Latest, true);
  const refs: ImportRef[] = [];
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const module = stmt.moduleSpecifier.text;
    if (!module.startsWith('@revealui/')) continue;

    const names: string[] = [];
    let hasDefault = false;
    const clause = stmt.importClause;
    if (clause) {
      if (clause.name) {
        hasDefault = true;
        names.push('default');
      }
      if (clause.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          // `import * as X from '...'` — treat as wildcard, no per-name check.
          continue;
        }
        if (ts.isNamedImports(clause.namedBindings)) {
          for (const el of clause.namedBindings.elements) {
            // Prefer the original export name (`propertyName`) when aliased.
            names.push((el.propertyName ?? el.name).text);
          }
        }
      }
    }

    if (names.length === 0) continue; // side-effect import

    const { line } = sf.getLineAndCharacterOfPosition(stmt.getStart(sf));
    refs.push({
      file,
      line: baseLine + line,
      module,
      names,
      hasDefault,
    });
  }
  return refs;
}

// ---------------------------------------------------------------------------
// Workspace export manifest
// ---------------------------------------------------------------------------

const pkgCache = new Map<string, PackageExports | null>();

function loadPackageExports(pkgName: string): PackageExports | null {
  if (pkgCache.has(pkgName)) return pkgCache.get(pkgName) ?? null;

  // @revealui/security → packages/security
  const short = pkgName.replace(/^@revealui\//, '');
  const pkgDir = path.join(PACKAGES_DIR, short);
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    pkgCache.set(pkgName, null);
    return null;
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as {
    exports?: Record<string, { types?: string; import?: string } | string>;
    types?: string;
    main?: string;
  };

  const subpaths = new Map<string, string>();

  if (pkgJson.exports && typeof pkgJson.exports === 'object') {
    for (const [subpath, target] of Object.entries(pkgJson.exports)) {
      let typesPath: string | undefined;
      if (typeof target === 'string') typesPath = target;
      else typesPath = target.types ?? target.import;
      if (!typesPath) continue;
      const abs = path.resolve(pkgDir, typesPath);
      if (fs.existsSync(abs)) subpaths.set(subpath, abs);
    }
  } else if (pkgJson.types) {
    const abs = path.resolve(pkgDir, pkgJson.types);
    if (fs.existsSync(abs)) subpaths.set('.', abs);
  }

  const result: PackageExports = { subpaths };
  pkgCache.set(pkgName, result);
  return result;
}

function moduleSubpath(module: string): { pkg: string; subpath: string } {
  // @revealui/core → pkg=@revealui/core, sub=.
  // @revealui/core/utils → pkg=@revealui/core, sub=./utils
  const parts = module.split('/');
  const pkg = `${parts[0]}/${parts[1]}`;
  const rest = parts.slice(2).join('/');
  return { pkg, subpath: rest ? `./${rest}` : '.' };
}

const exportCache = new Map<string, Set<string>>();

function loadExportsFromDts(dtsPath: string): Set<string> {
  const cached = exportCache.get(dtsPath);
  if (cached) return cached;

  const source = fs.readFileSync(dtsPath, 'utf8');
  const sf = ts.createSourceFile(dtsPath, source, ts.ScriptTarget.Latest, true);
  const names = new Set<string>();

  const visit = (node: ts.Node): void => {
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        // export { A, B as C } from '...'
        for (const el of node.exportClause.elements) {
          names.add(el.name.text);
        }
      } else if (
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        !node.exportClause
      ) {
        // Re-export: `export * from './foo'` — follow transitively.
        const spec = node.moduleSpecifier.text;
        if (spec.startsWith('.')) {
          // Normalise: emitted .d.ts files reference `./foo.js` — strip the
          // extension so we can check for `./foo.d.ts` / `./foo/index.d.ts`.
          const stripped = spec.replace(/\.(js|mjs|cjs|ts|tsx)$/, '');
          const candidates = [
            path.resolve(path.dirname(dtsPath), `${stripped}.d.ts`),
            path.resolve(path.dirname(dtsPath), stripped, 'index.d.ts'),
          ];
          for (const c of candidates) {
            if (fs.existsSync(c)) {
              for (const n of loadExportsFromDts(c)) names.add(n);
              break;
            }
          }
        }
      }
    } else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      if (node.name) names.add(node.name.text);
      if (node.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
        names.add('default');
      }
    } else if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) names.add(decl.name.text);
      }
    } else if (ts.isExportAssignment(node)) {
      names.add('default');
    }
  };

  ts.forEachChild(sf, visit);
  exportCache.set(dtsPath, names);
  return names;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function walkDocs(dir: string, acc: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDocs(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.md')) acc.push(full);
  }
}

interface Finding {
  file: string;
  line: number;
  module: string;
  missing: string;
  reason: 'unknown-package' | 'no-dts' | 'unknown-subpath' | 'not-exported';
}

function main(): void {
  const jsonOutput = process.argv.includes('--json');
  const warnOnly = process.argv.includes('--warn');
  const files: string[] = [];
  walkDocs(DOCS_DIR, files);

  const findings: Finding[] = [];
  const skippedNoDts = new Set<string>();

  for (const file of files) {
    const md = fs.readFileSync(file, 'utf8');
    const fences = extractFences(md);
    for (const { startLine, code } of fences) {
      const refs = parseImports(code, file, startLine);
      for (const ref of refs) {
        const { pkg, subpath } = moduleSubpath(ref.module);
        const exp = loadPackageExports(pkg);
        if (!exp) {
          for (const n of ref.names) {
            findings.push({
              file: ref.file,
              line: ref.line,
              module: ref.module,
              missing: n,
              reason: 'unknown-package',
            });
          }
          continue;
        }
        const dts = exp.subpaths.get(subpath);
        if (!dts) {
          // Subpath not declared in exports — count as drift (user can't import this).
          for (const n of ref.names) {
            findings.push({
              file: ref.file,
              line: ref.line,
              module: ref.module,
              missing: n,
              reason: 'unknown-subpath',
            });
          }
          continue;
        }
        if (!fs.existsSync(dts)) {
          skippedNoDts.add(pkg);
          continue;
        }
        const names = loadExportsFromDts(dts);
        for (const n of ref.names) {
          if (!names.has(n)) {
            findings.push({
              file: ref.file,
              line: ref.line,
              module: ref.module,
              missing: n,
              reason: 'not-exported',
            });
          }
        }
      }
    }
  }

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          findings,
          skippedNoDts: [...skippedNoDts],
        },
        null,
        2,
      ),
    );
  } else {
    if (skippedNoDts.size > 0) {
      console.log(
        `· Skipped ${skippedNoDts.size} package(s) with no built .d.ts: ${[...skippedNoDts].join(', ')}`,
      );
      console.log('  (run `pnpm build` to include them)');
    }
    if (findings.length === 0) {
      console.log(
        `✓ Every @revealui/* import in docs/ resolves to a current export (${files.length} files scanned)`,
      );
      return;
    }
    console.error(`✗ ${findings.length} doc import(s) reference missing exports:`);
    for (const f of findings) {
      const rel = path.relative(ROOT, f.file);
      console.error(
        `  ${rel}:${f.line} — import { ${f.missing} } from '${f.module}' [${f.reason}]`,
      );
    }
    console.error('');
    console.error('  Each of these is a stale doc sample. Either:');
    console.error('    (a) update the doc to reference the current export, or');
    console.error('    (b) ship a codemod if this was a recent rename (see §4.18 Phase B).');
    if (warnOnly) {
      console.error('');
      console.error('  (running with --warn: not failing the build)');
    }
  }

  if (findings.length > 0 && !warnOnly) process.exit(1);
}

// Only run when invoked directly (not when imported by tests).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfPath = path.resolve(import.meta.dirname, 'docs-import-drift.ts');
if (invokedPath === selfPath) {
  main();
}

export { extractFences, loadExportsFromDts, moduleSubpath, parseImports };
