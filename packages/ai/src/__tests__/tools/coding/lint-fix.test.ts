import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { lintFixTool } from '../../../tools/coding/lint-fix.js';
import { configureSafety } from '../../../tools/coding/safety.js';

const ROOT = join(process.cwd(), 'tmp-test-lint-fix');

/** Short tool timeout so npx package downloads get killed fast */
const SHORT_TIMEOUT = 3000;

beforeAll(() => {
  mkdirSync(ROOT, { recursive: true });
  configureSafety({ projectRoot: ROOT });
});

afterEach(() => {
  for (const f of ['biome.json', 'biome.jsonc', 'package.json']) {
    try {
      rmSync(join(ROOT, f));
    } catch {
      // File doesn't exist
    }
  }
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('lint_fix tool', () => {
  it('has correct metadata', () => {
    expect(lintFixTool.name).toBe('lint_fix');
    expect(lintFixTool.label).toBe('Lint & Fix');
    expect(lintFixTool.description).toBeTruthy();
    expect(lintFixTool.parameters).toBeDefined();
    expect(typeof lintFixTool.execute).toBe('function');
  });

  it('detects unknown linter when no config or package.json', async () => {
    const result = await lintFixTool.execute({ timeout: SHORT_TIMEOUT });
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    const data = result.data as { linter: string };
    expect(data.linter).toBe('unknown');
  }, 15_000);

  it('detects biome from biome.json', async () => {
    writeFileSync(join(ROOT, 'biome.json'), JSON.stringify({ $schema: '' }));

    const result = await lintFixTool.execute({ timeout: SHORT_TIMEOUT });
    const data = result.data as { linter: string; command: string };
    expect(data.linter).toBe('biome');
    expect(data.command).toContain('biome');
  }, 15_000);

  it('detects biome from biome.jsonc', async () => {
    writeFileSync(join(ROOT, 'biome.jsonc'), '{}');

    const result = await lintFixTool.execute({ timeout: SHORT_TIMEOUT });
    const data = result.data as { linter: string; command: string };
    expect(data.linter).toBe('biome');
  }, 15_000);

  it('detects eslint from package.json', async () => {
    writeFileSync(
      join(ROOT, 'package.json'),
      JSON.stringify({ devDependencies: { eslint: '^9.0.0' } }),
    );

    const result = await lintFixTool.execute({ timeout: SHORT_TIMEOUT });
    const data = result.data as { linter: string; command: string };
    expect(data.linter).toBe('eslint');
    expect(data.command).toContain('eslint');
  }, 15_000);

  it('biome config takes precedence over eslint in package.json', async () => {
    writeFileSync(join(ROOT, 'biome.json'), JSON.stringify({ $schema: '' }));
    writeFileSync(
      join(ROOT, 'package.json'),
      JSON.stringify({ devDependencies: { eslint: '^9.0.0' } }),
    );

    const result = await lintFixTool.execute({ timeout: SHORT_TIMEOUT });
    const data = result.data as { linter: string };
    expect(data.linter).toBe('biome');
  }, 15_000);

  it('includes --write flag for biome when fix=true', async () => {
    writeFileSync(join(ROOT, 'biome.json'), JSON.stringify({ $schema: '' }));

    const result = await lintFixTool.execute({ fix: true, timeout: SHORT_TIMEOUT });
    const data = result.data as { command: string };
    expect(data.command).toContain('--write');
  }, 15_000);

  it('includes --fix flag for eslint when fix=true', async () => {
    writeFileSync(
      join(ROOT, 'package.json'),
      JSON.stringify({ devDependencies: { eslint: '^9.0.0' } }),
    );

    const result = await lintFixTool.execute({ fix: true, timeout: SHORT_TIMEOUT });
    const data = result.data as { command: string };
    expect(data.command).toContain('--fix');
  }, 15_000);

  it('targets specific file when provided', async () => {
    writeFileSync(join(ROOT, 'biome.json'), JSON.stringify({ $schema: '' }));

    const result = await lintFixTool.execute({
      file: 'src/index.ts',
      timeout: SHORT_TIMEOUT,
    });
    const data = result.data as { command: string };
    expect(data.command).toContain('src/index.ts');
  }, 15_000);

  it('returns structured summary in data', async () => {
    writeFileSync(join(ROOT, 'biome.json'), JSON.stringify({ $schema: '' }));

    const result = await lintFixTool.execute({ timeout: SHORT_TIMEOUT });
    const data = result.data as {
      summary: { errors: number; warnings: number; total: number };
    };
    expect(data.summary).toBeDefined();
    expect(typeof data.summary.errors).toBe('number');
    expect(typeof data.summary.warnings).toBe('number');
    expect(typeof data.summary.total).toBe('number');
  }, 15_000);

  it('content field includes linter name', async () => {
    writeFileSync(join(ROOT, 'biome.json'), JSON.stringify({ $schema: '' }));

    const result = await lintFixTool.execute({ timeout: SHORT_TIMEOUT });
    if (result.content) {
      expect(result.content).toContain('Linter: biome');
    }
    // Also verify via data
    const data = result.data as { linter: string };
    expect(data.linter).toBe('biome');
  }, 15_000);

  it('reports timeout when command exceeds limit', async () => {
    // Create a standalone pnpm workspace so pnpm runs locally
    writeFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'packages: []\n');
    writeFileSync(join(ROOT, 'block.js'), 'setInterval(() => {}, 1000);\n');
    writeFileSync(
      join(ROOT, 'package.json'),
      JSON.stringify({
        name: 'test-timeout',
        scripts: { lint: 'node block.js' },
      }),
    );

    const result = await lintFixTool.execute({ timeout: 100 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    rmSync(join(ROOT, 'block.js'), { force: true });
    rmSync(join(ROOT, 'pnpm-workspace.yaml'), { force: true });
  }, 15_000);

  it('always includes data even on timeout', async () => {
    writeFileSync(join(ROOT, 'biome.json'), JSON.stringify({ $schema: '' }));
    writeFileSync(
      join(ROOT, 'package.json'),
      JSON.stringify({
        name: 'test-data-on-timeout',
        scripts: { lint: 'node -e "setTimeout(()=>{},60000)"' },
      }),
    );

    // biome.json present → detected as biome, but npx biome takes too long
    const result = await lintFixTool.execute({ timeout: 1500 });
    const data = result.data as { linter: string; command: string };
    expect(data).toBeDefined();
    expect(data.linter).toBe('biome');
    expect(data.command).toContain('biome');
  }, 15_000);
});
