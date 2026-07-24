import { describe, expect, it } from 'vitest';
import { createVitestConfig } from '../vitest/create-config.js';

describe('createVitestConfig', () => {
  it('applies node package defaults', () => {
    const config = createVitestConfig();
    expect(config.test?.globals).toBe(true);
    expect(config.test?.environment).toBe('node');
    expect(config.test?.pool).toBe('forks');
    expect(config.test?.maxWorkers).toBe(2);
    expect(config.test?.include).toEqual([
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
    ]);
    expect(config.test?.exclude).toEqual(['**/node_modules/**', '**/dist/**']);
  });

  it('includes standard coverage reporters and omits thresholds by default', () => {
    const config = createVitestConfig();
    const coverage = config.test?.coverage as {
      provider?: string;
      reporter?: string[];
      thresholds?: unknown;
    };
    expect(coverage?.provider).toBe('v8');
    expect(coverage?.reporter).toEqual(['text', 'json', 'html', 'lcov']);
    expect(coverage?.thresholds).toBeUndefined();
  });

  it('accepts parameterized thresholds', () => {
    const thresholds = { lines: 70, functions: 65, branches: 65, statements: 70 };
    const config = createVitestConfig({ thresholds });
    const coverage = config.test?.coverage as { thresholds?: typeof thresholds };
    expect(coverage?.thresholds).toEqual(thresholds);
  });

  it('can disable coverage entirely', () => {
    const config = createVitestConfig({ coverage: false });
    expect(config.test?.coverage).toBeUndefined();
  });

  it('merges overrides for env and aliases', () => {
    const config = createVitestConfig({
      overrides: {
        test: {
          env: { NODE_ENV: 'test' },
        },
        resolve: {
          alias: { '@': './src' },
        },
      },
    });
    expect(config.test?.env).toMatchObject({ NODE_ENV: 'test' });
    expect(config.test?.globals).toBe(true);
    expect(config.resolve?.alias).toBeDefined();
  });

  it('honors environment and timeout options', () => {
    const config = createVitestConfig({
      environment: 'jsdom',
      hookTimeout: 30_000,
      testTimeout: 60_000,
      maxWorkers: 1,
    });
    expect(config.test?.environment).toBe('jsdom');
    expect(config.test?.hookTimeout).toBe(30_000);
    expect(config.test?.testTimeout).toBe(60_000);
    expect(config.test?.maxWorkers).toBe(1);
  });
});
