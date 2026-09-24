/**
 * Copies the three Swagger UI files the /docs page serves into
 * dist/assets/swagger-ui/.
 *
 * apps/server/src/lib/swagger-ui-assets.ts reads them at runtime via
 * readFileSync. @vercel/nft cannot trace `import.meta.resolve('swagger-ui-dist/...')`
 * into node_modules, so without a colocated copy (plus vercel.json includeFiles)
 * GET /docs/swagger-ui-*.js|css throws
 * "Cannot find package 'swagger-ui-dist'" (REVEALUI-SERVER-E, REVEALUI-STAGING-1).
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const FILES = [
  'swagger-ui.css',
  'swagger-ui-bundle.js',
  'swagger-ui-standalone-preset.js',
];

const destDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'assets', 'swagger-ui');
mkdirSync(destDir, { recursive: true });

for (const name of FILES) {
  const from = require.resolve(`swagger-ui-dist/${name}`);
  const to = join(destDir, name);
  copyFileSync(from, to);
  process.stdout.write(`copy-swagger-ui: ${from} -> ${to}\n`);
}
