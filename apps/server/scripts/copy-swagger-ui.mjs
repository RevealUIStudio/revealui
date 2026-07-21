/**
 * Copies swagger-ui-dist static assets next to the built bundle
 * (dist/assets/swagger-ui/*).
 *
 * apps/server/src/index.ts serves /docs via readFileSync of those assets.
 * After GAP-401, resolution uses import.meta.resolve / require.resolve, which
 * @vercel/nft does not reliably keep in the serverless file set — especially
 * with GAP-403 excludeFiles shrinking the monorepo NFT wall. Production cold
 * start then dies with:
 *   ERR_MODULE_NOT_FOUND: Cannot find package 'swagger-ui-dist'
 * (deploy dpl_3hid… after #2027; FUNCTION_INVOCATION_FAILED on every route).
 *
 * Colocate + vercel.json includeFiles matches copy-resvg-wasm / copy-og-fonts.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'assets', 'swagger-ui');
mkdirSync(distDir, { recursive: true });

const files = [
  'swagger-ui.css',
  'swagger-ui-bundle.js',
  'swagger-ui-standalone-preset.js',
];

for (const name of files) {
  const from = require.resolve(`swagger-ui-dist/${name}`);
  const to = join(distDir, name);
  copyFileSync(from, to);
  process.stdout.write(`copy-swagger-ui: ${from} -> ${to}\n`);
}
