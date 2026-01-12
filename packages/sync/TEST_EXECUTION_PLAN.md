# Test Execution Plan

This document outlines how to execute all tests and collect real metrics.

## Prerequisites

### Required Services

1. **CMS Server** (for API tests)
   ```bash
   pnpm --filter cms dev
   # Should be accessible at http://localhost:4000
   ```

2. **ElectricSQL Service** (for sync tests)
   ```bash
   pnpm electric:service:start
   # Should be accessible at http://localhost:5133
   ```

3. **PostgreSQL Database** (for ElectricSQL)
   - Must be accessible via `POSTGRES_URL` or `DATABASE_URL`
   - Must have agent tables created

### Environment Variables

```bash
# For CMS API tests
export REVEALUI_TEST_SERVER_URL=http://localhost:4000
# OR
export REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000

# For ElectricSQL tests
export ELECTRIC_SERVICE_URL=http://localhost:5133
# OR
export NEXT_PUBLIC_ELECTRIC_SERVICE_URL=http://localhost:5133
```

## Test Execution Order

### Phase 1: Tests That Don't Require Services

```bash
# Run compatibility tests (no services needed)
pnpm --filter @revealui/sync test compatibility

# Run unit tests (no services needed)
pnpm --filter @revealui/sync test -- --run client.test.ts sync.test.ts
```

### Phase 2: Tests Requiring CMS Server Only

```bash
# Start CMS server first
pnpm --filter cms dev

# In another terminal, run baseline tests
export REVEALUI_TEST_SERVER_URL=http://localhost:4000
pnpm --filter @revealui/sync test baseline

# Run write performance tests
pnpm --filter @revealui/sync test write-performance

# Run performance regression tests
pnpm --filter @revealui/sync test regression
```

### Phase 3: Tests Requiring ElectricSQL Service

```bash
# Start ElectricSQL service first
pnpm electric:service:start

# Wait for service to be ready (check health endpoint)
curl http://localhost:5133/health

# Run service startup tests
export ELECTRIC_SERVICE_URL=http://localhost:5133
pnpm --filter @revealui/sync test service-startup

# Run resumability tests
pnpm --filter @revealui/sync test resumability
```

### Phase 4: Tests Requiring Both Services

```bash
# Start both services
pnpm --filter cms dev &
pnpm electric:service:start &

# Wait for both to be ready
curl http://localhost:4000/api/conversations
curl http://localhost:5133/health

# Set environment variables
export REVEALUI_TEST_SERVER_URL=http://localhost:4000
export ELECTRIC_SERVICE_URL=http://localhost:5133

# Run E2E tests
pnpm --filter @revealui/sync test e2e

# Run all integration tests
pnpm --filter @revealui/sync test integration
```

## Collecting Metrics

### Baseline Metrics

```bash
# Run baseline tests and capture output
pnpm --filter @revealui/sync test baseline > baseline-results.txt 2>&1

# Extract metrics from output
grep -A 5 "Baseline Performance Metrics" baseline-results.txt
```

### Performance Metrics

```bash
# Run write performance tests
pnpm --filter @revealui/sync test write-performance > performance-results.txt 2>&1

# Extract metrics
grep -A 10 "Write Performance Metrics" performance-results.txt
```

### Comparison

After collecting both baseline and performance metrics:
1. Compare average latencies
2. Calculate improvement percentage
3. Document actual vs. claimed improvements
4. Update PERFORMANCE_BASELINE.md with real data

## Automated Test Script

See `scripts/run-all-tests.sh` for automated test execution.

## Troubleshooting

### Services Not Starting

- Check Docker is running (for ElectricSQL)
- Check PostgreSQL is accessible
- Check ports 4000 and 5133 are available
- Check environment variables are set

### Tests Failing

- Verify services are actually running
- Check service health endpoints
- Review test output for specific errors
- Check database connectivity

### Performance Tests Timing Out

- Increase timeout in test files
- Check network latency
- Verify services are not overloaded
- Run tests during low-traffic periods
