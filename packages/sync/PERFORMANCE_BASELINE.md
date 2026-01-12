# Performance Baseline Metrics

This document tracks baseline performance metrics for agent memory operations before upgrading to ElectricSQL 1.1+. These metrics will be used to compare performance improvements after the upgrade.

## Test Environment

- **Date**: Generated automatically during test runs
- **ElectricSQL Version**: Current (pre-1.1)
- **Test Server**: `REVEALUI_TEST_SERVER_URL` or `http://localhost:4000`
- **Test Framework**: Vitest

## Metrics Collected

### Write Latency

- **addMemory**: Time to create a new agent memory via CMS API
- **updateMemory**: Time to update an existing agent memory via CMS API

### Sync Latency

- **Write to Shape Update**: Time from API write to when data is available via ElectricSQL shapes
- **Note**: Baseline may only measure write latency as proxy until ElectricSQL service is fully integrated

### Memory Usage

- **Before**: Heap memory usage before operations
- **After**: Heap memory usage after operations
- **Peak**: Peak heap memory usage during operations

### Network Requests

- **Shape Requests**: Number of ElectricSQL shape requests
- **API Requests**: Number of CMS API requests

## Running Baseline Tests

```bash
# Ensure test server is running
pnpm --filter cms dev

# Run baseline performance tests
pnpm --filter @revealui/sync test baseline

# Or run with coverage
pnpm --filter @revealui/sync test:coverage baseline
```

## Expected Results

After running the baseline tests, metrics will be logged to the console. These metrics will be used to:

1. Compare against ElectricSQL 1.1+ performance
2. Verify 100x write improvement claim
3. Identify performance regressions
4. Document actual performance gains

## Notes

- Tests are skipped if `REVEALUI_TEST_SERVER_URL` is not set
- Tests have extended timeout (60 seconds) for performance measurements
- Memory usage measurements only work in Node.js environment
- Network request counting is approximate and may vary

## Next Steps

After upgrading to ElectricSQL 1.1+:

1. Run the same performance tests
2. Compare metrics against this baseline
3. Document improvements in `PERFORMANCE_IMPROVEMENTS.md`
4. Update this document with post-upgrade metrics
