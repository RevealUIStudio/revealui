// console-allowed
/**
 * Brand-Bridge Drift Detector (DS-D3)
 *
 * Ensures that every app's @theme inline bridge maps --color-primary and
 * --color-ring to var(--rvui-*) tokens rather than the legacy hsl(var(...))
 * pattern that causes admin to render default-shadcn slate instead of the
 * fleet cobalt brand.
 *
 * Files scanned: apps/*\/app/index.css  and  apps/*\/(frontend)/tailwind-theme.css
 * (the two bridge-file shapes that exist in this monorepo).
 *
 * Fail condition: any @theme inline block in those files maps either
 * --color-primary or --color-ring to a value that contains "hsl(var(".
 *
 * Usage:
 *   pnpm tsx scripts/validate/brand-bridge.ts
 *
 * Exit codes:
 *   0 = all bridge files use --rvui-* tokens
 *   1 = legacy hsl(var()) bridge detected
 *
 * This is a CLI script — console output is the program's purpose.
 * The `console-allowed` marker on line 1 exempts the file from the
 * no-console-log rule (per .revealui/code-standards.json).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');

const HSL_VAR_MARKER = 'hsl(var(';

interface Violation {
  file: string;
  property: string;
  value: string;
  line: number;
}

function findBridgeFiles(): string[] {
  const files: string[] = [];
  const appsDir = path.join(ROOT, 'apps');

  let apps: fs.Dirent[];
  try {
    apps = fs.readdirSync(appsDir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const app of apps) {
    if (!app.isDirectory()) continue;
    const candidates = [
      path.join(appsDir, app.name, 'app', 'index.css'),
      path.join(appsDir, app.name, 'src', 'app', '(frontend)', 'tailwind-theme.css'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        files.push(candidate);
      }
    }
  }

  return files;
}

const BRIDGE_PROPERTIES = new Set(['--color-primary', '--color-ring']);

function checkFile(filePath: string): Violation[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const violations: Violation[] = [];
  const lines = content.split('\n');

  let inThemeInline = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inThemeInline) {
      if (line.includes('@theme') && line.includes('inline')) {
        inThemeInline = true;
        braceDepth = 0;
      }
    }

    if (inThemeInline) {
      for (const char of line) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
      }

      const trimmed = line.trim();
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx !== -1) {
        const prop = trimmed.slice(0, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();

        if (BRIDGE_PROPERTIES.has(prop)) {
          if (value.includes(HSL_VAR_MARKER)) {
            violations.push({
              file: path.relative(ROOT, filePath),
              property: prop,
              value: value.replace(/;$/, '').trim(),
              line: i + 1,
            });
          }
        }
      }

      if (braceDepth <= 0) {
        inThemeInline = false;
      }
    }
  }

  return violations;
}

function run(): void {
  const bridgeFiles = findBridgeFiles();

  if (bridgeFiles.length === 0) {
    process.stderr.write('brand-bridge: no bridge files found under apps/\n');
    process.exit(1);
  }

  const allViolations: Violation[] = [];

  for (const file of bridgeFiles) {
    const violations = checkFile(file);
    allViolations.push(...violations);
  }

  process.stdout.write(`brand-bridge: scanned ${bridgeFiles.length} bridge file(s)\n`);
  for (const f of bridgeFiles) {
    process.stdout.write(`  ${path.relative(ROOT, f)}\n`);
  }

  if (allViolations.length === 0) {
    process.stdout.write(
      'brand-bridge: ok (all --color-primary and --color-ring entries use var(--rvui-*) tokens)\n',
    );
    return;
  }

  process.stderr.write(`\nbrand-bridge: ${allViolations.length} violation(s) found\n\n`);
  for (const v of allViolations) {
    process.stderr.write(`  ${v.file}:${v.line}\n`);
    process.stderr.write(`    ${v.property}: ${v.value}\n`);
    process.stderr.write(
      `    Fix: replace hsl(var(...)) with var(--rvui-brand) for primary/ring\n\n`,
    );
  }
  process.stderr.write(
    'All @theme inline bridges must map --color-primary and --color-ring to var(--rvui-*) tokens,\n',
  );
  process.stderr.write(
    `not to hsl(var(...)) intermediaries. The hsl() form expects HSL triplets but --rvui-* tokens\n`,
  );
  process.stderr.write(`are OKLCH values, producing invalid CSS.\n`);
  process.exit(1);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfPath = path.resolve(import.meta.dirname, 'brand-bridge.ts');
if (invokedPath === selfPath) {
  run();
}

export { checkFile, findBridgeFiles, run };
