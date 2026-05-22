/**
 * Copies the resvg WASM next to the built bundle (dist/index_bg.wasm).
 *
 * apps/server/src/routes/og.ts reads this file at runtime via readFileSync.
 * @vercel/nft cannot trace that dynamic read into node_modules, so without a
 * colocated copy (plus vercel.json `includeFiles`) the file is missing from
 * the serverless function and GET /api/og throws ENOENT. Copying it into dist
 * on every build keeps the endpoint working on Vercel, Fly, and Docker alike.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const wasmSource = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const wasmDest = join(distDir, 'index_bg.wasm');

mkdirSync(distDir, { recursive: true });
copyFileSync(wasmSource, wasmDest);
process.stdout.write(`copy-resvg-wasm: ${wasmSource} -> ${wasmDest}\n`);
