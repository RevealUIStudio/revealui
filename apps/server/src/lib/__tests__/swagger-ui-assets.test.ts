import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  readSwaggerUiAsset,
  type SwaggerUiAssetName,
  swaggerUiAssetCandidates,
} from '../swagger-ui-assets.js';

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function fixtureModuleDir(files: Readonly<Record<string, string>>): string {
  const moduleDir = mkdtempSync(join(tmpdir(), 'swagger-ui-assets-'));
  const assetDir = join(moduleDir, 'assets', 'swagger-ui');
  mkdirSync(assetDir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(assetDir, name), body);
  }
  return moduleDir;
}

describe('swagger-ui asset resolution (REVEALUI-SERVER-E)', () => {
  it('serves colocated bytes without resolving swagger-ui-dist', () => {
    const sentinel = 'COLOCATED_SWAGGER_CSS_SENTINEL';
    const moduleDir = fixtureModuleDir({ 'swagger-ui.css': sentinel });
    // A missing package must not matter when the Vercel includeFiles copy exists.
    expect(readSwaggerUiAsset('swagger-ui.css', moduleDir)).toBe(sentinel);
  });

  it('falls back to the installed swagger-ui-dist package for tsx/dev', () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'swagger-ui-empty-'));
    const css = readSwaggerUiAsset('swagger-ui.css', emptyDir);
    expect(css.includes('.swagger-ui')).toBe(true);
    const bundle = readSwaggerUiAsset('swagger-ui-bundle.js', emptyDir);
    expect(bundle.includes('SwaggerUIBundle')).toBe(true);
    const preset = readSwaggerUiAsset('swagger-ui-standalone-preset.js', emptyDir);
    expect(preset.includes('SwaggerUIStandalonePreset')).toBe(true);
  });

  it('throws a copy-step error when neither the colocated file nor the package subpath exists', () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'swagger-ui-missing-'));
    expect(() => readSwaggerUiAsset('not-shipped.css' as SwaggerUiAssetName, emptyDir)).toThrow(
      'Swagger UI asset not found: not-shipped.css',
    );
  });

  it('lists the colocated dist path first so NFT includeFiles is the production read', () => {
    const candidates = swaggerUiAssetCandidates('/var/task/apps/server/dist', 'swagger-ui.css');
    expect(candidates[0]).toBe('/var/task/apps/server/dist/assets/swagger-ui/swagger-ui.css');
  });

  it('vercel.json includeFiles covers dist/assets/swagger-ui', () => {
    const vercel = JSON.parse(readFileSync(join(serverRoot, 'vercel.json'), 'utf-8')) as {
      functions?: { 'api/**'?: { includeFiles?: string } };
    };
    const includeFiles = vercel.functions?.['api/**']?.includeFiles ?? '';
    expect(includeFiles.includes('dist/assets/swagger-ui')).toBe(true);
  });
});
