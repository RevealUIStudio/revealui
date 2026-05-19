#!/usr/bin/env tsx
/**
 * Text Palette Utility Audit
 *
 * Reports JSX className tokens that hard-code raw Tailwind palette text colors
 * (text-gray-500, text-emerald-400, etc.) in apps/**.tsx — instead of going
 * through the semantic bridge (text-foreground / text-muted-foreground /
 * text-primary / text-accent-foreground / text-destructive-foreground).
 *
 * Rationale:
 *   - design-system/Assessment · Contrast & Accessibility.html flagged
 *     text-gray-500 on light surfaces as 4.43:1 (AA fail).
 *   - The semantic bridge tokens are theme-aware: --rvui-text-2 resolves to
 *     #4f6580 on paper (5.73:1 AA) and #8298b3 on midnight (6.29:1 AA).
 *   - Hard-coded palette text utilities fail one of the two surfaces.
 *
 * Some palette utilities are LEGITIMATE (an emerald-400 label inside a
 * bg-gray-950 code block is intentionally palette-locked because the parent
 * surface is also palette-locked). This audit reports all usages and lets
 * the reviewer classify case-by-case; the per-line "candidate" flag is a
 * heuristic, not a verdict.
 *
 * Usage:
 *   pnpm tsx scripts/analyze/audit-text-palette.ts             # human report
 *   pnpm tsx scripts/analyze/audit-text-palette.ts --json      # machine JSON
 *   pnpm tsx scripts/analyze/audit-text-palette.ts --apps-only # skip packages/
 *
 * @module scripts/analyze/audit-text-palette
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = join(__dirname, '../..');

const EXCLUDE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.git',
  '.cache',
  '.output',
  '.vercel',
  'opensrc',
  'playwright-report',
  'test-results',
  '__tests__',
]);

const TAILWIND_PALETTE_NAMES = new Set([
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
]);

const TAILWIND_SHADES = new Set([
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
]);

/** Build the forbidden-class set: text-{color}-{shade}. */
function buildForbiddenSet(): Set<string> {
  const out = new Set<string>();
  for (const color of TAILWIND_PALETTE_NAMES) {
    for (const shade of TAILWIND_SHADES) {
      out.add(`text-${color}-${shade}`);
    }
  }
  return out;
}

const FORBIDDEN_TEXT_UTILITIES = buildForbiddenSet();

/** Split a className string into tokens without regex.
 *  Whitespace = space (0x20), tab (0x09), newline (0x0A), carriage return (0x0D).
 */
function tokenizeClassName(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    const isWhitespace = ch === 0x20 || ch === 0x09 || ch === 0x0a || ch === 0x0d;
    if (isWhitespace) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += value[i];
    }
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

/** Strip Tailwind prefix modifiers (hover:, dark:, sm:, etc.) without regex.
 *  Tokens may look like `hover:text-gray-700` or `sm:dark:text-emerald-400`.
 *  Returns the bare utility for matching.
 */
function stripModifiers(token: string): string {
  const idx = token.lastIndexOf(':');
  return idx === -1 ? token : token.substring(idx + 1);
}

interface Finding {
  file: string;
  line: number;
  column: number;
  utility: string;
  rawToken: string;
  classNameSnippet: string;
}

function scanDirectory(dir: string): string[] {
  const files: string[] = [];
  function walk(currentDir: string, depth: number): void {
    if (depth > 50) return;
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  }
  walk(dir, 0);
  return files;
}

/** Extract the (possibly composite) string content from a className value node.
 *  Supports:
 *    - StringLiteral:  "foo bar"
 *    - JsxExpression with StringLiteral:  {"foo bar"}
 *    - JsxExpression with NoSubstitutionTemplateLiteral:  {`foo bar`}
 *    - JsxExpression with TemplateExpression: concatenates the literal head + spans
 *      (ignores ${} interpolations but captures the static parts so palette
 *      tokens inside the static text still get flagged)
 *  Returns null if the value is purely dynamic (no static text).
 */
function extractClassNameLiteralParts(valueNode: ts.Node): string | null {
  if (ts.isStringLiteral(valueNode)) {
    return valueNode.text;
  }
  if (ts.isJsxExpression(valueNode) && valueNode.expression) {
    return extractClassNameLiteralParts(valueNode.expression);
  }
  if (ts.isNoSubstitutionTemplateLiteral(valueNode)) {
    return valueNode.text;
  }
  if (ts.isTemplateExpression(valueNode)) {
    const parts: string[] = [valueNode.head.text];
    for (const span of valueNode.templateSpans) {
      parts.push(' ');
      parts.push(span.literal.text);
    }
    return parts.join('');
  }
  if (ts.isConditionalExpression(valueNode)) {
    const whenTrue = extractClassNameLiteralParts(valueNode.whenTrue);
    const whenFalse = extractClassNameLiteralParts(valueNode.whenFalse);
    if (whenTrue === null && whenFalse === null) return null;
    return `${whenTrue ?? ''} ${whenFalse ?? ''}`;
  }
  if (
    ts.isBinaryExpression(valueNode) &&
    valueNode.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = extractClassNameLiteralParts(valueNode.left);
    const right = extractClassNameLiteralParts(valueNode.right);
    if (left === null && right === null) return null;
    return `${left ?? ''} ${right ?? ''}`;
  }
  return null;
}

function auditFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  const content = readFileSync(filePath, 'utf-8');
  const source = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const relPath = relative(workspaceRoot, filePath);

  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node) && node.name.getText() === 'className' && node.initializer) {
      const literal = extractClassNameLiteralParts(node.initializer);
      if (literal !== null) {
        const tokens = tokenizeClassName(literal);
        for (const token of tokens) {
          const bare = stripModifiers(token);
          if (FORBIDDEN_TEXT_UTILITIES.has(bare)) {
            const { line, character } = source.getLineAndCharacterOfPosition(node.getStart());
            findings.push({
              file: relPath,
              line: line + 1,
              column: character + 1,
              utility: bare,
              rawToken: token,
              classNameSnippet: literal.length > 120 ? `${literal.substring(0, 117)}...` : literal,
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
}

function main(): void {
  const args = new Set(process.argv.slice(2));
  const asJson = args.has('--json');
  const appsOnly = args.has('--apps-only');

  const scanRoots: string[] = [join(workspaceRoot, 'apps')];
  if (!appsOnly) scanRoots.push(join(workspaceRoot, 'packages', 'presentation'));

  const files: string[] = [];
  for (const root of scanRoots) files.push(...scanDirectory(root));

  const allFindings: Finding[] = [];
  for (const file of files) {
    allFindings.push(...auditFile(file));
  }

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify({ findings: allFindings, total: allFindings.length }, null, 2)}\n`,
    );
    return;
  }

  if (allFindings.length === 0) {
    process.stdout.write('✓ No raw palette text utilities found in scanned tree.\n');
    return;
  }

  const byFile = new Map<string, Finding[]>();
  for (const f of allFindings) {
    const list = byFile.get(f.file) ?? [];
    list.push(f);
    byFile.set(f.file, list);
  }

  process.stdout.write(
    `Text-palette utility audit — ${allFindings.length} findings across ${byFile.size} files\n`,
  );
  process.stdout.write(
    'Convention: prefer text-foreground / text-muted-foreground / text-primary semantic tokens.\n',
  );
  process.stdout.write(
    'See: docs/decisions/2026-05-19-semantic-text-tokens.md (in revealui-jv) or design-system/CLAUDE.md.\n\n',
  );

  const sortedFiles = Array.from(byFile.keys()).sort();
  for (const file of sortedFiles) {
    const findings = byFile.get(file);
    if (!findings) continue;
    process.stdout.write(`${file}\n`);
    for (const f of findings) {
      process.stdout.write(`  ${f.line}:${f.column}  ${f.rawToken}\n`);
    }
    process.stdout.write('\n');
  }
}

main();
