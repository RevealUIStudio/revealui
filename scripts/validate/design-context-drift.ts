// console-allowed
/**
 * Design-Context Drift Detector
 *
 * Verifies that packages/presentation/design-context/ is in sync with
 * packages/presentation/src/tokens.css by comparing sha256 digests.
 *
 * The MANIFEST.sha256 committed alongside the pack records the digest of
 * tokens.css at generation time. If tokens.css changes without regenerating
 * the pack, the digests diverge and this validator exits non-zero (hard fail).
 *
 * Usage:
 *   pnpm tsx scripts/validate/design-context-drift.ts
 *
 * Exit codes:
 *   0 = digests match (pack is in sync)
 *   1 = drift detected or a required file is missing
 *
 * This is a CLI script — console output is the program's purpose.
 * The `console-allowed` marker on line 1 exempts the file from the
 * no-console-log rule (per .revealui/code-standards.json).
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const TOKENS_CSS = path.join(ROOT, 'packages/presentation/src/tokens.css');
const MANIFEST = path.join(ROOT, 'packages/presentation/design-context/MANIFEST.sha256');

const DRIFT_MESSAGE =
  "DESIGN-CONTEXT DRIFT: packages/presentation/src/tokens.css changed but design-context/ was not regenerated. Run 'pnpm --filter @revealui/presentation gen:design-context' and commit the result.";

function run(): void {
  if (!fs.existsSync(TOKENS_CSS)) {
    process.stderr.write(`design-context-drift: required file not found: ${TOKENS_CSS}\n`);
    process.exit(1);
  }

  if (!fs.existsSync(MANIFEST)) {
    process.stderr.write(
      `design-context-drift: MANIFEST.sha256 not found at ${MANIFEST} — run 'pnpm --filter @revealui/presentation gen:design-context' and commit the result.\n`,
    );
    process.exit(1);
  }

  const tokensBuf = fs.readFileSync(TOKENS_CSS);
  const actual = createHash('sha256').update(tokensBuf).digest('hex');

  const manifestLine = fs.readFileSync(MANIFEST, 'utf8').trim();
  const committed = manifestLine.split(' ').filter(Boolean)[0];

  if (!committed) {
    process.stderr.write(
      `design-context-drift: MANIFEST.sha256 is malformed (could not parse digest from: ${JSON.stringify(manifestLine)})\n`,
    );
    process.exit(1);
  }

  if (actual !== committed) {
    process.stderr.write(`${DRIFT_MESSAGE}\n`);
    process.exit(1);
  }

  process.stdout.write('design-context-drift: ok (tokens.css matches committed pack digest)\n');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const selfPath = path.resolve(import.meta.dirname, 'design-context-drift.ts');
if (invokedPath === selfPath) {
  run();
}

export { DRIFT_MESSAGE, run };
