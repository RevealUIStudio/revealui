/**
 * Shared Vitest config factory for RevealUI monorepo packages.
 *
 * Fleet-redundancy C5 / P2-F: one factory for the common node-package shape
 * (globals, forks pool, coverage reporters). Per-package thresholds and
 * includes stay parameterized so coverage gates do not silently drop.
 *
 * @example
 * ```ts
 * import { createVitestConfig } from '@revealui/dev/vitest'
 *
 * export default createVitestConfig({
 *   thresholds: { lines: 60, functions: 60, branches: 55, statements: 60 },
 * })
 * ```
 */
import { defineConfig, mergeConfig, type ViteUserConfig } from 'vitest/config';

/** Coverage thresholds — all four keys required when set (matches gate habit). */
export interface VitestCoverageThresholds {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}

export interface CreateVitestConfigOptions {
  /** Vitest environment. Default: `'node'`. */
  environment?: 'node' | 'jsdom' | 'happy-dom' | 'edge-runtime';
  /** maxWorkers for the forks pool. Default: `2`. */
  maxWorkers?: number;
  /** hookTimeout ms. Default: Vitest default (omit). */
  hookTimeout?: number;
  /** testTimeout ms. Default: Vitest default (omit). */
  testTimeout?: number;
  /** Test include globs. Default: src unit/spec files. */
  include?: string[];
  /** Test exclude globs. Default: node_modules and dist. */
  exclude?: string[];
  /** When false, omit coverage block. Default: true. */
  coverage?: boolean;
  /**
   * Coverage include globs. Default: src TypeScript files. Pass `false` to
   * omit the `include` key entirely — the v8 provider then measures ONLY
   * files the test run actually loads, instead of reporting every
   * include-matched file (unloaded files count 0% and enter the
   * denominator). Use for test-utilities packages whose helper trees are
   * exercised by OTHER packages' suites or by integration/e2e runs excluded
   * from the unit-coverage job.
   */
  coverageInclude?: string[] | false;
  /** Coverage exclude globs. Default: tests and __tests__ trees. */
  coverageExclude?: string[];
  /**
   * Coverage thresholds. When omitted, no thresholds key is written
   * (packages opt in explicitly so gates stay intentional).
   */
  thresholds?: VitestCoverageThresholds;
  /**
   * Coverage reporters. Default:
   * `['text', 'json', 'html', 'lcov']`
   */
  coverageReporters?: string[];
  /**
   * Deep-merged onto the factory result via `mergeConfig`. Use for resolve
   * aliases, `define`, `env`, multi-project setups, etc.
   */
  overrides?: ViteUserConfig;
}

const DEFAULT_INCLUDE = [
  'src/**/*.test.ts',
  'src/**/*.test.tsx',
  'src/**/*.spec.ts',
  'src/**/*.spec.tsx',
] as const;
const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/dist/**'] as const;
const DEFAULT_COVERAGE_INCLUDE = ['src/**/*.ts'] as const;
const DEFAULT_COVERAGE_EXCLUDE = [
  'src/**/*.test.ts',
  'src/**/*.spec.ts',
  'src/**/__tests__/**',
] as const;
const DEFAULT_COVERAGE_REPORTERS = ['text', 'json', 'html', 'lcov'] as const;

/**
 * Build a Vitest `UserConfig` for a monorepo package.
 *
 * Returns the result of `defineConfig` so configs can `export default` it.
 */
export function createVitestConfig(options: CreateVitestConfigOptions = {}): ViteUserConfig {
  const {
    environment = 'node',
    maxWorkers = 2,
    hookTimeout,
    testTimeout,
    include = [...DEFAULT_INCLUDE],
    exclude = [...DEFAULT_EXCLUDE],
    coverage = true,
    coverageInclude = [...DEFAULT_COVERAGE_INCLUDE],
    coverageExclude = [...DEFAULT_COVERAGE_EXCLUDE],
    thresholds,
    coverageReporters = [...DEFAULT_COVERAGE_REPORTERS],
    overrides,
  } = options;

  const base: ViteUserConfig = {
    test: {
      globals: true,
      environment,
      pool: 'forks',
      maxWorkers,
      include,
      exclude,
      ...(hookTimeout !== undefined ? { hookTimeout } : {}),
      ...(testTimeout !== undefined ? { testTimeout } : {}),
      ...(coverage
        ? {
            coverage: {
              provider: 'v8' as const,
              reporter: coverageReporters,
              ...(coverageInclude !== false ? { include: coverageInclude } : {}),
              exclude: coverageExclude,
              ...(thresholds ? { thresholds } : {}),
            },
          }
        : {}),
    },
  };

  if (!overrides) {
    return defineConfig(base);
  }

  return defineConfig(mergeConfig(base, overrides));
}
