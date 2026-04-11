/**
 * Template Structure Tests (R5-L5)
 *
 * Verifies that every create-revealui template:
 * 1. Scaffolds the expected file structure for each template variant
 * 2. Produces a valid package.json with the project name substituted
 * 3. Includes the required scripts (dev, build, typecheck)
 * 4. Has no TypeScript syntax errors (TS1xxx codes  -  not resolution errors which
 *    are expected when deps are not installed)
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../commands/create.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');
const TSC_BIN = path.resolve(__dirname, '../../../node_modules/.bin/tsc');

// ---------------------------------------------------------------------------
// Shared scaffolding helper
// ---------------------------------------------------------------------------

function baseConfig(template: 'basic-blog' | 'e-commerce' | 'portfolio', projectPath: string) {
  return {
    project: {
      projectName: `test-${template}`,
      projectPath,
      template,
    },
    database: { provider: 'skip' as const },
    storage: { provider: 'skip' as const },
    payment: { enabled: false },
    devenv: { createDevContainer: false, createDevbox: false },
    skipGit: true,
    skipInstall: true,
  };
}

// ---------------------------------------------------------------------------
// Template: file structure per variant
// ---------------------------------------------------------------------------

describe('Template file structure  -  shared (all templates)', () => {
  const templates = ['basic-blog', 'e-commerce', 'portfolio'] as const;

  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'revealui-struct-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  for (const template of templates) {
    it(`${template}: copies required root files`, async () => {
      const projectPath = path.join(tmpDir, template);
      await createProject(baseConfig(template, projectPath));

      const files = await fs.readdir(projectPath);
      expect(files).toContain('package.json');
      expect(files).toContain('tsconfig.json');
      expect(files).toContain('next.config.mjs');
      expect(files).toContain('.env.local');
      expect(files).toContain('README.md');
      expect(files).toContain('src');
    });

    it(`${template}: has .gitignore (renamed from _gitignore)`, async () => {
      const projectPath = path.join(tmpDir, `${template}-gi`);
      await createProject(baseConfig(template, projectPath));

      const files = await fs.readdir(projectPath);
      expect(files).toContain('.gitignore');
      expect(files).not.toContain('_gitignore');
    });

    it(`${template}: src/app/ contains layout.tsx and page.tsx`, async () => {
      const projectPath = path.join(tmpDir, `${template}-app`);
      await createProject(baseConfig(template, projectPath));

      const appFiles = await fs.readdir(path.join(projectPath, 'src', 'app'));
      expect(appFiles).toContain('layout.tsx');
      expect(appFiles).toContain('page.tsx');
    });
  }
});

// ---------------------------------------------------------------------------
// Template-specific file assertions
// ---------------------------------------------------------------------------

describe('Template file structure  -  variant-specific content', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'revealui-variant-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('basic-blog: has src/collections/Posts.ts', async () => {
    const projectPath = path.join(tmpDir, 'blog');
    await createProject(baseConfig('basic-blog', projectPath));

    const collectionsDir = path.join(projectPath, 'src', 'collections');
    const files = await fs.readdir(collectionsDir);
    expect(files).toContain('Posts.ts');
  });

  it('e-commerce: has src/collections/Products.ts and Orders.ts', async () => {
    const projectPath = path.join(tmpDir, 'shop');
    await createProject(baseConfig('e-commerce', projectPath));

    const collectionsDir = path.join(projectPath, 'src', 'collections');
    const files = await fs.readdir(collectionsDir);
    expect(files).toContain('Products.ts');
    expect(files).toContain('Orders.ts');
  });

  it('portfolio: has src/collections/Projects.ts', async () => {
    const projectPath = path.join(tmpDir, 'portfolio');
    await createProject(baseConfig('portfolio', projectPath));

    const collectionsDir = path.join(projectPath, 'src', 'collections');
    const files = await fs.readdir(collectionsDir);
    expect(files).toContain('Projects.ts');
  });
});

// ---------------------------------------------------------------------------
// package.json integrity after scaffolding
// ---------------------------------------------------------------------------

describe('package.json integrity after scaffolding', () => {
  const templates = ['basic-blog', 'e-commerce', 'portfolio'] as const;

  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'revealui-pkg-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  for (const template of templates) {
    it(`${template}: project name is substituted in package.json`, async () => {
      const projectPath = path.join(tmpDir, template);
      await createProject(baseConfig(template, projectPath));

      const pkg = JSON.parse(
        await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'),
      ) as Record<string, unknown>;
      expect(pkg.name).toBe(`test-${template}`);
      expect(pkg.name).not.toContain('{{PROJECT_NAME}}');
    });

    it(`${template}: package.json has required scripts`, async () => {
      const projectPath = path.join(tmpDir, `${template}-scripts`);
      await createProject(baseConfig(template, projectPath));

      const pkg = JSON.parse(
        await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'),
      ) as { scripts?: Record<string, string> };
      expect(pkg.scripts).toBeDefined();
      expect(typeof pkg.scripts?.dev).toBe('string');
      expect(typeof pkg.scripts?.build).toBe('string');
      expect(typeof pkg.scripts?.typecheck).toBe('string');
    });

    it(`${template}: package.json has @revealui/core dependency`, async () => {
      const projectPath = path.join(tmpDir, `${template}-deps`);
      await createProject(baseConfig(template, projectPath));

      const pkg = JSON.parse(
        await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'),
      ) as { dependencies?: Record<string, string> };
      expect(pkg.dependencies?.['@revealui/core']).toBeDefined();
      expect(pkg.dependencies?.['@revealui/core']).toMatch(/^(latest|\^?\d+\.\d+)/);
    });
  }
});

// ---------------------------------------------------------------------------
// tsconfig.json validity
// ---------------------------------------------------------------------------

describe('tsconfig.json validity', () => {
  const templates = ['basic-blog', 'e-commerce', 'portfolio', 'starter'] as const;

  for (const template of templates) {
    it(`${template}: tsconfig.json is valid JSON with include field`, async () => {
      const tsconfigPath = path.join(TEMPLATES_DIR, template, 'tsconfig.json');
      const raw = await fs.readFile(tsconfigPath, 'utf-8');
      const tsconfig = JSON.parse(raw) as { include?: string[]; compilerOptions?: unknown };
      expect(Array.isArray(tsconfig.include)).toBe(true);
      expect((tsconfig.include as string[]).length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// TypeScript syntax check  -  no TS1xxx syntax errors in template source files
// ---------------------------------------------------------------------------

describe('TypeScript syntax  -  template source files', () => {
  /**
   * Collect all .ts and .tsx files under a directory recursively.
   */
  async function collectTsFiles(dir: string): Promise<string[]> {
    let results: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(await collectTsFiles(full));
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        results.push(full);
      }
    }
    return results;
  }

  /**
   * Run tsc on the given files and return lines that are TS1xxx syntax errors.
   * TS2xxx errors (module resolution / type errors) are expected without deps and
   * are NOT returned.
   */
  function collectSyntaxErrors(files: string[]): string[] {
    if (files.length === 0) return [];
    let output = '';
    try {
      execFileSync(
        TSC_BIN,
        [
          '--noEmit',
          '--noResolve',
          '--skipLibCheck',
          '--allowImportingTsExtensions',
          '--jsx',
          'react-jsx',
          '--lib',
          'es2022',
          '--strict',
          'false',
          ...files,
        ],
        { encoding: 'utf-8', stdio: 'pipe' },
      );
    } catch (err) {
      output = (err as { stdout?: string; stderr?: string }).stdout ?? '';
    }
    // Only surface TS1xxx (syntax) errors  -  TS2xxx are expected without node_modules
    return output.split('\n').filter((line) => /error TS1\d{3}/.test(line));
  }

  const templates = ['basic-blog', 'e-commerce', 'portfolio', 'starter'] as const;

  for (const template of templates) {
    it(`${template}: no syntax errors in .ts/.tsx source files`, async () => {
      const srcDir = path.join(TEMPLATES_DIR, template, 'src');
      const files = await collectTsFiles(srcDir);
      expect(files.length).toBeGreaterThan(0);

      const syntaxErrors = collectSyntaxErrors(files);
      expect(
        syntaxErrors,
        `Syntax errors in ${template} template:\n${syntaxErrors.join('\n')}`,
      ).toHaveLength(0);
    });
  }
});
