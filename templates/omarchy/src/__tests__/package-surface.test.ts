import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEMPLATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('Omarchy package surface', () => {
  it('does not depend on @vercel/analytics, Vercel Web Analytics, or random binaries', () => {
    const pkg = JSON.parse(readFileSync(join(TEMPLATE_ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ];
    expect(names.includes('@vercel/analytics')).toBe(false);
    expect(names.some((name) => name.toLowerCase().includes('web-analytics'))).toBe(false);
    expect(names).toEqual(['zod', '@revealui/dev', '@types/node', 'typescript', 'vitest']);
  });

  it('is a private template, not a published SKU name', () => {
    const pkg = JSON.parse(readFileSync(join(TEMPLATE_ROOT, 'package.json'), 'utf8')) as {
      name: string;
      private?: boolean;
    };
    expect(pkg.private).toBe(true);
    expect(pkg.name).toBe('omarchy');
  });
});
