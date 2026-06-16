/* eslint-disable */
/**
 * gen-manifest.cjs — regenerate design-context/MANIFEST.sha256.
 *
 * Computes the sha256 digest of src/tokens.css and writes it (plus a verbatim
 * mirror of tokens.css) into design-context/. Re-run whenever tokens.css
 * changes; scripts/validate/design-context-drift.ts hard-fails CI until the
 * manifest matches.
 *
 * Usage:
 *   node scripts/gen-manifest.cjs        # write
 *   node scripts/gen-manifest.cjs --check # exit 1 if stale, no write
 */
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const PKG_ROOT = join(__dirname, '..');
const TOKENS_SRC = join(PKG_ROOT, 'src', 'tokens.css');
const MANIFEST = join(PKG_ROOT, 'design-context', 'MANIFEST.sha256');
const TOKENS_MIRROR = join(PKG_ROOT, 'design-context', 'tokens.css');

const css = readFileSync(TOKENS_SRC);
const digest = createHash('sha256').update(css).digest('hex');
const manifestLine = `${digest}  tokens.css\n`;

if (process.argv.includes('--check')) {
  const existing = readFileSync(MANIFEST, 'utf8');
  if (existing !== manifestLine) {
    process.stderr.write(`MANIFEST.sha256 is stale — run: pnpm --filter @revealui/tokens gen:manifest\n`);
    process.exit(1);
  }
  const mirror = readFileSync(TOKENS_MIRROR);
  if (!mirror.equals(css)) {
    process.stderr.write(`design-context/tokens.css drifted from src — run: pnpm --filter @revealui/tokens gen:manifest\n`);
    process.exit(1);
  }
  process.stdout.write('manifest in sync\n');
  process.exit(0);
}

writeFileSync(MANIFEST, manifestLine);
writeFileSync(TOKENS_MIRROR, css);
process.stdout.write(`wrote ${MANIFEST}\n`);
process.stdout.write(`wrote ${TOKENS_MIRROR}\n`);
