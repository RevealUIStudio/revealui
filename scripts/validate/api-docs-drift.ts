/**
 * Fail when docs/api/rest-api/README.md drifts from `pnpm docs:generate:api`.
 *
 * GAP-395: the checked-in REST API doc became hand-maintained; this gate
 * regenerates to a temp file (via DOCS_API_OUT) and diffs against the commit.
 *
 * Usage: pnpm validate:api-docs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const committedPath = join(repoRoot, 'docs/api/rest-api/README.md');
const generateScript = join(repoRoot, 'scripts/docs/generate-api.ts');

function main(): void {
  const committed = readFileSync(committedPath, 'utf-8');
  const dir = mkdtempSync(join(tmpdir(), 'api-docs-drift-'));
  const outPath = join(dir, 'README.md');

  try {
    execFileSync('pnpm', ['exec', 'tsx', generateScript], {
      cwd: repoRoot,
      stdio: 'pipe',
      encoding: 'utf-8',
      env: { ...process.env, DOCS_API_OUT: outPath },
    });
    const generated = readFileSync(outPath, 'utf-8');
    if (generated !== committed) {
      console.error(
        '[api-docs-drift] docs/api/rest-api/README.md is out of date.\n' +
          'Run: pnpm docs:generate:api\n' +
          'and commit the result.',
      );
      process.exit(1);
    }
    console.log('[api-docs-drift] OK - REST API docs match the generator.');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main();
