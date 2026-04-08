import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { configureSafety } from '../../../tools/coding/safety.js';
import { testRunnerTool } from '../../../tools/coding/test-runner.js';

const ROOT = join(process.cwd(), 'tmp-test-runner');

/** Short tool timeout so npx package downloads get killed fast */
const SHORT_TIMEOUT = 3000;

beforeAll(() => {
  mkdirSync(ROOT, { recursive: true });
  configureSafety({ projectRoot: ROOT });
});

afterEach(() => {
  try {
    rmSync(join(ROOT, 'package.json'));
  } catch {
    // File doesn't exist
  }
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('test_runner tool', () => {
  it('has correct metadata', () => {
    expect(testRunnerTool.name).toBe('test_runner');
    expect(testRunnerTool.label).toBe('Run Tests');
    expect(testRunnerTool.description).toBeTruthy();
    expect(testRunnerTool.parameters).toBeDefined();
    expect(typeof testRunnerTool.execute).toBe('function');
  });

  it('detects unknown framework when no package.json', async () => {
    const result = await testRunnerTool.execute({ timeout: SHORT_TIMEOUT });
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    const data = result.data as { framework: string };
    expect(data.framework).toBe('unknown');
  }, 15_000);

  it('detects vitest from package.json', async () => {
    writeFileSync(
      join(ROOT, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^2.0.0' } }),
    );

    const result = await testRunnerTool.execute({ timeout: SHORT_TIMEOUT });
    const data = result.data as { framework: string; command: string };
    expect(data.framework).toBe('vitest');
    expect(data.command).toContain('vitest');
  }, 15_000);

  it('detects jest from package.json', async () => {
    writeFileSync(
      join(ROOT, 'package.json'),
      JSON.stringify({ devDependencies: { jest: '^29.0.0' } }),
    );

    const result = await testRunnerTool.execute({ timeout: SHORT_TIMEOUT });
    const data = result.data as { framework: string; command: string };
    expect(data.framework).toBe('jest');
    expect(data.command).toContain('jest');
  }, 15_000);

  it('detects mocha from package.json', async () => {
    writeFileSync(
      join(ROOT, 'package.json'),
      JSON.stringify({ devDependencies: { mocha: '^10.0.0' } }),
    );

    const result = await testRunnerTool.execute({ timeout: SHORT_TIMEOUT });
    const data = result.data as { framework: string; command: string };
    expect(data.framework).toBe('mocha');
    expect(data.command).toContain('mocha');
  }, 15_000);

  it('includes file in command when specified', async () => {
    writeFileSync(
      join(ROOT, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^2.0.0' } }),
    );

    const result = await testRunnerTool.execute({
      file: 'src/test.ts',
      timeout: SHORT_TIMEOUT,
    });
    const data = result.data as { command: string };
    expect(data.command).toContain('src/test.ts');
  }, 15_000);

  it('returns structured summary in data', async () => {
    writeFileSync(
      join(ROOT, 'package.json'),
      JSON.stringify({
        name: 'test-summary',
        scripts: { test: 'echo "3 passing"' },
      }),
    );

    const result = await testRunnerTool.execute({ timeout: SHORT_TIMEOUT });
    const data = result.data as {
      summary: { passed: number; failed: number; skipped: number; total: number };
    };
    expect(data.summary).toBeDefined();
    expect(typeof data.summary.passed).toBe('number');
    expect(typeof data.summary.failed).toBe('number');
    expect(typeof data.summary.skipped).toBe('number');
    expect(typeof data.summary.total).toBe('number');
  }, 15_000);

  it('content field includes framework name', async () => {
    writeFileSync(
      join(ROOT, 'package.json'),
      JSON.stringify({ devDependencies: { vitest: '^2.0.0' } }),
    );

    const result = await testRunnerTool.execute({ timeout: SHORT_TIMEOUT });
    // On timeout, content may be undefined but data.framework is always set
    const data = result.data as { framework: string };
    expect(data.framework).toBe('vitest');
    if (result.content) {
      expect(result.content).toContain('Framework: vitest');
    }
  }, 15_000);

  it('reports timeout when command exceeds limit', async () => {
    // Create a standalone pnpm workspace so pnpm runs locally
    writeFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'packages: []\n');
    writeFileSync(join(ROOT, 'block.js'), 'setInterval(() => {}, 1000);\n');
    writeFileSync(
      join(ROOT, 'package.json'),
      JSON.stringify({
        name: 'test-timeout',
        scripts: { test: 'node block.js' },
      }),
    );

    const result = await testRunnerTool.execute({ timeout: 1500 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    rmSync(join(ROOT, 'block.js'), { force: true });
    rmSync(join(ROOT, 'pnpm-workspace.yaml'), { force: true });
  }, 15_000);

  it('always includes data even on timeout', async () => {
    writeFileSync(
      join(ROOT, 'package.json'),
      JSON.stringify({
        name: 'test-data-on-timeout',
        devDependencies: { vitest: '^2.0.0' },
        scripts: { test: 'node -e "setTimeout(()=>{},60000)"' },
      }),
    );

    const result = await testRunnerTool.execute({ timeout: 1500 });
    const data = result.data as { framework: string; command: string };
    expect(data).toBeDefined();
    expect(data.framework).toBe('vitest');
    expect(data.command).toContain('vitest');
  }, 15_000);
});
