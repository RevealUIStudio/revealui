# Performance Testing Guide

This document describes how to run and interpret performance tests for RevealUI.

## Overview

Performance tests are designed to:
- Establish baseline performance metrics
- Detect performance regressions
- Find system breaking points (stress tests)
- Monitor performance over time

## Test Types

### 1. Load Tests (k6)

Located in `packages/test/load-tests/`:
- `auth-load.js` - Authentication system load test
- `cms-load.js` - CMS operations load test
- `ai-load.js` - AI/agent operations load test

### 2. Stress Tests (k6)

Located in `packages/test/load-tests/auth/`:
- `auth-stress.js` - Find authentication system breaking point
- `auth-sign-up.js` - Sign-up endpoint performance
- `auth-sign-in.js` - Sign-in endpoint performance
- `auth-session-validation.js` - Session validation performance
- `auth-rate-limiting.js` - Rate limiting performance

### 3. Performance Analysis Scripts

Located in `scripts/performance/`:
- `analyze-auth-performance.ts` - Analyze auth performance metrics

### 4. Baseline & Regression Scripts

Located in `scripts/test/`:
- `performance-baseline.ts` - Record baseline performance metrics
- `performance-regression.ts` - Compare current vs baseline metrics

## Prerequisites

### Install k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Or download from https://k6.io/docs/get-started/installation/
```

### Environment Setup

Ensure your test environment is configured:
```bash
# Set base URL for tests
export BASE_URL=http://localhost:3000

# Or use environment-specific URL
export BASE_URL=https://staging.example.com
```

## Running Tests

### Individual Load Tests

```bash
# Run auth load test
k6 run packages/test/load-tests/auth-load.js

# Run CMS load test
k6 run packages/test/load-tests/cms-load.js

# Run AI load test
k6 run packages/test/load-tests/ai-load.js
```

### Stress Tests

```bash
# Run auth stress test
k6 run packages/test/load-tests/auth/auth-stress.js

# Run specific auth operation tests
k6 run packages/test/load-tests/auth/auth-sign-up.js
k6 run packages/test/load-tests/auth/auth-sign-in.js
k6 run packages/test/load-tests/auth/auth-session-validation.js
k6 run packages/test/load-tests/auth/auth-rate-limiting.js
```

### Establish Baseline

```bash
# Run baseline performance tests
pnpm test:performance:baseline

# Or directly
tsx scripts/test/performance-baseline.ts
```

This will:
1. Run all performance tests
2. Collect metrics
3. Save baseline to `packages/test/load-tests/baseline.json`

### Check for Regressions

```bash
# Compare current performance to baseline
pnpm test:performance:regression

# Or directly
tsx scripts/test/performance-regression.ts
```

This will:
1. Run all performance tests
2. Compare metrics to baseline
3. Report any regressions
4. Exit with error code if regressions detected

### Analyze Auth Performance

```bash
# Analyze auth performance metrics
tsx scripts/performance/analyze-auth-performance.ts
```

## Understanding Results

### Key Metrics

- **http_req_duration**: Request duration (p50, p95, p99, avg, min, max)
- **http_req_failed**: Request failure rate
- **http_reqs**: Total requests per second
- **errors**: Custom error rate metric
- **vus**: Virtual users (concurrent users)

### Thresholds

Tests define performance thresholds:
- `http_req_duration: ['p(95)<2000']` - 95% of requests under 2s
- `http_req_failed: ['rate<0.01']` - Less than 1% failures

### Interpreting Results

**Good Performance:**
- All thresholds passed
- Low p95/p99 latencies
- Minimal errors

**Performance Issues:**
- Thresholds failed
- High p95/p99 latencies (>2s)
- High error rate (>1%)
- Requests per second dropping

**Stress Test Results:**
- Breaking point identified
- Maximum concurrent users
- Degradation patterns observed

## CI/CD Integration

### GitHub Actions

Performance tests can be run in CI/CD:

```yaml
# Example workflow
- name: Run Performance Tests
  run: |
    pnpm test:performance:baseline
    pnpm test:performance:regression
```

### Performance Monitoring

Consider integrating with:
- **Grafana + Prometheus** for metrics visualization
- **k6 Cloud** for distributed load testing
- **Datadog APM** for performance monitoring

## Troubleshooting

### Tests Fail to Connect

**Problem**: Tests can't connect to BASE_URL

**Solution**:
```bash
# Ensure dev server is running
pnpm dev

# Or update BASE_URL to correct endpoint
export BASE_URL=http://localhost:3000
```

### High Latency

**Problem**: Tests show high latency

**Possible Causes**:
- Database connection issues
- Rate limiting too aggressive
- Missing indexes
- Resource constraints

**Solutions**:
- Check database performance
- Review rate limiting configuration
- Add database indexes
- Scale resources

### Test Failures

**Problem**: Tests failing with errors

**Possible Causes**:
- API endpoint changes
- Authentication changes
- Rate limiting blocking requests
- Database issues

**Solutions**:
- Update test endpoints
- Review authentication flow
- Adjust rate limits for tests
- Check database connection

## Best Practices

1. **Run baseline after significant changes**
2. **Monitor for regressions regularly**
3. **Run stress tests before releases**
4. **Document performance characteristics**
5. **Set realistic thresholds**
6. **Test in production-like environments**

## Next Steps

- [ ] Set up CI/CD performance test runs
- [ ] Integrate with performance monitoring
- [ ] Add more performance test scenarios
- [ ] Document performance targets
- [ ] Create performance dashboard
