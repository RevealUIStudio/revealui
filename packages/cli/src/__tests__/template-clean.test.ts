/**
 * Template Clean Room Tests
 *
 * Verifies that the create-revealui templates contain no machine-specific paths,
 * internal developer references, or workspace internals that would leak into
 * scaffolded customer projects.
 *
 * This is Phase 2.11 "Internal vs Productized Boundary" enforcement.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../../templates');

// Patterns that must never appear in template files
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\/home\/[a-zA-Z0-9_-]+\/projects\//,
    reason: 'absolute Linux home path (machine-specific)',
  },
  {
    pattern: /C:\\Users\\[a-zA-Z0-9_-]+\\/,
    reason: 'absolute Windows user path (machine-specific)',
  },
  {
    pattern: /\/mnt\/wsl-dev\//,
    reason: 'DevBox mount path (machine-specific)',
  },
  {
    pattern: /workspace:\*/,
    reason: 'pnpm workspace reference (internal monorepo only)',
  },
  {
    pattern: /\.claude\//,
    reason: '.claude/ directory reference (internal tooling)',
  },
  {
    pattern: /MASTER_PLAN\.md/,
    reason: 'MASTER_PLAN.md reference (internal planning doc)',
  },
  {
    pattern: /business\//,
    reason: 'business/ directory reference (internal)',
  },
  {
    pattern: /founder@revealui\.com/,
    reason: 'founder email address (internal identity)',
  },
  {
    pattern: /RevealUIStudio\//,
    reason: 'GitHub org reference (internal)',
  },
];

async function collectTemplateFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTemplateFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

describe('create-revealui template clean room', () => {
  it('templates directory exists', async () => {
    const stat = await fs.stat(TEMPLATES_DIR);
    expect(stat.isDirectory()).toBe(true);
  });

  it('contains at least one template', async () => {
    const entries = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());
    expect(dirs.length).toBeGreaterThan(0);
  });

  it('template files contain no forbidden patterns', async () => {
    const files = await collectTemplateFiles(TEMPLATES_DIR);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const file of files) {
      // Skip binary files (images, fonts, etc.) by extension
      const ext = path.extname(file).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'].includes(ext)) {
        continue;
      }

      const content = await fs.readFile(file, 'utf8');
      const relPath = path.relative(TEMPLATES_DIR, file);

      for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`  ${relPath}: contains ${reason} (${pattern})`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Template clean room violations found:\n${violations.join('\n')}\n\n` +
          'These patterns must be removed before publishing the CLI package.',
      );
    }
  });

  it('package.json templates use "latest" not workspace references', async () => {
    const files = await collectTemplateFiles(TEMPLATES_DIR);
    const packageJsonFiles = files.filter((f) => path.basename(f) === 'package.json');

    for (const file of packageJsonFiles) {
      const content = await fs.readFile(file, 'utf8');
      const pkg = JSON.parse(content) as { dependencies?: Record<string, string> };
      const allDeps = {
        ...pkg.dependencies,
      };
      for (const [dep, version] of Object.entries(allDeps)) {
        if (dep.startsWith('@revealui/')) {
          expect(
            version,
            `${dep} in ${path.relative(TEMPLATES_DIR, file)} should use "latest" not "${version}"`,
          ).not.toMatch(/^workspace:/);
        }
      }
    }
  });
});
