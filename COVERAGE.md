# Code Coverage Configuration

## Overview

Code coverage is configured using `@vitest/coverage-v8` and enforced through threshold-based quality gates. This ensures that code quality remains consistent and prevents regressions.

## Coverage Thresholds

### @revealui/db Package

**Current Coverage** (2026-02-01):
- **Statements**: 60.23%
- **Branches**: 58.48%
- **Functions**: 50.43%
- **Lines**: 60%

**Enforced Thresholds**:
- **Statements**: 55% (minimum)
- **Branches**: 55% (minimum)
- **Functions**: 45% (minimum)
- **Lines**: 55% (minimum)

These thresholds are set slightly below current coverage to:
- Prevent coverage regressions
- Allow incremental improvements
- Maintain code quality standards

### Other Packages

Individual packages can define their own thresholds in their `vitest.config.ts` files. Follow the same pattern:
1. Measure baseline coverage
2. Set thresholds 5-10% below baseline
3. Gradually increase over time

## Running Coverage

### Single Package

```bash
cd packages/db
pnpm test:coverage
```

### All Packages

```bash
pnpm test:coverage
```

### View HTML Report

After running coverage:

```bash
# For specific package
open packages/db/coverage/index.html

# Or use a local server
npx serve packages/db/coverage
```

## Coverage Reports

Coverage generates multiple report formats:

1. **Text** - Console output with summary table
2. **HTML** - Interactive web interface (in `coverage/` directory)
3. **LCOV** - For CI/CD integration (codecov, coveralls)
4. **JSON Summary** - Machine-readable summary

## Coverage Exclusions

The following are excluded from coverage calculation:

- Test files (`**/*.test.ts`, `**/*.spec.ts`, `**/__tests__/**`)
- Test fixtures (`**/test-fixtures.ts`)
- Generated files (`src/types/database.ts`)
- Build output (`dist/**`)
- Node modules

## Improving Coverage

### High-Value Targets

Based on current coverage report, focus on:

1. **src/core/agents.ts** (47.36% statements, 10% functions)
   - Many schema definitions without tests
   - Agent table relationships untested

2. **src/types/introspect.ts** (47.61% statements, 33.33% functions)
   - Database introspection logic
   - Error handling paths untested

3. **src/types/generate.ts** (0% coverage)
   - Type generation script
   - Consider if this needs testing (build-time tool)

4. **src/client/index.ts** (54.83% statements, 53.84% functions)
   - Pool management functions
   - Transaction handling
   - Error scenarios

### Coverage Goals

**Short Term** (Next Sprint):
- Increase overall coverage to 65%
- Function coverage to 55%
- Focus on critical paths (client, core schemas)

**Medium Term** (Next Quarter):
- Increase overall coverage to 70%
- Function coverage to 65%
- Add integration tests for database operations

**Long Term** (6 months):
- Target 75-80% overall coverage
- 70% function coverage
- Full coverage of error handling paths

## Integration with CI/CD

### GitHub Actions

Coverage reports are generated on each PR and can be uploaded to code coverage services:

```yaml
- name: Run tests with coverage
  run: pnpm test:coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

### Pull Request Checks

Coverage thresholds are enforced in CI. PRs that reduce coverage below thresholds will fail:

```
ERROR: Coverage for lines (54%) does not meet global threshold (55%)
```

To fix:
1. Add tests for new code
2. Or document why coverage decreased (refactoring, etc.)
3. Get approval to temporarily lower threshold (rare)

## Configuration Files

### Root Workspace (`vitest.config.ts`)

```typescript
export default defineConfig({
  projects: [
    'packages/db/vitest.config.ts',
    // ... other packages
  ],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
    },
  },
})
```

### Package Config (`packages/db/vitest.config.ts`)

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'dist/**',
      ],
      thresholds: {
        branches: 55,
        functions: 45,
        lines: 55,
        statements: 55,
      },
    },
  },
})
```

## Best Practices

### 1. Test Behavior, Not Implementation

✅ **Good**:
```typescript
it('should create client with connection string', () => {
  const client = createClient({ connectionString: 'postgres://...' })
  expect(client.query).toBeDefined()
})
```

❌ **Bad**:
```typescript
it('should call drizzle with connection string', () => {
  createClient({ connectionString: 'postgres://...' })
  expect(drizzle).toHaveBeenCalledWith(expect.anything())
})
```

### 2. Focus on Critical Paths

Priority order:
1. Public API functions (exported functions)
2. Error handling paths
3. Edge cases
4. Internal utilities (lower priority)

### 3. Don't Chase 100% Coverage

**Acceptable Uncovered Code**:
- Type definitions
- Simple getters/setters
- Build-time scripts (like `generate.ts`)
- Defensive checks for impossible states

**Must Cover**:
- Business logic
- Error handling
- API contracts
- Data transformations

### 4. Update Thresholds Gradually

When improving coverage:
1. Measure current baseline
2. Add tests to increase coverage
3. Update thresholds to new level
4. Repeat

**Example**:
```typescript
// Before: 60% coverage, 55% threshold
// Add tests, now at 65% coverage
thresholds: {
  lines: 60,  // Increased from 55
}
```

## Troubleshooting

### "Test timed out" During Coverage

Some tests may be slower under coverage instrumentation. Increase timeout:

```typescript
it('should import module', async () => {
  // ... test code
}, 30000) // 30s timeout
```

### Coverage Not Generating

1. Check `@vitest/coverage-v8` is installed:
   ```bash
   pnpm add -D @vitest/coverage-v8
   ```

2. Verify config has `test:coverage` script:
   ```json
   {
     "scripts": {
       "test:coverage": "vitest run --coverage"
     }
   }
   ```

3. Check vitest config has coverage settings

### Threshold Failures

If coverage drops below threshold:

1. **Check what changed**: `git diff main -- '*.ts'`
2. **Add tests for new code**
3. **Or update thresholds if justified** (rare)

### Coverage Too Slow

Optimize by:
1. Using `--coverage.reportsDirectory` to avoid redundant reports
2. Running coverage only on changed files (in CI)
3. Using `--coverage.all=false` during development

## Resources

- [Vitest Coverage Docs](https://vitest.dev/guide/coverage.html)
- [V8 Coverage Provider](https://vitest.dev/guide/coverage.html#coverage-providers)
- [LCOV Format](https://github.com/linux-test-project/lcov)
- [Testing Best Practices](../docs/development/TESTING.md)

---

**Last Updated**: 2026-02-01
**Baseline Established**: 2026-02-01 (60% overall, 50.43% functions)
**Next Review**: 2026-02-15 (reassess thresholds)
