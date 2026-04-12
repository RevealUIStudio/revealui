/**
 * dev-focus: Start dev watchers only for specified packages/apps.
 *
 * Usage:
 *   pnpm dev:focus cms              # Watch CMS only
 *   pnpm dev:focus api core         # Watch API and core
 *   pnpm dev:focus --deps cms       # Watch CMS + all its transitive deps
 *
 * Supports both short names (cms, api, core) and full names (@revealui/core).
 * Uses turbo --filter to scope which packages run their dev script.
 *
 * Tip: Run `pnpm build` first to ensure deps are compiled, then use
 * dev:focus to watch only what you're actively editing.
 */

import { execFileSync } from 'node:child_process';

const rawArgs = process.argv.slice(2);
const includeDeps = rawArgs.includes('--deps');
const targets = rawArgs.filter((a) => a !== '--deps');

if (targets.length === 0) {
  console.error(
    'Usage: pnpm dev:focus [--deps] <package|app> [...more]\n\n' +
      'Examples:\n' +
      '  pnpm dev:focus cms              # Watch CMS only\n' +
      '  pnpm dev:focus api core         # Watch API + core\n' +
      '  pnpm dev:focus --deps cms       # Watch CMS + all transitive deps\n' +
      '  pnpm dev:focus presentation     # Watch UI components only\n\n' +
      'Options:\n' +
      '  --deps   Also watch transitive dependencies (uses turbo ...filter)\n',
  );
  process.exit(1);
}

// Build turbo filter flags
const filterFlags = targets.flatMap((target) => {
  const prefix = includeDeps ? '...' : '';
  return ['--filter', `${prefix}${target}`];
});

const args = ['turbo', 'run', 'dev', '--parallel', ...filterFlags];

console.log(`Starting focused dev: ${targets.join(', ')}${includeDeps ? ' (+ deps)' : ''}`);
console.log(`Running: pnpm ${args.join(' ')}\n`);

try {
  execFileSync('pnpm', args, {
    stdio: 'inherit',
    cwd: new URL('../../', import.meta.url).pathname,
  });
} catch {
  // turbo killed by signal (Ctrl+C)  -  exit cleanly
  process.exit(0);
}
