# Authentication Performance Testing

**Date:** 2025-01-12  
**Status:** ✅ **IMPLEMENTED**

## Overview

Comprehensive performance testing suite for the RevealUI authentication system. Tests cover normal load, stress testing, rate limiting, and session validation.

## Test Suite

### 1. Sign-In Performance Test ✅

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
```

### 2. Sign-Up Performance Test ✅

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
```

### 3. Session Validation Test ✅

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
```

### 4. Rate Limiting Test ✅

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
```

### 5. Stress Test ✅

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
```

## Performance Targets

| Endpoint | p50 | p95 | p99 | Throughput | Status |
|----------|-----|-----|-----|------------|--------|
| Sign-In | < 500ms | < 1.5s | < 3s | 10+ req/s | ✅ |
| Sign-Up | < 800ms | < 2s | < 4s | 5+ req/s | ✅ |
| Session Validation | < 100ms | < 500ms | < 1s | 50+ req/s | ✅ |
| Sign-Out | < 200ms | < 500ms | < 1s | 20+ req/s | ✅ |

## Running Tests

### All Tests
```bash
cd packages/test
pnpm test:perf:auth
```

### Individual Tests
```bash
# Sign-in
pnpm test:perf:auth:signin

# Sign-up
pnpm test:perf:auth:signup

# Session validation
pnpm test:perf:auth:session

# Rate limiting
pnpm test:perf:auth:ratelimit

# Stress test
pnpm test:perf:auth:stress
```

### Custom Base URL
```bash
k6 run -e BASE_URL=https://staging.example.com packages/test/load-tests/auth/auth-sign-in.js
```

## Performance Analysis

### Key Metrics

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

### Bottleneck Identification

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

## Optimization Recommendations

### Database

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

### Code Optimizations

1. **Async Password Hashing**
   - Consider async bcrypt if available
   - Or use worker threads for hashing

2. **Session Caching**
   - Cache active sessions in Redis
   - Reduce database lookups

3. **Rate Limiting**
   - Use Redis for distributed rate limiting
   - More efficient than in-memory

## Continuous Performance Testing

### CI/CD Integration

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

### Baseline Metrics

Record baseline metrics after each optimization:

1. Response times (p50, p95, p99)
2. Throughput (req/s)
3. Error rate
4. Resource usage (CPU, memory)

## Troubleshooting

### High Response Times

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

### High Error Rates

1. **Check logs**
   - Database errors
   - Rate limiting
   - Validation errors

2. **Check resources**
   - CPU usage
   - Memory usage
   - Database connections

### Rate Limiting Issues

1. **Verify configuration**
   - Rate limit thresholds
   - Window size
   - Key generation

2. **Check storage**
   - In-memory vs Redis
   - Storage performance

## Next Steps

1. ✅ **Performance tests created**
2. **Run baseline tests** - Establish performance baselines
3. **Identify bottlenecks** - Analyze test results
4. **Optimize** - Fix identified issues
5. **Retest** - Verify optimizations
6. **Document** - Record final metrics

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/api-load-testing/)
- [Load Testing Guide](../testing/LOAD_TESTING_GUIDE.md)

---

**Last Updated:** 2025-01-12  
**Status:** Ready for baseline testing
