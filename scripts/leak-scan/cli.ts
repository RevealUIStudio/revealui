import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigError, loadLocalRules } from './config';
import { makeIsIgnored, parseLeakignore } from './leakignore';
import { formatJson, formatText } from './report';
import { BASE_RULES } from './rules';
import { DEFAULT_EXCLUDE_FILE_GLOBS, scanPaths } from './scan';

export interface CliResult {
  readonly code: 0 | 1 | 2;
  readonly stdout: string;
  readonly stderr: string;
}

const HELP = [
  'leak-scan - detect private paths, IDs, and credentials that must not ship.',
  '',
  'Usage: leak-scan [path...] [--json] [--leakignore=FILE] [--local-rules=FILE]',
  '',
  '  path...           directories/files to scan (default: current directory)',
  '  --json            machine-readable output',
  '  --leakignore=F    allowlist file (default: <root>/.leakignore)',
  '  --local-rules=F   repo-local sensitive rules (default: <root>/.leakrules.json)',
  '',
  'Exit codes: 0 clean, 1 violations found, 2 setup error.',
  '',
].join('\n');

// The scanner's own artifacts are self-excluded so they never flag their own
// rule patterns (analogous to the bash scanner excluding its own filename).
const SELF_EXCLUDE_GLOBS = ['leak-scan.mjs', 'check-no-private-leaks.sh', '.leakrules.json'];

/** Pure CLI core: no process.exit, returns code + streams, so it is unit-testable. */
export function runCli(argv: readonly string[], cwd: string): CliResult {
  let json = false;
  let leakignorePath: string | undefined;
  let localRulesPath: string | undefined;
  const paths: string[] = [];
  for (const arg of argv) {
    if (arg === '--json') json = true;
    else if (arg === '--help' || arg === '-h') return { code: 0, stdout: HELP, stderr: '' };
    else if (arg.startsWith('--leakignore=')) leakignorePath = arg.slice('--leakignore='.length);
    else if (arg.startsWith('--local-rules=')) localRulesPath = arg.slice('--local-rules='.length);
    else if (arg.startsWith('-'))
      return { code: 2, stdout: '', stderr: `leak-scan: unknown option ${arg}\n` };
    else paths.push(arg);
  }

  const roots = paths.length > 0 ? paths : [cwd];
  const primaryRoot = roots[0] ?? cwd;

  for (const p of roots) {
    if (!existsSync(p))
      return { code: 2, stdout: '', stderr: `leak-scan: scan path not found: ${p}\n` };
  }

  let rules = BASE_RULES;
  try {
    const local = loadLocalRules(localRulesPath ?? join(primaryRoot, '.leakrules.json'));
    if (local.length > 0) rules = [...BASE_RULES, ...local];
  } catch (err) {
    if (err instanceof ConfigError) return { code: 2, stdout: '', stderr: `${err.message}\n` };
    throw err;
  }

  const leakignoreFile = leakignorePath ?? join(primaryRoot, '.leakignore');
  const isIgnored = existsSync(leakignoreFile)
    ? makeIsIgnored(parseLeakignore(readFileSync(leakignoreFile, 'utf8')))
    : undefined;

  const excludeFileGlobs = [...DEFAULT_EXCLUDE_FILE_GLOBS, ...SELF_EXCLUDE_GLOBS];
  const { findings, violations } = scanPaths(rules, roots, { isIgnored, excludeFileGlobs });

  if (json) {
    return { code: violations > 0 ? 1 : 0, stdout: `${formatJson(findings)}\n`, stderr: '' };
  }
  if (violations > 0) {
    return {
      code: 1,
      stdout: `${formatText(findings)}\n`,
      stderr: `leak-scan: FAIL - ${violations} violation(s)\n`,
    };
  }
  return { code: 0, stdout: `leak-scan: OK - no leaks across ${roots.join(', ')}\n`, stderr: '' };
}

// Thin launcher. Guarded so importing runCli under Vitest does not exit the runner.
if (!process.env.VITEST) {
  const result = runCli(process.argv.slice(2), process.cwd());
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.code);
}
