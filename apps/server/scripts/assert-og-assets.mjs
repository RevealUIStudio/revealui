/**
 * Build-time contract: OG fonts exist under dist/ and vercel.json includeFiles
 * ships them. Catches the 2026-07-21 class where runtime readFileSync failed
 * in the function because assets never landed in the NFT payload.
 *
 * Invoked from package.json build after copy-og-fonts.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const fontsDir = join(root, 'dist', 'assets', 'fonts');
const vercelJsonPath = join(root, 'vercel.json');

const required = ['InterTight-Regular.ttf', 'InterTight-Bold.ttf'];

if (!existsSync(fontsDir)) {
  console.error(`assert-og-assets: missing fonts dir ${fontsDir} (ran copy-og-fonts?)`);
  process.exit(1);
}

const present = new Set(readdirSync(fontsDir));
for (const name of required) {
  if (!present.has(name)) {
    console.error(`assert-og-assets: missing ${name} in ${fontsDir}`);
    process.exit(1);
  }
}

const vercel = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
const include = vercel?.functions?.['api/**']?.includeFiles;
const includeStr = typeof include === 'string' ? include : JSON.stringify(include ?? '');
if (!includeStr.includes('dist/assets/fonts')) {
  console.error(
    `assert-og-assets: vercel.json functions.api/**.includeFiles must cover dist/assets/fonts (got: ${includeStr})`,
  );
  process.exit(1);
}

console.log(
  `assert-og-assets: ok (${required.join(', ')} present; includeFiles covers dist/assets/fonts)`,
);
