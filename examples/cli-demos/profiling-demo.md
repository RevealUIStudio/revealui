# Performance Profiling Demo

Identify and fix performance bottlenecks in your build and test pipelines.

## What is Profiling?

Profiling helps you understand where time is spent during script execution:
- **Build profiling**: Identify slow compilation steps
- **Test profiling**: Find slow test suites
- **Script analysis**: Profile any command
- **Comparison**: Compare performance before/after changes
- **Benchmarking**: Track performance over time

## Quick Start

```bash
# Profile build performance
pnpm profile:build

# Profile test execution
pnpm profile:test

# Profile any script
pnpm profile:script "pnpm typecheck:all"

# Compare two commands
pnpm profile:compare "pnpm build" "turbo build"

# Run benchmarks
pnpm profile:benchmark
```

## Demo Walkthrough

### Step 1: Profile Current Build

```bash
pnpm profile:build
```

**Expected Output:**
```
🔍 Profiling Build Performance
================================

Running: turbo run build --parallel

📊 Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Time:        15.2s
Cache Hits:        12/22 packages (54.5%)
Cache Misses:      10/22 packages

Slowest Packages:
  1. apps/cms              8.4s  ████████████████████████ 55.3%
  2. apps/dashboard        3.2s  █████████ 21.1%
  3. @revealui/auth        1.8s  █████ 11.8%
  4. @revealui/db          0.9s  ██ 5.9%
  5. @revealui/core        0.5s  █ 3.3%

Compilation Breakdown:
  TypeScript:            12.1s (79.6%)
  Next.js build:         2.8s (18.4%)
  Post-processing:       0.3s (2.0%)

💡 Recommendations:
  • CMS build is slow (8.4s) - consider code splitting
  • Low cache hit rate (54.5%) - check turbo.json inputs
  • TypeScript taking 79.6% - enable incremental builds
```

### Step 2: Investigate Slow Package

```bash
# Profile just the CMS build
pnpm profile:script "pnpm --filter cms build"
```

**Expected Output:**
```
🔍 Profiling: pnpm --filter cms build
======================================

📊 Detailed Breakdown:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase 1: TypeScript Compilation
  Duration:     5.2s (61.9%)
  Files:        347
  Speed:        66.7 files/sec

Phase 2: Next.js Optimization
  Duration:     2.4s (28.6%)
  Pages:        23
  Components:   156

Phase 3: Asset Generation
  Duration:     0.6s (7.1%)
  Images:       12
  Fonts:        3

Phase 4: Bundle Analysis
  Duration:     0.2s (2.4%)

Top 5 Slowest Files:
  1. src/app/(backend)/admin/[[...segments]]/page.tsx    420ms
  2. src/lib/payload/collections/Posts.ts                 380ms
  3. src/lib/payload/collections/Users.ts                 340ms
  4. src/app/(frontend)/[slug]/page.tsx                   310ms
  5. src/lib/payload/access/admins.ts                     290ms

💡 Suggestions:
  • Large admin page (420ms) - split into smaller components
  • Collection files are slow - reduce complexity
  • Consider lazy loading for admin routes
```

### Step 3: Profile Tests

```bash
pnpm profile:test
```

**Expected Output:**
```
🔍 Profiling Test Execution
============================

Running: vitest run

📊 Test Performance:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Time:        24.3s
Tests:             347 passed
Concurrency:       15 workers

Slowest Test Suites:
  1. packages/db/__tests__/queries.test.ts           8.2s
  2. packages/auth/__tests__/permissions.test.ts     5.1s
  3. apps/cms/__tests__/api.test.ts                  3.8s
  4. packages/core/__tests__/validation.test.ts      2.4s
  5. packages/sync/__tests__/handlers.test.ts        1.9s

Slowest Individual Tests:
  1. "should handle complex JOIN queries"            2.1s
  2. "should validate all permission combinations"   1.8s
  3. "should seed database with full dataset"        1.5s
  4. "should process batch sync operations"          1.2s
  5. "should validate nested schema structures"      0.9s

Setup/Teardown:
  Database setup:    3.2s (13.2%)
  Test execution:    18.5s (76.1%)
  Cleanup:           2.6s (10.7%)

💡 Recommendations:
  • DB queries test is slow (8.2s) - mock database instead?
  • High setup overhead (13.2%) - consider globalSetup
  • Batch operations test (1.2s) - reduce test data size
  • Use in-memory DB for faster tests
```

### Step 4: Compare Approaches

```bash
# Compare TypeScript vs SWC compilation
pnpm profile:compare "tsc" "swc src -d dist"
```

**Expected Output:**
```
🔍 Comparing Performance
========================

Command A: tsc
Command B: swc src -d dist

Running each command 3 times...

📊 Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Command A (tsc):
  Run 1:     5.2s
  Run 2:     5.1s
  Run 3:     5.3s
  Average:   5.2s
  Std Dev:   0.08s

Command B (swc src -d dist):
  Run 1:     0.8s
  Run 2:     0.7s
  Run 3:     0.8s
  Average:   0.77s
  Std Dev:   0.05s

🎯 Winner: Command B (swc)
   ⚡ 6.75x faster (4.43s saved)
   📉 85.2% reduction in build time

Recommendation: Consider switching to SWC for development builds
```

### Step 5: Run Benchmarks

```bash
pnpm profile:benchmark
```

**Expected Output:**
```
🏃 Running Performance Benchmarks
==================================

Benchmark Suite: Build Performance

Test 1: Clean Build (no cache)
  Running... ████████████████████ 100%
  Result: 45.2s

Test 2: Incremental Build (no changes)
  Running... ████████████████████ 100%
  Result: 2.1s (95.4% faster)

Test 3: Incremental Build (1 file changed)
  Running... ████████████████████ 100%
  Result: 3.8s (91.6% faster)

Test 4: Parallel Build
  Running... ████████████████████ 100%
  Result: 15.2s (66.4% faster)

Test 5: Sequential Build
  Running... ████████████████████ 100%
  Result: 38.7s (14.4% faster than clean)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Benchmark Suite: Test Performance

Test 1: All Tests
  Running... ████████████████████ 100%
  Result: 24.3s

Test 2: Unit Tests Only
  Running... ████████████████████ 100%
  Result: 8.7s (64.2% faster)

Test 3: Integration Tests Only
  Running... ████████████████████ 100%
  Result: 15.6s (35.8% faster)

Test 4: With Coverage
  Running... ████████████████████ 100%
  Result: 38.9s (60.1% slower)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 Historical Comparison:

                  Current    Last Week   Change
Clean Build       45.2s      52.1s       ↓ 13.2%
Incremental       3.8s       4.2s        ↓ 9.5%
All Tests         24.3s      26.8s       ↓ 9.3%

Trend: ✅ Performance improving
```

## Advanced Usage

### Profile Specific Scenarios

```bash
# Profile cold start (clear cache first)
pnpm profile:build --cold

# Profile with cache
pnpm profile:build --cache

# Profile with verbose output
pnpm profile:build --verbose

# Save results to file
pnpm profile:build --output build-profile.json
```

### Custom Script Profiling

```bash
# Profile any command
pnpm profile:script "pnpm lint"

# With iterations
pnpm profile:script "pnpm test" --iterations 5

# With warm-up
pnpm profile:script "pnpm build" --warmup 2 --iterations 3
```

### Continuous Profiling

```bash
# Profile in watch mode
pnpm profile:watch build

# Runs profile every time files change
# Great for identifying regressions during development
```

### Generate Reports

```bash
# Generate HTML report
pnpm profile:report --format html --output profile-report.html

# Generate JSON for CI
pnpm profile:build --json > build-metrics.json

# Generate comparison report
pnpm profile:compare "old" "new" --report comparison.html
```

## Real-World Optimization Workflows

### Scenario 1: Slow Build Times

**Problem**: Developers complaining about slow builds (45s)

**Workflow:**
```bash
# Step 1: Baseline measurement
pnpm profile:build --output baseline.json

# Step 2: Identify bottleneck
# Output shows: CMS taking 8.4s (55% of time)

# Step 3: Profile the slow package
pnpm profile:script "pnpm --filter cms build" --verbose

# Step 4: Analysis shows large admin page
# Recommendation: Code split admin routes

# Step 5: Make changes, then compare
pnpm profile:compare \
  "pnpm --filter cms build" \
  "pnpm --filter cms build" \
  --baseline baseline.json

# Result: Build reduced from 45s → 28s (38% improvement)
```

### Scenario 2: Slow Test Suite

**Problem**: CI taking too long (tests running 5+ minutes)

**Workflow:**
```bash
# Step 1: Profile tests
pnpm profile:test --verbose

# Analysis shows:
# - Database setup: 3.2s per suite
# - Complex JOIN test: 2.1s
# - 15 workers (good concurrency)

# Step 2: Optimize database tests
# Switch to in-memory SQLite for tests

# Step 3: Re-profile
pnpm profile:test

# Result:
# - Database setup: 0.3s (10x faster)
# - Total time: 8.7s (down from 24.3s)
# - 64% improvement
```

### Scenario 3: Comparing Bundlers

**Problem**: Evaluating switch from Webpack to Vite

**Workflow:**
```bash
# Compare dev server startup
pnpm profile:compare \
  "webpack serve" \
  "vite dev"

# Output:
# webpack: 8.2s average
# vite: 1.1s average
# Winner: vite (7.5x faster)

# Compare production builds
pnpm profile:compare \
  "webpack build" \
  "vite build"

# Output:
# webpack: 45.2s average
# vite: 38.7s average
# Winner: vite (14% faster)

# Decision: Switch to Vite
```

### Scenario 4: Regression Detection

**Problem**: Last PR slowed down builds but not sure why

**Workflow:**
```bash
# On main branch
git checkout main
pnpm profile:build --output main-profile.json

# On PR branch
git checkout feature-branch
pnpm profile:build --output pr-profile.json

# Compare
pnpm profile:diff main-profile.json pr-profile.json

# Output:
# 🔴 Regression detected:
#   @revealui/core: 0.5s → 2.1s (+320%)
#   Cause: New heavy dependency in core package
```

## Performance Targets

### Build Performance
- **Cold build**: < 60s (target: 45s)
- **Incremental build**: < 5s (target: 3s)
- **Cache hit rate**: > 80% (current: 54%)
- **Parallel speedup**: > 3x vs sequential

### Test Performance
- **All tests**: < 30s (target: 20s)
- **Unit tests only**: < 10s (target: 8s)
- **Single test file**: < 1s
- **Setup overhead**: < 10% of total time

### Development
- **Dev server start**: < 2s
- **Hot reload**: < 500ms
- **Type checking**: < 5s

## Interpreting Results

### Time Distribution

**Healthy build:**
```
Compilation:  60-70%
Optimization: 20-30%
Setup/IO:     5-10%
```

**Problem build:**
```
Compilation:  90%+   ⚠️ Too much time in TS compilation
Setup/IO:     20%+   ⚠️ Disk/network bottleneck
```

### Cache Effectiveness

- **> 80%**: Excellent - good incremental builds
- **60-80%**: Good - room for improvement
- **< 60%**: Poor - check turbo.json inputs/outputs

### Parallelization

Calculate speedup: `Sequential Time / Parallel Time`

- **> 4x**: Excellent parallelization
- **2-4x**: Good parallelization
- **< 2x**: Poor parallelization (check dependencies)

## Tips & Tricks

### Reduce Profiling Overhead

```bash
# Quick profile (1 iteration, no warm-up)
pnpm profile:build --quick

# Full profile (5 iterations, 2 warm-ups)
pnpm profile:build --full
```

### Track Over Time

```bash
# Save daily snapshots
pnpm profile:build --output "profiles/$(date +%Y-%m-%d).json"

# Compare with last week
pnpm profile:diff \
  profiles/$(date -d "7 days ago" +%Y-%m-%d).json \
  profiles/$(date +%Y-%m-%d).json
```

### Integration with CI

```yaml
# .github/workflows/performance.yml
- name: Profile Build
  run: |
    pnpm profile:build --json > build-metrics.json

- name: Check for Regression
  run: |
    pnpm profile:check build-metrics.json \
      --baseline main-baseline.json \
      --threshold 10%  # Fail if >10% slower
```

## Next Steps

- [Dashboard Demo](./dashboard-demo.md) - Real-time performance monitoring
- [Script Management](./script-management-demo.md) - Optimize package scripts
- [Explorer Demo](./explorer-demo.md) - Discover optimization commands

---

**See also**: [Performance Profiling Reference](../../SCRIPTS.md#performance-profiling-)
