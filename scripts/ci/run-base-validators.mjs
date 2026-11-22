/**
 * Copy quality judge scripts from a base-commit checkout onto the scan
 * tree, build the harnesses bundle from that copy, and run the validators
 * by file path. package.json script aliases are not consulted.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directories and files copied from the base checkout onto the scan tree. */
export const JUDGE_PATHS = [
  'scripts/validate',
  'scripts/gates',
  'scripts/utils',
  'scripts/sync',
  'packages/scripts',
  'packages/harnesses',
  'packages/dev',
  'apps/docs/scripts/check-links.ts',
  'apps/docs/scripts/check-docs-pro-boundary.mjs',
];

/**
 * Validator entrypoints. Each item is an argv array, without a shell.
 * @type {string[][]}
 */
export const VALIDATOR_COMMANDS = [
  ['pnpm', 'exec', 'tsx', 'scripts/validate/structure.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/version-policy.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/react-rsc-floor.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/boundary.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/vercel-project-settings.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/incubate-posture.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/engines-posture.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/claim-drift.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/api-docs-drift.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/docs-public-mirror.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/claims-evidence.ts'],
  ['pnpm', 'exec', 'vitest', 'run', 'scripts/validate/__tests__/marketing-deploy-lockstep.test.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/marketing-deploy-lockstep.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/rules-lockstep.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/dockerfile-deps-lockstep.ts'],
  ['pnpm', 'exec', 'vitest', 'run', 'scripts/validate/__tests__/railway-marketplace-template.test.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/railway-marketplace-template.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/marketing-voice.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/marketing-voice-prose-slots.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/doc-currency.ts', '--mode=ci'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/migration-journal.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/raw-sql.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/empty-catch.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/audit-log-single-door.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/seed-script-wiring.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/mixed-changesets.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/changelog-format.ts'],
  ['pnpm', 'exec', 'tsx', 'scripts/validate/citation-check.ts', '--coverage-strict'],
  ['pnpm', 'exec', 'vitest', 'run', 'scripts/sync/__tests__/secret-paths-lockstep.test.ts'],
  ['pnpm', '--filter', 'docs', 'exec', 'tsx', 'scripts/check-links.ts'],
  ['pnpm', '--filter', 'docs', 'exec', 'node', 'scripts/check-docs-pro-boundary.mjs'],
];

const ZERO_SHA = '0000000000000000000000000000000000000000';

/**
 * @param {string} file
 * @returns {boolean}
 */
export function touchesManagerSurface(file) {
  return file.startsWith('.revealui/') || file.startsWith('packages/harnesses/');
}

/**
 * @param {string} eventName
 * @param {string[]} files
 * @param {{ beforeMissing: boolean, basePresent: boolean }} options
 * @returns {boolean}
 */
export function managerCheckNeeded(eventName, files, options) {
  if (eventName === 'pull_request') {
    if (!options.basePresent) return true;
    return files.some(touchesManagerSurface);
  }
  if (eventName === 'push') {
    if (options.beforeMissing) return true;
    return files.some(touchesManagerSurface);
  }
  return true;
}

/**
 * @param {string} judgeRoot
 * @param {string} scanRoot
 * @returns {void}
 */
export function copyJudgeTree(judgeRoot, scanRoot) {
  const judge = path.resolve(judgeRoot);
  const scan = path.resolve(scanRoot);
  if (judge === scan) {
    throw new Error('judge root and scan root are the same directory');
  }
  for (const rel of JUDGE_PATHS) {
    const src = path.join(judge, rel);
    if (!existsSync(src)) {
      throw new Error(`base judge missing ${rel}`);
    }
    const dest = path.join(scan, rel);
    cpSync(src, dest, {
      recursive: true,
      force: true,
      filter: (source) => path.basename(source) !== 'node_modules',
    });
  }
}

/**
 * Vitest collects every matching test under the scan root. A base checkout
 * nested there resolves roots inside the sparse tree and fails. Drop that
 * checkout after the copy. A judge directory outside the scan root stays.
 * @param {string} judgeRoot
 * @param {string} scanRoot
 * @returns {boolean}
 */
export function removeNestedJudgeCheckout(judgeRoot, scanRoot) {
  const judge = path.resolve(judgeRoot);
  const scan = path.resolve(scanRoot);
  const prefix = scan.endsWith(path.sep) ? scan : `${scan}${path.sep}`;
  if (!judge.startsWith(prefix)) return false;
  rmSync(judge, { recursive: true, force: true });
  return true;
}

/**
 * @param {string} cwd
 * @param {string[]} argv
 * @param {NodeJS.ProcessEnv} env
 * @returns {void}
 */
function runCommand(cwd, argv, env) {
  const [cmd, ...args] = argv;
  if (!cmd) {
    process.stderr.write('empty validator command\n');
    process.exit(1);
  }
  process.stdout.write(`validator: ${argv.join(' ')}\n`);
  const result = spawnSync(cmd, args, { cwd, env, stdio: 'inherit' });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/**
 * @param {string} scanRoot
 * @param {string} sha
 * @returns {void}
 */
function ensureCommit(scanRoot, sha) {
  const present = spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: scanRoot });
  if (present.status === 0) return;
  const fetched = spawnSync('git', ['fetch', '--no-tags', '--depth', '1', 'origin', sha], {
    cwd: scanRoot,
    stdio: 'inherit',
  });
  if (fetched.status !== 0) {
    process.stderr.write(`unable to fetch ${sha} for the manager path gate\n`);
    process.exit(fetched.status ?? 1);
  }
}

/**
 * @param {string} scanRoot
 * @param {NodeJS.ProcessEnv} env
 * @returns {string[]}
 */
function changedFiles(scanRoot, env) {
  const eventName = env.EVENT_NAME ?? '';
  const baseSha = env.BASE_SHA ?? '';
  const beforeSha = env.BEFORE_SHA ?? '';
  /** @type {string[]} */
  let range = [];
  if (eventName === 'pull_request' && baseSha) {
    ensureCommit(scanRoot, baseSha);
    range = [`${baseSha}...HEAD`];
  } else if (eventName === 'push' && beforeSha && beforeSha !== ZERO_SHA) {
    ensureCommit(scanRoot, beforeSha);
    range = [`${beforeSha}...HEAD`];
  } else {
    return [];
  }
  const result = spawnSync('git', ['diff', '--name-only', ...range], {
    cwd: scanRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? 'git diff failed\n');
    process.exit(result.status ?? 1);
  }
  return (result.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * @param {string} judgeRoot
 * @param {string} scanRoot
 * @param {NodeJS.ProcessEnv} env
 * @returns {void}
 */
export function runBaseValidators(judgeRoot, scanRoot, env) {
  copyJudgeTree(judgeRoot, scanRoot);
  removeNestedJudgeCheckout(judgeRoot, scanRoot);
  const childEnv = {
    ...env,
    SKIP_ENV_VALIDATION: env.SKIP_ENV_VALIDATION ?? 'true',
    CI: env.CI ?? 'true',
  };
  runCommand(scanRoot, ['pnpm', 'turbo', 'run', 'build', '--filter=@revealui/harnesses...'], childEnv);
  for (const argv of VALIDATOR_COMMANDS) runCommand(scanRoot, argv, childEnv);

  const eventName = env.EVENT_NAME ?? '';
  const beforeSha = env.BEFORE_SHA ?? '';
  const basePresent = (env.BASE_SHA ?? '').length > 0;
  const beforeMissing = beforeSha.length === 0 || beforeSha === ZERO_SHA;
  const files =
    (eventName === 'pull_request' && basePresent) || (eventName === 'push' && !beforeMissing)
      ? changedFiles(scanRoot, env)
      : [];
  if (!managerCheckNeeded(eventName, files, { beforeMissing, basePresent })) {
    process.stdout.write('skip: no .revealui/ or packages/harnesses/ changes\n');
    return;
  }
  runCommand(scanRoot, ['pnpm', 'exec', 'tsx', 'scripts/validate/structure.ts', '--manager-only'], childEnv);
  runCommand(
    scanRoot,
    [
      'node',
      'packages/harnesses/dist/cli.js',
      'content',
      'diff',
      '--generator',
      'claude-code',
      '--check',
      '--project',
      '.',
    ],
    childEnv,
  );
}

function main() {
  const scanRoot = path.resolve(process.env.SCAN_ROOT ?? process.cwd());
  const judgeRoot = path.resolve(process.env.JUDGE_ROOT ?? path.join(scanRoot, 'trusted-judge'));
  process.stdout.write(`judge root: ${judgeRoot}\nscan root: ${scanRoot}\n`);
  runBaseValidators(judgeRoot, scanRoot, process.env);
}

const thisFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedFile === thisFile) main();
