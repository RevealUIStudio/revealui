/**
 * Fail when generated API docs or the checked-in OpenAPI snapshot drifts.
 *
 * GAP-395: the checked-in REST API doc became hand-maintained; this gate
 * regenerates both artifacts to temp files and diffs against the commit.
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
const committedSpecPath = join(repoRoot, 'examples/api/openapi.json');

function main(): void {
  const committed = readFileSync(committedPath, 'utf-8');
  const committedSpec = readFileSync(committedSpecPath, 'utf-8');
  const dir = mkdtempSync(join(tmpdir(), 'api-docs-drift-'));
  const outPath = join(dir, 'README.md');
  const specOutPath = join(dir, 'openapi.json');

  try {
    execFileSync('pnpm', ['docs:generate:api'], {
      cwd: repoRoot,
      stdio: 'pipe',
      encoding: 'utf-8',
      env: { ...process.env, DOCS_API_OUT: outPath },
    });
    const generated = readFileSync(outPath, 'utf-8');
    const generatedSpec = readFileSync(specOutPath, 'utf-8');
    if (generated !== committed || generatedSpec !== committedSpec) {
      console.error(
        '[api-docs-drift] Generated API docs or examples/api/openapi.json is out of date.\n' +
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
