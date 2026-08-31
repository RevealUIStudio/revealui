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
import { type ProjectConfig, VALID_TEMPLATES } from '../prompts/project.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');
const TSC_BIN = path.resolve(__dirname, '../../../node_modules/.bin/tsc');

// ---------------------------------------------------------------------------
// Shared scaffolding helper
// ---------------------------------------------------------------------------

function baseConfig(template: ProjectConfig['template'], projectPath: string) {
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
  const templates = ['basic-blog', 'e-commerce', 'portfolio', 'starter'] as const;

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
      expect(files).toContain('vercel.json');
      expect(files).toContain('.env.development.local');
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

  it('starter: copies vercel.json for the buyer Vercel one-click', async () => {
    const projectPath = path.join(tmpDir, 'starter-vercel');
    await createProject(baseConfig('starter', projectPath));

    const files = await fs.readdir(projectPath);
    expect(files).toContain('vercel.json');
    const vercel = JSON.parse(
      await fs.readFile(path.join(projectPath, 'vercel.json'), 'utf-8'),
    ) as {
      framework?: string;
      installCommand?: string;
      buildCommand?: string;
    };
    expect(vercel.framework).toBe('nextjs');
    expect(vercel.installCommand).toBe('pnpm install');
    expect(vercel.buildCommand).toBe('pnpm build');
  });

  it('basic-blog: does not ship a Vercel one-click vercel.json', async () => {
    const projectPath = path.join(tmpDir, 'blog-no-vercel');
    await createProject(baseConfig('basic-blog', projectPath));
    const files = await fs.readdir(projectPath);
    expect(files).not.toContain('vercel.json');
  });
});

// ---------------------------------------------------------------------------
// package.json integrity after scaffolding
// ---------------------------------------------------------------------------

describe('package.json integrity after scaffolding', () => {
  const templates = ['basic-blog', 'e-commerce', 'portfolio', 'starter'] as const;

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

    it(`${template}: package.json has @revealui/core and @revealui/presentation`, async () => {
      const projectPath = path.join(tmpDir, `${template}-deps`);
      await createProject(baseConfig(template, projectPath));

      const pkg = JSON.parse(
        await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'),
      ) as { dependencies?: Record<string, string> };
      expect(pkg.dependencies?.['@revealui/core']).toBeDefined();
      expect(pkg.dependencies?.['@revealui/core']).toMatch(/^(latest|\^?\d+\.\d+)/);
      expect(pkg.dependencies?.['@revealui/presentation']).toBeDefined();
      expect(pkg.dependencies?.['@revealui/presentation']).toMatch(/^(latest|\^?\d+\.\d+)/);
    });

    // Regression test: next.config.mjs sets reactCompiler: true, but next lists
    // babel-plugin-react-compiler only as an OPTIONAL peer dependency, so pnpm
    // never installs it unless the template declares it directly. Without it,
    // `pnpm build` fails with "Failed to resolve package babel-plugin-react-compiler".
    // @types/react and @types/node must also be declared directly so an offline
    // or --frozen-lockfile build doesn't depend on Next auto-installing them.
    it(`${template}: package.json declares babel-plugin-react-compiler and @types/{react,node}`, async () => {
      const projectPath = path.join(tmpDir, `${template}-compiler-deps`);
      await createProject(baseConfig(template, projectPath));

      const pkg = JSON.parse(
        await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'),
      ) as { devDependencies?: Record<string, string> };
      expect(pkg.devDependencies?.['babel-plugin-react-compiler']).toBeDefined();
      expect(pkg.devDependencies?.['@types/react']).toBeDefined();
      expect(pkg.devDependencies?.['@types/node']).toBeDefined();
    });
  }
});

// ---------------------------------------------------------------------------
// Template registry  -  the selectable list must match shipped directories
// ---------------------------------------------------------------------------

describe('Template registry', () => {
  it('VALID_TEMPLATES matches the template directories shipped in the tarball', async () => {
    const entries = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
    const shipped = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect([...VALID_TEMPLATES].sort()).toEqual(shipped);
  });
});

// ---------------------------------------------------------------------------
// tsconfig.json validity
// ---------------------------------------------------------------------------

describe('tsconfig.json validity', () => {
  const templates = ['basic-blog', 'e-commerce', 'portfolio', 'starter', 'starter-native'] as const;

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

  // starter-native has a Vite shape (app/ + src/), not the Next.js shape (src/app/).
  // Scan both directories for syntax errors.
  it('starter-native: no syntax errors in app/ + src/ .ts/.tsx files', async () => {
    const templateDir = path.join(TEMPLATES_DIR, 'starter-native');
    const appFiles = await collectTsFiles(path.join(templateDir, 'app'));
    const srcFiles = await collectTsFiles(path.join(templateDir, 'src'));
    const files = [...appFiles, ...srcFiles];
    expect(files.length).toBeGreaterThan(0);

    const syntaxErrors = collectSyntaxErrors(files);
    expect(
      syntaxErrors,
      `Syntax errors in starter-native template:\n${syntaxErrors.join('\n')}`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// starter-native: file structure (differs from Next.js templates — has app/
// + vite.config.ts + index.html instead of src/app/ + next.config.mjs)
// ---------------------------------------------------------------------------

describe('Template file structure  -  starter-native (Vite + @revealui/router)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'revealui-struct-native-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('copies required root files (Vite shape, no next.config.mjs)', async () => {
    const projectPath = path.join(tmpDir, 'native');
    await createProject(baseConfig('starter-native', projectPath));

    const files = await fs.readdir(projectPath);
    expect(files).toContain('package.json');
    expect(files).toContain('tsconfig.json');
    expect(files).toContain('vite.config.ts');
    expect(files).toContain('vitest.config.ts');
    expect(files).toContain('index.html');
    expect(files).toContain('vercel.json');
    expect(files).toContain('.env.development.local'); // CLI-generated
    expect(files).toContain('README.md'); // CLI-generated
    expect(files).toContain('app');
    expect(files).toContain('src');
    expect(files).not.toContain('next.config.mjs');
  });

  it('has .gitignore (renamed from _gitignore)', async () => {
    const projectPath = path.join(tmpDir, 'native-gi');
    await createProject(baseConfig('starter-native', projectPath));

    const files = await fs.readdir(projectPath);
    expect(files).toContain('.gitignore');
    expect(files).not.toContain('_gitignore');
  });

  it('app/ contains App.tsx, main.tsx, routes/, layouts/, styles/', async () => {
    const projectPath = path.join(tmpDir, 'native-app');
    await createProject(baseConfig('starter-native', projectPath));

    const appFiles = await fs.readdir(path.join(projectPath, 'app'));
    expect(appFiles).toContain('App.tsx');
    expect(appFiles).toContain('main.tsx');
    expect(appFiles).toContain('routes');
    expect(appFiles).toContain('layouts');
    expect(appFiles).toContain('styles');
  });

  it('package.json declares @revealui/router and not next', async () => {
    const projectPath = path.join(tmpDir, 'native-deps');
    await createProject(baseConfig('starter-native', projectPath));

    const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8')) as {
      name?: string;
      dependencies?: Record<string, string>;
    };

    expect(pkg.name).toBe('test-starter-native');
    expect(pkg.dependencies?.['@revealui/router']).toBeDefined();
    expect(pkg.dependencies?.['@revealui/core']).toBeDefined();
    expect(pkg.dependencies?.['@revealui/presentation']).toBeDefined();
    expect(pkg.dependencies?.next).toBeUndefined();
  });

  it('package.json has Vite scripts (dev/build/preview/typecheck/test)', async () => {
    const projectPath = path.join(tmpDir, 'native-scripts');
    await createProject(baseConfig('starter-native', projectPath));

    const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8')) as {
      scripts?: Record<string, string>;
    };

    expect(pkg.scripts?.dev).toMatch(/vite/);
    expect(pkg.scripts?.build).toMatch(/vite build/);
    expect(pkg.scripts?.preview).toMatch(/vite preview/);
    expect(typeof pkg.scripts?.typecheck).toBe('string');
    expect(typeof pkg.scripts?.test).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// GAP-479: templates must import presentation (not only declare the dep)
// ---------------------------------------------------------------------------

describe('Template presentation composition (GAP-479)', () => {
  const templates = ['basic-blog', 'e-commerce', 'portfolio', 'starter', 'starter-native'] as const;

  async function collectSourceFiles(dir: string): Promise<string[]> {
    let results: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(await collectSourceFiles(full));
      } else if (/\.(tsx|ts|css)$/.test(entry.name)) {
        results.push(full);
      }
    }
    return results;
  }

  for (const template of templates) {
    it(`${template}: source imports @revealui/presentation`, async () => {
      const roots =
        template === 'starter-native'
          ? [path.join(TEMPLATES_DIR, template, 'app')]
          : [path.join(TEMPLATES_DIR, template, 'src')];
      const files = (await Promise.all(roots.map(collectSourceFiles))).flat();
      const hits = [];
      for (const file of files) {
        const source = await fs.readFile(file, 'utf-8');
        if (source.includes('@revealui/presentation')) {
          hits.push(file);
        }
      }
      expect(hits.length, `${template} never imports @revealui/presentation`).toBeGreaterThan(0);
    });

    it(`${template}: stylesheet imports presentation tokens`, async () => {
      const cssPath =
        template === 'starter-native'
          ? path.join(TEMPLATES_DIR, template, 'app', 'styles', 'globals.css')
          : path.join(TEMPLATES_DIR, template, 'src', 'app', 'globals.css');
      const css = await fs.readFile(cssPath, 'utf-8');
      expect(css).toContain('@revealui/presentation/tokens.css');
    });
  }
});

// ---------------------------------------------------------------------------
// Vercel one-click: each shipped template carries a customer vercel.json
// ---------------------------------------------------------------------------

describe('Template vercel.json (customer runtime deploy)', () => {
  const nextTemplates = ['basic-blog', 'e-commerce', 'portfolio', 'starter'] as const;

  for (const template of nextTemplates) {
    it(`${template}: vercel.json names Next.js and does not buy add-ons`, async () => {
      const raw = await fs.readFile(path.join(TEMPLATES_DIR, template, 'vercel.json'), 'utf-8');
      const config = JSON.parse(raw) as {
        $schema?: string;
        framework?: string;
        stores?: unknown;
      };
      expect(config.$schema).toBe('https://openapi.vercel.sh/vercel.json');
      expect(config.framework).toBe('nextjs');
      expect(config.stores).toBeUndefined();
      expect(raw.includes('neon')).toBe(false);
      expect(raw.includes('blob')).toBe(false);
    });
  }

  it('starter-native: vercel.json names Vite with an SPA rewrite', async () => {
    const raw = await fs.readFile(
      path.join(TEMPLATES_DIR, 'starter-native', 'vercel.json'),
      'utf-8',
    );
    const config = JSON.parse(raw) as {
      $schema?: string;
      framework?: string;
      rewrites?: Array<{ source: string; destination: string }>;
    };
    expect(config.$schema).toBe('https://openapi.vercel.sh/vercel.json');
    expect(config.framework).toBe('vite');
    expect(config.rewrites?.some((rule) => rule.destination === '/index.html')).toBe(true);
  });
});
