/**
 * Build-time contract: Swagger UI files exist under dist/assets/swagger-ui
 * and vercel.json includeFiles ships them. Catches the REVEALUI-SERVER-E
 * class where runtime import.meta.resolve failed because NFT never traced
 * swagger-ui-dist into the function.
 *
 * Invoked from package.json build after copy-swagger-ui.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const assetDir = join(root, 'dist', 'assets', 'swagger-ui');
const vercelJsonPath = join(root, 'vercel.json');

const required = [
  'swagger-ui.css',
  'swagger-ui-bundle.js',
  'swagger-ui-standalone-preset.js',
];

if (!existsSync(assetDir)) {
  console.error(
    `assert-swagger-ui-assets: missing ${assetDir} (ran copy-swagger-ui?)`,
  );
  process.exit(1);
}

for (const name of required) {
  const path = join(assetDir, name);
  if (!existsSync(path) || statSync(path).size === 0) {
    console.error(`assert-swagger-ui-assets: missing or empty ${path}`);
    process.exit(1);
  }
}

const vercel = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
const include = vercel?.functions?.['api/**']?.includeFiles;
const includeStr = typeof include === 'string' ? include : JSON.stringify(include ?? '');
if (!includeStr.includes('dist/assets/swagger-ui')) {
  console.error(
    `assert-swagger-ui-assets: vercel.json functions.api/**.includeFiles must cover dist/assets/swagger-ui (got: ${includeStr})`,
  );
  process.exit(1);
}

console.log(
  `assert-swagger-ui-assets: ok (${required.join(', ')} present; includeFiles covers dist/assets/swagger-ui)`,
);
