/**
 * Copies OG Inter Tight static fonts next to the built bundle
 * (dist/assets/fonts/*.ttf).
 *
 * apps/server/src/routes/og.ts reads fonts at runtime via readFileSync so both
 * `tsx watch` (dev) and the Node-built bundle (prod) share one path. tsup's
 * binary `.ttf` loader worked only in the built bundle and broke `pnpm dev:api`
 * (ERR_UNKNOWN_FILE_EXTENSION). Colocating fonts + vercel includeFiles keeps
 * /api/og working on Vercel the same way copy-resvg-wasm does for WASM.
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fontsSrc = join(here, '..', 'src', 'assets', 'fonts');
const fontsDest = join(here, '..', 'dist', 'assets', 'fonts');

mkdirSync(fontsDest, { recursive: true });

const fonts = readdirSync(fontsSrc).filter((name) => name.endsWith('.ttf'));
if (fonts.length === 0) {
  throw new Error(`copy-og-fonts: no .ttf files in ${fontsSrc}`);
}

for (const name of fonts) {
  const from = join(fontsSrc, name);
  const to = join(fontsDest, name);
  copyFileSync(from, to);
  process.stdout.write(`copy-og-fonts: ${from} -> ${to}\n`);
}
