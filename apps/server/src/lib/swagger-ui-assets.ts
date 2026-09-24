/**
 * Swagger UI static assets for GET /docs.
 *
 * `@vercel/nft` does not follow `import.meta.resolve('swagger-ui-dist/...')`,
 * so the package is missing from the serverless filesystem even when it is a
 * dependency. Production then throws
 * `Cannot find package 'swagger-ui-dist'` on the first /docs asset request
 * (REVEALUI-SERVER-E, REVEALUI-STAGING-1).
 *
 * `copy-swagger-ui` writes the three files to `dist/assets/swagger-ui`, and
 * `vercel.json` `includeFiles` ships that directory. Read the colocated copy
 * first. Fall back to the package only for `tsx` / local runs before a build.
 *
 * Lazy: callers must not invoke this at module top level. A throw during
 * import of the docs route would abort the whole handler, including /health
 * (2026-07-21 FUNCTION_INVOCATION_FAILED class).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SWAGGER_UI_ASSET_FILES = [
  'swagger-ui.css',
  'swagger-ui-bundle.js',
  'swagger-ui-standalone-preset.js',
] as const;

export type SwaggerUiAssetName = (typeof SWAGGER_UI_ASSET_FILES)[number];

export interface SwaggerAssets {
  css: string;
  bundleJs: string;
  presetJs: string;
}

const ASSET_DIR_NAME = 'swagger-ui';

/**
 * Resolution order (covers tsup chunks, Vercel includeFiles layout, tsx):
 * 1. next to this module (`dist/assets/swagger-ui` when the chunk is in dist/)
 * 2. one level up (chunk emitted under a dist subdirectory)
 * 3. process.cwd()/dist/assets/swagger-ui and process.cwd()/assets/swagger-ui
 */
export function swaggerUiAssetCandidates(moduleDir: string, filename: string): readonly string[] {
  const cwd = process.cwd();
  return [
    join(moduleDir, 'assets', ASSET_DIR_NAME, filename),
    join(moduleDir, '..', 'assets', ASSET_DIR_NAME, filename),
    join(cwd, 'dist', 'assets', ASSET_DIR_NAME, filename),
    join(cwd, 'assets', ASSET_DIR_NAME, filename),
  ];
}

function readPackageSwaggerUiAsset(filename: SwaggerUiAssetName): string {
  const fromPackage = fileURLToPath(import.meta.resolve(`swagger-ui-dist/${filename}`));
  return readFileSync(fromPackage, 'utf-8');
}

/**
 * Read one Swagger UI file.
 *
 * `moduleDir` defaults to this module's directory. Tests pass a fixture
 * directory so a colocated file wins even when `swagger-ui-dist` cannot be
 * resolved (the Vercel failure mode).
 */
export function readSwaggerUiAsset(
  filename: SwaggerUiAssetName,
  moduleDir: string = dirname(fileURLToPath(import.meta.url)),
): string {
  for (const path of swaggerUiAssetCandidates(moduleDir, filename)) {
    try {
      return readFileSync(path, 'utf-8');
    } catch {
      // try next candidate
    }
  }
  try {
    return readPackageSwaggerUiAsset(filename);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Swagger UI asset not found: ${filename} (ran copy-swagger-ui? expected under dist/assets/swagger-ui). ${reason}`,
    );
  }
}

let swaggerAssetsCache: SwaggerAssets | null = null;

/** Lazy singleton — safe for cold starts; never runs at import time. */
export function loadSwaggerAssets(): SwaggerAssets {
  if (!swaggerAssetsCache) {
    swaggerAssetsCache = {
      css: readSwaggerUiAsset('swagger-ui.css'),
      bundleJs: readSwaggerUiAsset('swagger-ui-bundle.js'),
      presetJs: readSwaggerUiAsset('swagger-ui-standalone-preset.js'),
    };
  }
  return swaggerAssetsCache;
}

/** Test-only: drop the singleton so path-resolution tests can re-run. */
export function resetSwaggerAssetsCacheForTests(): void {
  swaggerAssetsCache = null;
}
