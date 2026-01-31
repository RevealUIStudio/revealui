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

## Detailed Authentication Performance Tests

**Status:** ✅ **IMPLEMENTED**

This section provides comprehensive details about the authentication performance testing suite, including test configurations, targets, and optimization recommendations.

### Test Suite

#### 1. Sign-In Performance Test ✅

**File:** `packages/test/load-tests/auth/auth-sign-in.js`

**Purpose:** Test sign-in endpoint under normal load

**Configuration:**
- Ramp up: 10 users over 30s
- Peak load: 50 concurrent users
- Duration: 4 minutes total

**Targets:**
- ✅ p95 response time < 1.5s
- ✅ Error rate < 1%
- ✅ Throughput: 10+ req/s

**Run:**
```bash
k6 run packages/test/load-tests/auth/auth-sign-in.js
# Or: pnpm test:perf:auth:signin
```

#### 2. Sign-Up Performance Test ✅

**File:** `packages/test/load-tests/auth/auth-sign-up.js`

**Purpose:** Test sign-up endpoint under normal load

**Configuration:**
- Ramp up: 5 users over 30s
- Peak load: 20 concurrent users
- Duration: 4 minutes total

**Targets:**
- ✅ p95 response time < 2s
- ✅ Error rate < 1%
- ✅ Throughput: 5+ req/s

**Run:**
```bash
k6 run packages/test/load-tests/auth/auth-sign-up.js
# Or: pnpm test:perf:auth:signup
```

#### 3. Session Validation Test ✅

**File:** `packages/test/load-tests/auth/auth-session-validation.js`

**Purpose:** Test session validation performance

**Configuration:**
- Ramp up: 20 users over 30s
- Peak load: 100 concurrent users
- Duration: 4 minutes total

**Targets:**
- ✅ p95 response time < 500ms
- ✅ Error rate < 1%
- ✅ Throughput: 50+ req/s

**Run:**
```bash
k6 run packages/test/load-tests/auth/auth-session-validation.js
# Or: pnpm test:perf:auth:session
```

#### 4. Rate Limiting Test ✅

**File:** `packages/test/load-tests/auth/auth-rate-limiting.js`

**Purpose:** Verify rate limiting works correctly

**Configuration:**
- Ramp up: 1 to 10 users
- Duration: 2 minutes total

**Targets:**
- ✅ Rate limiting activates correctly
- ✅ Legitimate users not blocked
- ✅ < 10% rate limit hits

**Run:**
```bash
k6 run packages/test/load-tests/auth/auth-rate-limiting.js
# Or: pnpm test:perf:auth:ratelimit
```

#### 5. Stress Test ✅

**File:** `packages/test/load-tests/auth/auth-stress.js`

**Purpose:** Find breaking point of the system

**Configuration:**
- Normal load: 50 users (5 min)
- 2x load: 100 users (5 min)
- 4x load: 200 users (5 min)
- 6x load: 300 users (5 min)
- Recovery: 10 minutes

**Targets:**
- ✅ System handles up to 300 concurrent users
- ✅ Graceful degradation under load
- ✅ < 10% error rate at peak

**Run:**
```bash
k6 run packages/test/load-tests/auth/auth-stress.js
# Or: pnpm test:perf:auth:stress
```

### Authentication Performance Targets

| Endpoint | p50 | p95 | p99 | Throughput | Status |
|----------|-----|-----|-----|------------|--------|
| Sign-In | < 500ms | < 1.5s | < 3s | 10+ req/s | ✅ |
| Sign-Up | < 800ms | < 2s | < 4s | 5+ req/s | ✅ |
| Session Validation | < 100ms | < 500ms | < 1s | 50+ req/s | ✅ |
| Sign-Out | < 200ms | < 500ms | < 1s | 20+ req/s | ✅ |

### Performance Analysis

#### Key Metrics

1. **Response Time Distribution**
   - p50 (median): Typical user experience
   - p95 (95th percentile): Most users experience
   - p99 (99th percentile): Worst case for most users

2. **Error Rate**
   - Should be < 1% for normal load
   - < 10% acceptable for stress tests

3. **Throughput**
   - Requests per second
   - Indicates system capacity

4. **Rate Limiting**
   - Verifies rate limits work
   - Ensures legitimate users not blocked

#### Bottleneck Identification

Common bottlenecks to check:

1. **Database Queries**
   - Slow queries in sign-in/sign-up
   - Missing indexes
   - Connection pool exhaustion

2. **Password Hashing**
   - bcrypt rounds too high
   - Synchronous hashing blocking event loop

3. **Session Management**
   - Session lookup queries
   - Token hashing overhead

4. **Rate Limiting**
   - In-memory storage performance
   - Rate limit checks overhead

### Optimization Recommendations

#### Database Optimizations

1. **Indexes**
   ```sql
   -- Email lookup (already has unique index)
   CREATE UNIQUE INDEX users_email_unique_idx ON users(email);

   -- Session token hash lookup
   CREATE INDEX sessions_token_hash_idx ON sessions(token_hash);

   -- Session expiration cleanup
   CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
   ```

2. **Connection Pooling**
   - Ensure proper pool size
   - Monitor connection usage

3. **Query Optimization**
   - Use parameterized queries (already done)
   - Limit result sets
   - Avoid N+1 queries

#### Code Optimizations

1. **Async Password Hashing**
   - Consider async bcrypt if available
   - Or use worker threads for hashing

2. **Session Caching**
   - Cache active sessions in Redis
   - Reduce database lookups

3. **Rate Limiting**
   - Use Redis for distributed rate limiting
   - More efficient than in-memory

### Continuous Performance Testing

#### CI/CD Integration

Add to `.github/workflows/performance.yml`:

```yaml
name: Performance Tests

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly
  workflow_dispatch:

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/k6-action@v0.3.1
        with:
          filename: packages/test/load-tests/auth/auth-sign-in.js
```

#### Baseline Metrics

Record baseline metrics after each optimization:

1. Response times (p50, p95, p99)
2. Throughput (req/s)
3. Error rate
4. Resource usage (CPU, memory)

### Troubleshooting Auth Performance

#### High Response Times

1. **Check database**
   - Slow queries
   - Missing indexes
   - Connection pool size

2. **Check password hashing**
   - bcrypt rounds
   - Synchronous operations

3. **Check network**
   - Database location
   - Latency

#### High Error Rates

1. **Check logs**
   - Database errors
   - Rate limiting
   - Validation errors

2. **Check resources**
   - CPU usage
   - Memory usage
   - Database connections

#### Rate Limiting Issues

1. **Verify configuration**
   - Rate limit thresholds
   - Window size
   - Key generation

2. **Check storage**
   - In-memory vs Redis
   - Storage performance

## Related Documentation

- [STAGING_PERFORMANCE_TESTING.md](./STAGING_PERFORMANCE_TESTING.md) - Staging environment performance testing setup
- [PERFORMANCE_BUDGET_TUNING.md](./PERFORMANCE_BUDGET_TUNING.md) - Performance budget configuration

## Next Steps

- [ ] Set up CI/CD performance test runs
- [ ] Integrate with performance monitoring
- [ ] Add more performance test scenarios
- [ ] Document performance targets
- [ ] Create performance dashboard
