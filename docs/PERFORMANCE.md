---
visibility: internal
status: verified
title: "Performance Testing"
description: "Load testing, benchmarks, optimization targets, and monitoring"
category: operations
audience: maintainer
---

# Performance Testing and Optimization

This comprehensive guide covers performance testing strategy, budgets, testing procedures, monitoring, and optimization for RevealUI.

## Table of Contents

1. [Overview](#overview)
2. [Performance Testing Strategy](#performance-testing-strategy)
3. [Test Types and Tools](#test-types-and-tools)
4. [Prerequisites and Setup](#prerequisites-and-setup)
5. [Running Tests](#running-tests)
6. [Performance Budgets](#performance-budgets)
7. [Staging Environment Testing](#staging-environment-testing)
8. [Metrics and Analysis](#metrics-and-analysis)
9. [Authentication Performance Tests](#authentication-performance-tests)
10. [Optimization Recommendations](#optimization-recommendations)
11. [CI/CD Integration](#cicd-integration)
12. [Troubleshooting](#troubleshooting)
13. [Best Practices](#best-practices)

## Overview

Performance testing is designed to:
- Establish baseline performance metrics
- Detect performance regressions before they reach production
- Find system breaking points through stress tests
- Monitor performance over time
- Ensure acceptable user experience under load

### Performance Testing Environments

- **Local Development**: Quick feedback during development
- **Staging**: Pre-production validation with real-world infrastructure
- **Production Monitoring**: Continuous performance tracking

## Performance Testing Strategy

### Goals

1. **Prevent Regressions**: Catch performance degradation early
2. **Establish Baselines**: Define acceptable performance characteristics
3. **Identify Bottlenecks**: Find and fix performance issues
4. **Validate Optimizations**: Measure impact of improvements
5. **Ensure Reliability**: Test system behavior under load

### Testing Approach

1. **Load Tests**: Normal expected traffic patterns
2. **Stress Tests**: Find breaking points and limits
3. **Baseline Recording**: Establish performance characteristics
4. **Regression Detection**: Compare current vs baseline metrics
5. **Budget Enforcement**: Fail builds on budget violations

## Test Types and Tools

### 1. Load Tests (k6)

Located in `packages/test/load-tests/load/`:
- `auth/auth-load.js` - Authentication system load test
- `auth/auth-login.js` - Login flow load test
- `ai/ai-load.js` - AI/agent operations load test
- `api/api-pages.js` - Page-rendering API load test
- `payments/payment-processing.js` - Payment processing load test

There is no `admin-load.js` anywhere in the repo; admin has no dedicated load test yet.

### 2. Stress Tests (k6)

Located in `packages/test/load-tests/load/auth/`:
- `auth-stress.js` - Find authentication system breaking point
- `auth-sign-up.js` - Sign-up endpoint performance
- `auth-sign-in.js` - Sign-in endpoint performance
- `auth-session-validation.js` - Session validation performance
- `auth-rate-limiting.js` - Rate limiting performance

### 3. Performance Analysis Scripts

There is no `scripts/performance/` directory in this repo; `analyze-auth-performance.ts` was never built.

### 4. Baseline and Regression Scripts

There is no `scripts/test/` directory in this repo; `performance-baseline.ts` and `performance-regression.ts` were never built. The real performance entry points are the `test:perf:*` scripts in `packages/test/package.json` (see "Establish Baseline" below) and `pnpm --filter @revealui/cache test` for the one benchmark that does exist (PGlite vs in-memory cache).

## Prerequisites and Setup

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

### Environment Configuration

#### Local Development

```bash
# Set base URL for tests
export BASE_URL=http://localhost:3000
```

#### Staging Environment

Create `.env.staging` with your staging environment variables:

```bash
# Staging URLs
STAGING_URL=https://staging.your-domain.com
STAGING_API_URL=https://staging-api.your-domain.com

# Database
STAGING_DATABASE_URL=postgresql://user:password@staging-db-host:5432/staging_db

# Add other staging-specific variables...
```

#### GitHub Secrets for CI/CD

Add these secrets to your GitHub repository:
- `STAGING_URL`: Your staging application URL
- `STAGING_API_URL`: Your staging API URL
- `STAGING_DATABASE_URL`: Staging database connection string

## Running Tests

### Individual Load Tests

```bash
# Run auth load test
k6 run packages/test/load-tests/load/auth/auth-load.js

# Run AI load test
k6 run packages/test/load-tests/load/ai/ai-load.js

# Run payments load test
k6 run packages/test/load-tests/load/payments/payment-processing.js
```

There is no admin load test yet, so no `k6 run` command exists for one.

### Stress Tests

```bash
# Run auth stress test
k6 run packages/test/load-tests/load/auth/auth-stress.js

# Run specific auth operation tests
k6 run packages/test/load-tests/load/auth/auth-sign-up.js
k6 run packages/test/load-tests/load/auth/auth-sign-in.js
k6 run packages/test/load-tests/load/auth/auth-session-validation.js
k6 run packages/test/load-tests/load/auth/auth-rate-limiting.js
```

### Establish Baseline

There is no `pnpm test:performance:baseline` command and no `scripts/test/performance-baseline.ts` file in this repo; that automated baseline pipeline was never built. What exists are the `test:perf:*` scripts in `packages/test/package.json` (`test:perf:auth`, `test:perf:auth:signin`, `test:perf:auth:signup`, `test:perf:auth:session`, `test:perf:auth:ratelimit`, `test:perf:auth:stress`), each wrapping a k6 run, e.g. `pnpm --filter @revealui/test test:perf:auth`. Equivalent direct invocations:

```bash
k6 run packages/test/load-tests/load/auth/auth-sign-in.js
k6 run packages/test/load-tests/load/auth/auth-sign-up.js
k6 run packages/test/load-tests/load/auth/auth-session-validation.js
k6 run packages/test/load-tests/load/auth/auth-rate-limiting.js
k6 run packages/test/load-tests/load/auth/auth-stress.js
```

Record results by hand until a baseline pipeline exists.

### Check for Regressions

There is no `pnpm test:performance:regression` command and no `scripts/test/performance-regression.ts` file in this repo. Compare k6 output across runs manually until an automated regression checker is built.

### Analyze Performance

There is no analysis script in this repo (`scripts/performance/analyze-auth-performance.ts` was never built, and the former `test:perf:analyze` alias pointed at a nonexistent file and has been removed). Read the k6 summary output from each run directly.

## Performance Budgets

### Overview

Performance budgets define acceptable thresholds for response times and error rates. Incorrect budgets lead to:
- **False positives**: Too strict budgets cause unnecessary build failures
- **False negatives**: Too loose budgets allow performance regressions to slip through

### Establishing Performance Budgets

#### Step 1: Collect Baseline Data

There is no `pnpm test:performance` command in this repo, and the automated budget-collection pipeline described in this section (`scripts/test/performance-baseline.ts`, `scripts/test/performance-regression.ts`) was never built. Run the underlying k6 scripts directly and record results by hand until that pipeline exists:

```bash
# Run a k6 load test 5-10 times to build statistical confidence
for i in {1..5}; do
  echo "Run $i/5"
  k6 run packages/test/load-tests/load/auth/auth-sign-in.js
  sleep 30  # Wait between runs
done
```

#### Step 2: Analyze Baseline Data

There is no analysis script in this repo yet. Read the k6 summary output from each run directly, since there is no tool that aggregates P95 and error-rate recommendations for you today.

#### Step 3: Update Budgets

There is no `scripts/test/performance-regression.ts` file in this repo to hold budgets. Track budget numbers wherever you record baseline results (a comment, a spreadsheet, a tracking issue) until a regression-checking script exists.

#### Step 4: Test Budgets

There is no `pnpm test:performance` command or `scripts/test/performance-regression.ts` script in this repo yet. Verify budgets manually by re-running the relevant k6 scripts and comparing against whatever budget numbers you tracked in Step 3:

```bash
k6 run packages/test/load-tests/load/auth/auth-sign-in.js
```

### Budget Calculation Logic

#### P95 Response Time Budget
- **Formula**: 95th percentile of observed P95 values × 1.25 (25% buffer)
- **Rationale**: Uses statistical outlier detection, adds buffer for natural variance
- **Example**: If 95th percentile of P95s is 1350ms → budget = 1688ms

#### Error Rate Budget
- **Formula**: Max observed error rate × 1.1, minimum 1%
- **Rationale**: Catches any increase in errors, with small buffer
- **Example**: If max error rate is 0.5% → budget = 0.55%

### Environment-Specific Budgets

#### Production Budgets
- **Strict**: Designed to catch real performance regressions
- **Buffer**: 25% above typical performance
- **Goal**: Prevent user-facing performance issues

#### Staging Budgets
- **Lenient**: 25-50% higher P95 than production
- **Error tolerance**: 2-3x production rates
- **Goal**: Allow testing in different infrastructure while still catching major issues
- **Rationale**: Account for different infrastructure, additional logging overhead, and network latency differences

### Budget Monitoring and Updates

#### Regular Review

Update budgets quarterly or when:
- Infrastructure changes (new servers, databases, networks)
- Major code changes affecting performance
- New endpoints are added
- Performance characteristics change significantly

#### Automated Updates

Automated budget updates are aspirational, not implemented. `scripts/test/analyze-performance-baseline.ts` does not exist in this repo, so there is nothing to cron yet. Once an analysis script exists, a monthly cron job is a reasonable way to keep budgets current.

## Staging Environment Testing

### How It Works

1. **Staging Deployment**: Code is automatically deployed to staging environment
2. **Performance Tests**: Load tests are run against the staging environment
3. **Budget Comparison**: Results are compared against production performance budgets
4. **Gate Check**: Production deployment is blocked if staging performance fails

### Workflow

```
main branch push
    ↓
Staging Deploy Job
    ↓
Staging Performance Tests
    ↓
Compare vs Production Budgets
    ↓
Production Deploy Gate (manual approval)
    ↓
Production Deployment
```

### Deployment Configuration

There is no `.github/workflows/staging-performance.yml` file in this repo; the staging-gate pipeline described in this section is aspirational. The sketch below shows what a deployment step could look like once that workflow is built.

```yaml
- name: Deploy to staging
  run: |
    # Add your staging deployment commands here
    # Examples for different platforms:

    # Vercel
    npx vercel --prod=false

    # Fly.io (Railway was the retired origin — dropped per ADR 2026-05-18)
    flyctl deploy

    # Render
    # Configure webhook deployment

    # Docker
    docker build -t myapp:staging .
    docker push registry.example.com/myapp:staging
```

### Running Staging Tests Locally

There is no `pnpm test:performance` command or `scripts/test/performance-regression.ts` script in this repo yet. Point the k6 scripts at staging directly:

```bash
# Run a k6 script against staging
BASE_URL=https://staging.your-domain.com k6 run packages/test/load-tests/load/auth/auth-sign-in.js
```

### Staging Benefits

- **Early Detection**: Catch performance issues before production
- **Real Environment**: Test against infrastructure similar to production
- **Deployment Safety**: Prevent bad deployments from reaching users
- **Confidence**: Know that production deployments maintain performance

## Metrics and Analysis

### Key Metrics

- **http_req_duration**: Request duration (p50, p95, p99, avg, min, max)
- **http_req_failed**: Request failure rate
- **http_reqs**: Total requests per second
- **errors**: Custom error rate metric
- **vus**: Virtual users (concurrent users)

#### Response Time Distribution

1. **p50 (median)**: Typical user experience
2. **p95 (95th percentile)**: Most users experience
3. **p99 (99th percentile)**: Worst case for most users

#### Error Rate

- Should be < 1% for normal load
- < 10% acceptable for stress tests

#### Throughput

- Requests per second
- Indicates system capacity

### Thresholds

Tests define performance thresholds:
- `http_req_duration: ['p(95)<2000']` - 95% of requests under 2s
- `http_req_failed: ['rate<0.01']` - Less than 1% failures

### Interpreting Results

#### Good Performance
- All thresholds passed
- Low p95/p99 latencies
- Minimal errors

#### Performance Issues
- Thresholds failed
- High p95/p99 latencies (>2s)
- High error rate (>1%)
- Requests per second dropping

#### Stress Test Results
- Breaking point identified
- Maximum concurrent users
- Degradation patterns observed

## Authentication Performance Tests

**Status:** ✅ **IMPLEMENTED**

This section provides comprehensive details about the authentication performance testing suite.

Each test below has an equivalent `pnpm --filter @revealui/test test:perf:auth:*` shortcut, but those shortcuts currently point at a stale path (`load-tests/auth/...` instead of `load-tests/load/auth/...`) and fail with a file-not-found error until `packages/test/package.json` is fixed. Use the direct `k6 run` command shown for each test.

### Test Suite

#### 1. Sign-In Performance Test ✅

**File:** `packages/test/load-tests/load/auth/auth-sign-in.js`

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
k6 run packages/test/load-tests/load/auth/auth-sign-in.js
```

#### 2. Sign-Up Performance Test ✅

**File:** `packages/test/load-tests/load/auth/auth-sign-up.js`

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
k6 run packages/test/load-tests/load/auth/auth-sign-up.js
```

#### 3. Session Validation Test ✅

**File:** `packages/test/load-tests/load/auth/auth-session-validation.js`

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
k6 run packages/test/load-tests/load/auth/auth-session-validation.js
```

#### 4. Rate Limiting Test ✅

**File:** `packages/test/load-tests/load/auth/auth-rate-limiting.js`

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
k6 run packages/test/load-tests/load/auth/auth-rate-limiting.js
```

#### 5. Stress Test ✅

**File:** `packages/test/load-tests/load/auth/auth-stress.js`

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
k6 run packages/test/load-tests/load/auth/auth-stress.js
```

### Authentication Performance Targets

| Endpoint | p50 | p95 | p99 | Throughput | Status |
|----------|-----|-----|-----|------------|--------|
| Sign-In | < 500ms | < 1.5s | < 3s | 10+ req/s | ✅ |
| Sign-Up | < 800ms | < 2s | < 4s | 5+ req/s | ✅ |
| Session Validation | < 100ms | < 500ms | < 1s | 50+ req/s | ✅ |
| Sign-Out | < 200ms | < 500ms | < 1s | 20+ req/s | ✅ |

### Bottleneck Identification

Common bottlenecks to check:

#### 1. Database Queries
- Slow queries in sign-in/sign-up
- Missing indexes
- Connection pool exhaustion

#### 2. Password Hashing
- bcrypt rounds too high
- Synchronous hashing blocking event loop

#### 3. Session Management
- Session lookup queries
- Token hashing overhead

#### 4. Rate Limiting
- In-memory storage performance
- Rate limit checks overhead

## Optimization Recommendations

### Database Optimizations

#### 1. Indexes

```sql
-- Email lookup (already has unique index)
CREATE UNIQUE INDEX users_email_unique_idx ON users(email);

-- Session token hash lookup
CREATE INDEX sessions_token_hash_idx ON sessions(token_hash);

-- Session expiration cleanup
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
```

#### 2. Connection Pooling
- Ensure proper pool size
- Monitor connection usage

#### 3. Query Optimization
- Use parameterized queries (already done)
- Limit result sets
- Avoid N+1 queries

### Code Optimizations

#### 1. Async Password Hashing
- Consider async bcrypt if available
- Or use worker threads for hashing

#### 2. Session Caching
- Cache active sessions in-memory (Map-based)
- Reduce database lookups

#### 3. Rate Limiting
- Use database backend for distributed rate limiting
- PostgreSQL `FOR UPDATE SKIP LOCKED` for concurrent safety

## CI/CD Integration

### GitHub Actions

No performance workflow exists in `.github/workflows/` today, and the repo's `.github/workflows/` directory has no `performance.yml` or similar. The sketch below is aspirational: it shows how a workflow could be wired up once the underlying baseline/regression commands exist, using a real k6 file path.

```yaml
# Aspirational example, not a shipped workflow
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
          filename: packages/test/load-tests/load/auth/auth-sign-in.js
```

### Baseline Metrics

Record baseline metrics after each optimization:
1. Response times (p50, p95, p99)
2. Throughput (req/s)
3. Error rate
4. Resource usage (CPU, memory)

### Performance Monitoring

Consider integrating with:
- **Grafana + Prometheus** for metrics visualization
- **k6 Cloud** for distributed load testing
- **Datadog APM** for performance monitoring

## Troubleshooting

### Tests Fail to Connect

**Problem:** Tests can't connect to BASE_URL

**Solution:**
```bash
# Ensure dev server is running
pnpm dev

# Or update BASE_URL to correct endpoint
export BASE_URL=http://localhost:3000
```

### High Latency

**Problem:** Tests show high latency

**Possible Causes:**
- Database connection issues
- Rate limiting too aggressive
- Missing indexes
- Resource constraints

**Solutions:**
- Check database performance
- Review rate limiting configuration
- Add database indexes
- Scale resources

### Test Failures

**Problem:** Tests failing with errors

**Possible Causes:**
- API endpoint changes
- Authentication changes
- Rate limiting blocking requests
- Database issues

**Solutions:**
- Update test endpoints
- Review authentication flow
- Adjust rate limits for tests
- Check database connection

### Authentication Performance Issues

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
   - In-memory vs database
   - Storage performance

### Performance Budget Issues

#### Budgets Too Strict (False Positives)

**Symptoms:** Frequent build failures despite acceptable performance

**Solution:**
1. Re-run the relevant k6 scripts and read their summary output (no aggregation tool exists yet)
2. Increase buffer in formula (try 1.4 instead of 1.25)
3. Review if infrastructure changes affected baselines

#### Budgets Too Loose (Missed Regressions)

**Symptoms:** Performance degrades but tests pass

**Solution:**
1. Run analysis with fresh baseline data
2. Decrease buffer in formula (try 1.15 instead of 1.25)
3. Review actual user impact of "acceptable" degradation

#### Inconsistent Results

**Symptoms:** High variance in performance metrics

**Solution:**
1. Increase sample size (run tests 10+ times)
2. Review test environment stability
3. Consider time-based testing (avoid peak hours)

### Staging Environment Issues

#### Staging Deployment Issues

1. **Deployment fails**: Check your deployment platform configuration
2. **Health check fails**: Ensure your staging app has a `/api/health` endpoint
3. **Database connection**: Verify staging database credentials

#### Staging Performance Test Issues

1. **Tests time out**: Increase the staging deployment wait time
2. **High error rates**: Check if staging services are running correctly
3. **Slow response times**: Staging infrastructure may be under-provisioned

## Best Practices

### General Best Practices

1. **Run baseline after significant changes**
2. **Monitor for regressions regularly**
3. **Run stress tests before releases**
4. **Document performance characteristics**
5. **Set realistic thresholds**
6. **Test in production-like environments**

### Performance Budget Best Practices

1. **Use Real Data**: Always base budgets on actual performance data
2. **Regular Updates**: Review budgets quarterly minimum
3. **Environment Awareness**: Different budgets for staging vs production
4. **Statistical Confidence**: Use sufficient sample sizes for reliable statistics
5. **Business Alignment**: Consider user experience impact, not just technical metrics

### Staging Testing Best Practices

1. Monitor staging test results over time
2. Adjust performance budgets based on real data
3. Consider adding performance alerting
4. Implement gradual rollout strategies for risky changes

## Next Steps

- [ ] Set up CI/CD performance test runs
- [ ] Integrate with performance monitoring
- [ ] Add more performance test scenarios
- [ ] Document performance targets
- [ ] Create performance dashboard
- [ ] Implement automated budget updates
- [ ] Set up performance alerting

## Example Output

### Performance Analysis Example

```
📊 auth/auth-sign-in.js:
   Sample Size: 10 runs
   Current P95: avg=1200ms, median=1180ms, 95th%ile=1350ms
   Error Rates: avg=0.20%, median=0.15%, max=0.50%
   Recommended Budgets: P95 ≤1688ms, Error Rate ≤0.55%

📊 api/api-pages.js:
   Sample Size: 10 runs
   Current P95: avg=850ms, median=820ms, 95th%ile=950ms
   Recommended Budgets: P95 ≤1188ms, Error Rate ≤1.00%
```

This data-driven approach ensures performance budgets accurately reflect real application performance while providing appropriate safety margins.

---

# API Performance Optimization Guide

This guide covers the API performance optimization infrastructure implemented in RevealUI, including response compression, HTTP caching, payload optimization, and rate limiting.

## Table of Contents

- [Overview](#overview)
- [Response Compression](#response-compression)
- [HTTP Caching](#http-caching)
- [Payload Optimization](#payload-optimization)
- [Rate Limiting](#rate-limiting)
- [Performance Monitoring](#performance-monitoring)
- [Best Practices](#best-practices)
- [Benchmarking](#benchmarking)

## Overview

API performance optimization is critical for:
- Reducing bandwidth usage
- Improving response times
- Preventing API abuse
- Enhancing user experience
- Reducing infrastructure costs

Our optimization strategy includes:
1. **Response Compression** - Reduce payload size with gzip/brotli
2. **HTTP Caching** - Minimize redundant requests
3. **Payload Optimization** - Send only necessary data
4. **Rate Limiting** - Prevent abuse and ensure fair usage

## Response Compression

Location: `packages/core/src/api/compression.ts`

### Features

- **Multi-format Support**: Gzip and Brotli compression
- **Automatic Detection**: Uses client Accept-Encoding header
- **Configurable Threshold**: Only compress responses above size threshold
- **Content Type Filtering**: Skip already-compressed content (images, videos)
- **Compression Levels**: Configurable 1-9 for gzip, 0-11 for brotli

### Usage

#### Basic Compression

```typescript
import { compressResponse, COMPRESSION_PRESETS } from '@revealui/core/api/compression'

// In Next.js API route
export async function GET(request: NextRequest) {
  const data = await fetchData()
  const response = NextResponse.json(data)

  // Compress response
  return compressResponse(request, response, COMPRESSION_PRESETS.api)
}
```

#### Compression Middleware

```typescript
import { createCompressionMiddleware } from '@revealui/core/api/compression'

const compressionMiddleware = createCompressionMiddleware({
  threshold: 1024, // 1KB minimum
  level: 6,
  preferBrotli: true,
})

// Apply to route
export async function GET(request: NextRequest) {
  return compressionMiddleware(request, async () => {
    const data = await fetchData()
    return NextResponse.json(data)
  })
}
```

### Compression Presets

```typescript
// Fast compression (lower ratio, faster)
COMPRESSION_PRESETS.fast

// Balanced (default)
COMPRESSION_PRESETS.balanced

// Maximum compression (slower, best ratio)
COMPRESSION_PRESETS.max

// For static assets
COMPRESSION_PRESETS.static

// For API responses
COMPRESSION_PRESETS.api
```

### Performance Impact

- **Typical Savings**: 60-80% for JSON responses
- **Brotli vs Gzip**: Brotli typically 15-25% better compression
- **CPU Cost**: Minimal for level 6, moderate for level 9
- **Latency**: +5-20ms compression time, offset by faster transfer

### Best Practices

1. **Set Appropriate Threshold**: Don't compress tiny responses (<1KB)
2. **Use Brotli for Static**: Pre-compress static assets with brotli level 11
3. **Cache Compressed**: Cache both compressed and uncompressed versions
4. **Monitor CPU**: Watch CPU usage on high-traffic endpoints
5. **Skip Images**: Never compress already-compressed formats

## HTTP Caching

Location: `packages/core/src/api/response-cache.ts`

### Features

- **Cache-Control Headers**: Automatic header management
- **ETag Support**: Conditional requests with 304 responses
- **Tag-based Invalidation**: Invalidate related cache entries
- **Stale-While-Revalidate**: Serve stale content while revalidating
- **Private/Public Caching**: Control cache scope

### Usage

#### Cache Middleware

```typescript
import { createCacheMiddleware, CACHE_PRESETS } from '@revealui/core/api/response-cache'

// Cache for 5 minutes
const cacheMiddleware = createCacheMiddleware(CACHE_PRESETS.medium)

export async function GET(request: NextRequest) {
  return cacheMiddleware(request, async () => {
    const data = await fetchData()
    return NextResponse.json(data)
  })
}
```

#### Manual Caching

```typescript
import { getCachedResponse, setCachedResponse } from '@revealui/core/api/response-cache'

export async function GET(request: NextRequest) {
  // Try cache first
  const cached = await getCachedResponse(request)
  if (cached) return cached

  // Generate response
  const data = await fetchData()
  const response = NextResponse.json(data)

  // Cache it
  await setCachedResponse(request, response, {
    ttl: 300,
    tags: ['users', 'profiles'],
  })

  return response
}
```

#### Cache Invalidation

```typescript
import { invalidateCacheTags, invalidateCachePattern } from '@revealui/core/api/response-cache'

// Invalidate by tags
invalidateCacheTags(['users', 'profiles'])

// Invalidate by pattern
invalidateCachePattern('/api/users/*')
```

### Cache Presets

```typescript
// No caching
CACHE_PRESETS.noCache

// 1 minute cache
CACHE_PRESETS.short

// 5 minute cache
CACHE_PRESETS.medium

// 1 hour cache
CACHE_PRESETS.long

// 1 day cache
CACHE_PRESETS.veryLong

// 1 year (immutable)
CACHE_PRESETS.immutable

// Private user data
CACHE_PRESETS.private

// Public static data
CACHE_PRESETS.public
```

### Cache Headers

The middleware automatically sets:

```http
Cache-Control: public, max-age=300, stale-while-revalidate=60
ETag: "abc123"
Age: 45
X-Cache: HIT
Vary: Accept-Encoding
```

### Best Practices

1. **Cache GET Requests**: Only cache GET and HEAD requests
2. **Use ETags**: Implement ETags for conditional requests
3. **Tag Everything**: Use tags for related resources
4. **Vary Headers**: Include Vary header for correct caching
5. **Monitor Hit Rate**: Target >80% cache hit rate
6. **Stale-While-Revalidate**: Use for better UX with fresh data

## Payload Optimization

Location: `packages/core/src/api/payload-optimization.ts`

### Features

- **Field Selection**: Include/exclude specific fields
- **Pagination**: Offset and cursor-based pagination
- **Empty Value Removal**: Strip null/undefined values
- **Date Transformation**: Convert dates to ISO strings
- **Sensitive Field Sanitization**: Remove passwords, tokens, etc.
- **Size Calculation**: Measure and report optimization savings

### Usage

#### Field Selection

```typescript
import { selectFields } from '@revealui/core/api/payload-optimization'

const user = {
  id: 1,
  name: 'John',
  email: 'john@example.com',
  password: 'secret',
  createdAt: new Date(),
}

// Include only specific fields
const publicUser = selectFields(user, {
  include: ['id', 'name', 'email'],
})
// { id: 1, name: 'John', email: 'john@example.com' }

// Exclude sensitive fields
const safeUser = selectFields(user, {
  exclude: ['password'],
})
```

#### Pagination

```typescript
import { paginateArray } from '@revealui/core/api/payload-optimization'

const users = await db.query.users.findMany()

// Paginate results
const result = paginateArray(users, {
  page: 1,
  limit: 20,
  maxLimit: 100,
})

/*
{
  data: [...20 users...],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    hasMore: true
  }
}
*/
```

#### Cursor-based Pagination

```typescript
import { createCursor, parseCursor } from '@revealui/core/api/payload-optimization'

// Create cursor from last item
const lastUser = users[users.length - 1]
const cursor = createCursor(lastUser, 'id')

// Parse cursor in next request
const { field, value } = parseCursor(cursor)
// Use value to fetch next page: WHERE id > value
```

#### Complete Optimization

```typescript
import { optimizePayload } from '@revealui/core/api/payload-optimization'

const result = optimizePayload(users, {
  include: ['id', 'name', 'email', 'createdAt'],
  removeEmpty: true,
  transformDates: true,
  sanitize: true,
})

console.log(`Original: ${result.originalSize} bytes`)
console.log(`Optimized: ${result.optimizedSize} bytes`)
console.log(`Savings: ${result.savingsPercent.toFixed(1)}%`)
```

#### Query Parameter Support

```typescript
import { parseFieldsFromQuery, parsePaginationFromQuery } from '@revealui/core/api/payload-optimization'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)

  // Parse ?fields=id,name,email
  const fields = parseFieldsFromQuery(url.search)

  // Parse ?page=2&limit=20
  const pagination = parsePaginationFromQuery(url.search)

  const users = await fetchUsers()
  return NextResponse.json(
    createOptimizedResponse(users, { fields, pagination })
  )
}
```

### Best Practices

1. **Default Fields**: Define sensible default fields for each resource
2. **Exclude Sensitive**: Always exclude passwords, tokens, secrets
3. **Cursor for Large Sets**: Use cursor pagination for >10k items
4. **Remove Empty**: Strip null/undefined to reduce payload
5. **Transform Dates**: Standardize on ISO 8601 format
6. **Document Fields**: Document available fields in API docs

## Rate Limiting

Location: `packages/core/src/api/rate-limit.ts`

### Features

- **Multiple Algorithms**: Fixed window, sliding window, token bucket
- **Flexible Keys**: By IP, user ID, API key, endpoint
- **Configurable Limits**: Presets for common scenarios
- **Standard Headers**: X-RateLimit-* headers
- **429 Responses**: Proper rate limit exceeded responses
- **Automatic Cleanup**: Remove expired entries

### Usage

#### Basic Rate Limiting

```typescript
import { createRateLimitMiddleware, RATE_LIMIT_PRESETS } from '@revealui/core/api/rate-limit'

// 100 requests per minute
const rateLimitMiddleware = createRateLimitMiddleware(RATE_LIMIT_PRESETS.standard)

export async function GET(request: NextRequest) {
  return rateLimitMiddleware(request, async () => {
    const data = await fetchData()
    return NextResponse.json(data)
  })
}
```

#### Custom Rate Limiting

```typescript
import { createRateLimitMiddleware } from '@revealui/core/api/rate-limit'

const rateLimitMiddleware = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50,
  keyGenerator: (request) => {
    // Rate limit by user ID
    const userId = request.headers.get('x-user-id') || 'anonymous'
    return `user:${userId}`
  },
})
```

#### Rate Limit by User

```typescript
import { createUserRateLimit } from '@revealui/core/api/rate-limit'

const rateLimitMiddleware = createUserRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 100,
})
```

#### Rate Limit by API Key

```typescript
import { createAPIKeyRateLimit } from '@revealui/core/api/rate-limit'

const rateLimitMiddleware = createAPIKeyRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 1000, // Higher limit for API keys
})
```

#### Sliding Window Rate Limiting

```typescript
import { checkSlidingWindowRateLimit } from '@revealui/core/api/rate-limit'

export async function POST(request: NextRequest) {
  const result = checkSlidingWindowRateLimit(request, {
    windowMs: 60 * 1000,
    maxRequests: 10,
  })

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }

  // Process request
}
```

### Rate Limit Presets

```typescript
// 10 requests per minute
RATE_LIMIT_PRESETS.veryStrict

// 30 requests per minute
RATE_LIMIT_PRESETS.strict

// 100 requests per minute
RATE_LIMIT_PRESETS.standard

// 500 requests per minute
RATE_LIMIT_PRESETS.relaxed

// 1000 requests per hour
RATE_LIMIT_PRESETS.hourly

// 10000 requests per day
RATE_LIMIT_PRESETS.daily
```

### Rate Limit Headers

Responses include:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-15T10:30:00.000Z
```

429 responses include:

```http
Retry-After: 45
```

### Best Practices

1. **Different Tiers**: Use different limits for anonymous, authenticated, premium
2. **Endpoint-specific**: Apply stricter limits to expensive endpoints
3. **Sliding Window**: Use for smoother rate limiting experience
4. **Token Bucket**: Use for burst tolerance
5. **Monitor Abuse**: Track rate limit hits to identify abuse
6. **Graceful Degradation**: Return informative 429 responses

## Performance Monitoring

### API Response Metrics

Track these metrics for each endpoint:

```typescript
interface APIMetrics {
  endpoint: string
  method: string
  avgResponseTime: number
  p50: number
  p95: number
  p99: number
  requestCount: number
  errorRate: number
  cacheHitRate: number
  avgPayloadSize: number
  compressionRatio: number
}
```

### Monitoring Implementation

```typescript
import { monitorQuery } from '@revealui/core/monitoring/query-monitor'

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const response = await monitorQuery('api:users:list', async () => {
      // Your API logic
      const data = await fetchUsers()
      return NextResponse.json(data)
    })

    // Track metrics
    const duration = Date.now() - startTime
    trackAPIMetric('/api/users', 'GET', duration, response.status)

    return response
  } catch (error) {
    trackAPIError('/api/users', 'GET', error)
    throw error
  }
}
```

### Key Performance Indicators

| Metric | Target | Critical |
|--------|--------|----------|
| Response Time (p95) | < 200ms | < 500ms |
| Response Time (p99) | < 500ms | < 1s |
| Cache Hit Rate | > 80% | > 60% |
| Error Rate | < 0.1% | < 1% |
| Compression Ratio | > 60% | > 40% |
| Rate Limit Hit Rate | < 1% | < 5% |

## Best Practices

### 1. Combine Optimizations

```typescript
import { createCompressionMiddleware } from '@revealui/core/api/compression'
import { createCacheMiddleware } from '@revealui/core/api/response-cache'
import { createRateLimitMiddleware } from '@revealui/core/api/rate-limit'
import { createOptimizedResponse } from '@revealui/core/api/payload-optimization'

export async function GET(request: NextRequest) {
  // Apply rate limiting first
  const rateLimitMiddleware = createRateLimitMiddleware(RATE_LIMIT_PRESETS.standard)

  return rateLimitMiddleware(request, async () => {
    // Then check cache
    const cacheMiddleware = createCacheMiddleware(CACHE_PRESETS.medium)

    return cacheMiddleware(request, async () => {
      // Generate optimized response
      const data = await fetchUsers()
      const optimized = createOptimizedResponse(data, {
        fields: { include: ['id', 'name', 'email'] },
        pagination: { page: 1, limit: 20 },
      })

      const response = NextResponse.json(optimized)

      // Finally compress
      const compressionMiddleware = createCompressionMiddleware(COMPRESSION_PRESETS.api)
      return compressionMiddleware(request, async () => response)
    })
  })
}
```

### 2. Cache Compressed Responses

Store both compressed and uncompressed versions in cache for maximum efficiency.

### 3. Monitor Everything

Track all optimization metrics to identify bottlenecks and measure improvements.

### 4. Test Under Load

Use benchmarking tools to verify optimizations work under realistic load.

### 5. Document Limits

Clearly document rate limits and optimization strategies in API documentation.

## Benchmarking

No dedicated API benchmark runner ships in this repo today (`scripts/performance/benchmark-api.ts` and the `pnpm benchmark:api` command described in earlier drafts of this doc were never built). The one benchmark that exists is `packages/cache/src/__tests__/benchmark-pglite-vs-map.test.ts`, which compares PGlite-backed and in-memory cache performance:

```bash
# Run the cache benchmark
pnpm --filter @revealui/cache test
```

Compression, caching, payload-optimization, and rate-limiting benchmarking (fixed window vs sliding window, token bucket overhead) are still worth doing manually, but there is no automated suite for any of it yet, and no measured numbers to report here.

## Production Recommendations

### Infrastructure

1. **Use Database Backend**: Replace in-memory stores with PostgreSQL-backed storage in production
2. **CDN Integration**: Use CDN for static assets and cached responses
3. **Load Balancing**: Ensure rate limits work across multiple servers
4. **Monitoring**: Implement comprehensive API monitoring

### Configuration

```typescript
// Production configuration
const PRODUCTION_CONFIG = {
  compression: {
    threshold: 1024,
    level: 6,
    preferBrotli: true,
  },

  caching: {
    ttl: 300,
    staleWhileRevalidate: 60,
    tags: true,
  },

  rateLimit: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyGenerator: (req) => getUserId(req),
  },

  payload: {
    defaultLimit: 20,
    maxLimit: 100,
    removeEmpty: true,
    transformDates: true,
  },
}
```

### Monitoring Alerts

Set up alerts for:
- Response time > 500ms (p95)
- Error rate > 1%
- Cache hit rate < 60%
- Rate limit violations > 100/hour per IP

## Troubleshooting

### High Response Times

1. Check cache hit rate
2. Verify database query optimization
3. Review compression level (may be too high)
4. Check for N+1 queries

### Low Cache Hit Rate

1. Verify cache TTL isn't too short
2. Check cache invalidation strategy
3. Review cache key generation
4. Monitor cache storage limits

### Rate Limit Issues

1. Review rate limit configuration
2. Check for legitimate high-volume users
3. Verify key generation strategy
4. Consider implementing tiered limits

### Compression Problems

1. Verify Accept-Encoding header support
2. Check compression threshold
3. Review excluded content types
4. Monitor CPU usage

## Further Reading

- [HTTP Caching (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Content Negotiation (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation)
- [Rate Limiting Algorithms](https://en.wikipedia.org/wiki/Rate_limiting)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)

---

# Bundle Optimization Guide

This guide covers frontend bundle optimization techniques implemented in RevealUI, including bundle size reduction, code splitting, asset optimization, and build performance improvements.

## Table of Contents

- [Overview](#overview)
- [Bundle Analysis](#bundle-analysis)
- [Code Splitting](#code-splitting)
- [Asset Optimization](#asset-optimization)
- [Build Performance](#build-performance)
- [Tree Shaking](#tree-shaking)
- [Compression](#compression)
- [Performance Budgets](#performance-budgets)
- [Best Practices](#best-practices)
- [Benchmarking](#benchmarking)

## Overview

Bundle optimization is critical for:
- Reducing initial page load time
- Improving Time to Interactive (TTI)
- Reducing bandwidth usage
- Better mobile performance
- Improved SEO and Core Web Vitals

Our optimization strategy:
1. **Bundle Analysis** - Understand what's in your bundles
2. **Code Splitting** - Load only what's needed
3. **Asset Optimization** - Optimize images, fonts, CSS
4. **Build Performance** - Faster builds with caching
5. **Tree Shaking** - Remove unused code
6. **Compression** - Reduce transfer size

## Bundle Analysis

Analyse bundles with framework-native tooling — RevealUI does not ship its own analyzer.

### Next.js

```bash
pnpm add -D @next/bundle-analyzer
```

```javascript
// next.config.js
import withBundleAnalyzer from '@next/bundle-analyzer'

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default bundleAnalyzer({
  // your Next.js config
})
```

```bash
ANALYZE=true pnpm build
# Writes an interactive treemap to .next/analyze/client.html
```

### Vite

```bash
pnpm add -D rollup-plugin-visualizer
```

```javascript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer'
export default {
  plugins: [visualizer({ filename: 'dist/stats.html', gzipSize: true })],
}
```

### Bundle Health Targets

Use these as review heuristics, not hard gates:

1. **Bundle Size**
   - Excellent: <500KB (gzipped, initial route)
   - Good: 500KB-1MB
   - Poor: >1MB

2. **Large Files**
   - Flag any individual chunk >100KB gzipped

3. **Code Splitting**
   - Expect ~10 async chunks for a medium app; very few = not splitting enough, very many = over-splitting

4. **Duplicate Dependencies**
   - Audit with `pnpm why <pkg>` and syncpack; each duplicate adds parse + eval cost

## Code Splitting

### Route-Based Code Splitting

```typescript
import { lazy, Suspense } from 'react'

const HomePage = lazy(() => import('./pages/HomePage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))

<Suspense fallback={<Loading />}>
  <HomePage />
</Suspense>
```

For Next.js, pages and `app/` routes are code-split automatically — no `lazy()` needed at the route level.

#### Retry-on-chunk-load-error

Deployed chunks can 404 after a new deploy. Wrap `import()` to retry once:

```typescript
function lazyWithRetry<T extends { default: React.ComponentType<unknown> }>(
  factory: () => Promise<T>,
): React.LazyExoticComponent<T['default']> {
  return lazy(async () => {
    try {
      return await factory()
    } catch {
      await new Promise((r) => setTimeout(r, 500))
      return factory()
    }
  })
}

const HomePage = lazyWithRetry(() => import('./pages/HomePage'))
```

### Component-Based Code Splitting

```typescript
const Chart = lazy(() => import('./components/Chart'))
const Modal = lazy(() => import('./components/Modal'))
const Editor = lazy(() => import('./components/Editor'))

<Suspense fallback={<Loading />}>
  <Chart data={data} />
</Suspense>
```

### Prefetching on Hover

```typescript
function DashboardLink() {
  const prefetch = () => import('./pages/Dashboard')
  return (
    <a href="/dashboard" onPointerEnter={prefetch}>
      Dashboard
    </a>
  )
}
```

### Load on Interaction

```typescript
const buttonRef = useRef<HTMLButtonElement>(null)

useEffect(() => {
  const el = buttonRef.current
  if (!el) return
  const load = () => import('./components/Modal')
  el.addEventListener('click', load, { once: true })
  return () => el.removeEventListener('click', load)
}, [])
```

### Load on Visibility

```typescript
const elementRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const el = elementRef.current
  if (!el) return
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        import('./components/Footer')
        observer.disconnect()
      }
    },
    { rootMargin: '50px' },
  )
  observer.observe(el)
  return () => observer.disconnect()
}, [])
```

### Vendor Chunk Splitting

Next.js and Vite both split vendor chunks automatically. For finer control, configure `splitChunks` (webpack) or `rollupOptions.output.manualChunks` (Vite). Typical groups:

- `react-vendors`: React, ReactDOM, React Router
- `ui-vendors`: `class-variance-authority`, `clsx`
- `utils-vendors`: date-fns, lodash-es
- `vendors`: other `node_modules`

### Bundle Budgets

Enforce budgets in CI with [`bundlesize`](https://github.com/siddharthkp/bundlesize) or Next.js's built-in `experimental.bundlePagesRouterDependencies`:

| Budget | Target |
|--------|--------|
| Max total JS | 500KB gzipped |
| Max initial JS | 200KB gzipped |
| Max async chunk | 100KB gzipped |
| Max CSS | 50KB gzipped |

## Asset Optimization

### Image Optimization

```typescript
// next.config.js
export default {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.example.com' }],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year
  },
}
```

#### Responsive Images

Next.js's `<Image>` generates `srcset` + `sizes` automatically from `sizes` prop. When you need them by hand:

```typescript
function srcSet(src: string, widths: number[]): string {
  return widths.map((w) => `${src}?w=${w} ${w}w`).join(', ')
}
// /image.jpg?w=640 640w, /image.jpg?w=1024 1024w, /image.jpg?w=1920 1920w

const sizes = [
  '(max-width: 768px) 100vw',
  '(max-width: 1200px) 50vw',
  '33vw',
].join(', ')
```

#### Using Next.js Image

```tsx
import Image from 'next/image'

<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1920}
  height={1080}
  priority // For LCP image
  placeholder="blur"
  quality={75}
/>
```

### Font Optimization

Use `next/font` — it self-hosts Google fonts and inlines `@font-face` / preload tags with zero runtime:

```tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '700'],
  variable: '--font-inter',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
```

For non-Next frameworks, hand-author `<link rel="preload" as="font" crossorigin>` tags in `<head>` and `@font-face { font-display: swap }` in CSS.

### CSS Optimization

- **Tailwind v4** (the RevealUI default) already tree-shakes unused utilities at build time — no extra tool needed.
- **Critical CSS**: Next.js inlines route-critical CSS automatically. For other frameworks, use [`critters`](https://github.com/GoogleChromeLabs/critters) or [`beasties`](https://github.com/danielroe/beasties).

### SVG Optimization

Run SVGs through [`svgo`](https://github.com/svg/svgo) at build time — either its CLI or `@svgr/webpack` / `vite-plugin-svgr`:

```bash
pnpm dlx svgo --multipass src/icons/
```

For inlining, a React-component-per-icon workflow (SVGR) is usually faster than data URIs.

### Resource Hints

Emit resource hints declaratively in your framework:

```tsx
// Next.js app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/critical.css" as="style" />
        <link rel="dns-prefetch" href="https://api.example.com" />
        <link rel="dns-prefetch" href="https://cdn.example.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdn.example.com" crossOrigin="" />
        <link rel="prefetch" href="/about" />
        <link rel="prefetch" href="/contact" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

## Build Performance

### Next.js Optimization Config

```typescript
// next.config.js
export default {
  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },

  experimental: {
    optimizePackageImports: [
      'lodash-es',
      'date-fns',
      '@radix-ui/react-icons',
    ],
  },

  productionBrowserSourceMaps: false,
  compress: true,
}
```

`swcMinify` and automatic output-file-tracing have been defaults since Next 14 — no flag needed. `experimental.optimizeCss` was removed in Next 16; Tailwind v4 handles CSS minification via Lightning CSS.

### Build Caching

```typescript
// Enable filesystem cache
{
  cache: {
    type: 'filesystem',
    cacheDirectory: '.next/cache',
    compression: 'gzip',
    maxAge: 604800000, // 1 week
  }
}
```

### Parallel Builds

```bash
# Use all CPU cores
pnpm build --parallel

# Specify core count
pnpm build --parallel=4
```

### Build Profiling

Use Turborepo's built-in profiler — it emits a Chrome-DevTools-compatible trace:

```bash
pnpm turbo run build --profile=build.json
# Open build.json in chrome://tracing or https://ui.perfetto.dev/
```

For Next.js-specific compile profiling, set `NEXT_TURBOPACK_TRACING=true` (Turbopack) or pass `--profile` to the Webpack build.

## Tree Shaking

### Package Configuration

```json
{
  "sideEffects": false
}
```

Or specify files with side effects:

```json
{
  "sideEffects": ["*.css", "*.scss"]
}
```

### Import Strategies

```typescript
// ❌ Bad: Imports entire library
import _ from 'lodash'
import { format } from 'date-fns'

// ✅ Good: Import specific functions
import debounce from 'lodash/debounce'
import map from 'lodash/map'
import format from 'date-fns/format'

// ✅ Best: Use ES modules
import { debounce, map } from 'lodash-es'
```

### Tree-Shakeable Libraries

Use these alternatives for better tree shaking:

| Instead of | Use |
|------------|-----|
| `lodash` | `lodash-es` |
| `moment` | `date-fns` |
| `material-ui` | `@mui/material` with individual imports |
| `antd` | Individual component imports |

## Compression

### Static Asset Compression

```bash
# Pre-compress assets with Brotli (level 11)
find .next/static -type f \( -name '*.js' -o -name '*.css' \) -exec brotli -q 11 -o {}.br {} \;

# Pre-compress with Gzip
find .next/static -type f \( -name '*.js' -o -name '*.css' \) -exec gzip -9 -k {} \;
```

### Runtime Compression

```typescript
// In middleware or API routes
import { compressResponse } from '@revealui/core/api/compression'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  return compressResponse(request, response, {
    level: 6,
    preferBrotli: true,
  })
}
```

### Compression Ratios

Typical compression ratios:

| Asset Type | Gzip | Brotli |
|------------|------|--------|
| JavaScript | 65% | 72% |
| CSS | 75% | 80% |
| JSON | 85% | 88% |
| HTML | 70% | 75% |

## Performance Budgets

### Setting Budgets

```typescript
// Budget configuration
const budgets = {
  maxSize: 500 * 1024, // 500KB total
  maxInitialSize: 200 * 1024, // 200KB initial
  maxAsyncSize: 100 * 1024, // 100KB per async chunk
  maxCSSSize: 50 * 1024, // 50KB CSS
}
```

### Enforcing Budgets

Enforce in CI with [`bundlesize`](https://github.com/siddharthkp/bundlesize) or Next.js's [`--experimental-build-budget`](https://nextjs.org/docs) flag. A minimal hand-rolled check:

```typescript
import { statSync } from 'node:fs'

function assertUnder(path: string, maxBytes: number): void {
  const size = statSync(path).size
  if (size > maxBytes) {
    console.error(`${path}: ${size} bytes exceeds budget of ${maxBytes}`)
    process.exit(1)
  }
}

assertUnder('.next/static/chunks/main.js', 200 * 1024)
```

### CI Integration

There is no `.github/workflows/bundle-check.yml` in this repo and no `pnpm benchmark:bundle:size` command. The sketch below is aspirational, built on the manual `assertUnder` check above rather than an invented benchmark command.

```yaml
# Aspirational example, not a shipped workflow
- name: Check Bundle Size
  run: |
    pnpm build
    node ./scripts/check-bundle-size.mjs   # would need to be written; wraps assertUnder above
```

## Best Practices

### 1. Route-Based Code Splitting

Split at the route level for optimal initial load:

```tsx
const routes = [
  {
    path: '/',
    component: lazy(() => import('./pages/HomePage')),
  },
  {
    path: '/about',
    component: lazy(() => import('./pages/AboutPage')),
  },
]
```

### 2. Component-Based Splitting

Split large, rarely-used components:

```tsx
// Heavy components
const Chart = lazy(() => import('./components/Chart'))
const Editor = lazy(() => import('./components/Editor'))
const Calendar = lazy(() => import('./components/Calendar'))
```

### 3. Vendor Splitting

Separate vendor code from application code:

```javascript
// webpack config
splitChunks: {
  cacheGroups: {
    vendor: {
      test: /[\\/]node_modules[\\/]/,
      name: 'vendors',
      chunks: 'all',
    },
  },
}
```

### 4. Preload Critical Assets

```html
<!-- In <head> -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/critical.css" as="style">
```

### 5. Lazy Load Images

```tsx
<Image
  src="/image.jpg"
  alt="Description"
  loading="lazy"
  width={800}
  height={600}
/>
```

### 6. Optimize Dependencies

```bash
# Analyze dependencies
npx depcheck

# Find duplicate dependencies
npx npm-check-duplicates

# Analyze bundle composition
npx webpack-bundle-analyzer
```

### 7. Use Modern Formats

- Images: WebP, AVIF
- Fonts: WOFF2
- JavaScript: ES2020+
- CSS: Modern selectors

### 8. Enable Compression

Always enable Brotli for best compression:

```javascript
// next.config.js
{
  compress: true,
  generateEtags: true,
}
```

## Benchmarking

No dedicated bundle benchmark runner ships in this repo today (`scripts/performance/benchmark-bundle.ts` and the `pnpm benchmark:bundle*` commands described in earlier drafts of this doc were never built). `apps/admin` does wire up `@next/bundle-analyzer` via `pnpm --filter admin analyze`, which produces a real bundle-composition report. Combine that with the manual `assertUnder` budget check shown above to catch regressions until an automated benchmark exists.

## Performance Targets

| Metric | Target | Excellent |
|--------|--------|-----------|
| Total Bundle Size | <500KB | <300KB |
| Initial Load | <200KB | <150KB |
| Time to Interactive | <3s | <2s |
| First Contentful Paint | <1.8s | <1s |
| Largest Contentful Paint | <2.5s | <1.5s |
| Cumulative Layout Shift | <0.1 | <0.05 |
| Bundle Health Score | >70 | >85 |

## Troubleshooting

### Large Bundle Size

1. Run bundle analyzer: `pnpm --filter admin analyze`
2. Check for duplicate dependencies
3. Verify tree shaking is working
4. Split large components
5. Remove unused dependencies

### Slow Build Times

1. Enable build cache
2. Use parallel builds
3. Upgrade to Turbopack (experimental)
4. Profile build with BuildProfiler
5. Optimize TypeScript configuration

### Poor Code Splitting

1. Review splitChunks configuration
2. Add route-based splitting
3. Split vendor bundles
4. Use dynamic imports
5. Check chunk sizes

## Further Reading

- [Next.js Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [webpack Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)
- [Tree Shaking](https://webpack.js.org/guides/tree-shaking/)
- [Code Splitting](https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading)
- [Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)

---

# Turbo Build Optimization

Comprehensive optimization of turbo.json for improved build performance and caching efficiency.

## Changes Made

### 1. Build Task Caching

**Before**: All build tasks had `cache: false`
**After**: Enabled caching for all build tasks

```json
{
  "dev:build": {
    "cache": true,        // ← Enabled
    "inputs": [...],      // ← Added input tracking
    "outputs": [...]
  }
}
```

**Impact**: Faster rebuilds when source files haven't changed

### 2. Input Tracking

Added `inputs` arrays to track which files trigger cache invalidation:

- **TypeScript files**: `src/**/*.ts`, `src/**/*.tsx`
- **Config files**: `package.json`, `tsconfig.json`
- **Styles**: `src/**/*.css` (for web/admin builds)
- **Assets**: `public/**` (for web/admin builds)
- **Build configs**: `vite.config.ts`, `next.config.mjs`

**Example**:
```json
{
  "admin:build": {
    "inputs": [
      "src/**/*.ts",
      "src/**/*.tsx",
      "src/**/*.css",
      "public/**",
      "package.json",
      "tsconfig.json",
      "next.config.mjs"
    ]
  }
}
```

### 3. Test Caching

**Before**: `test` had `cache: false`
**After**: Enabled caching with comprehensive input tracking

```json
{
  "test": {
    "cache": true,
    "inputs": [
      "src/**/*.ts",
      "src/**/*.tsx",
      "**/__tests__/**/*.ts",
      "**/__tests__/**/*.tsx",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "vitest.config.ts",
      "package.json"
    ],
    "outputs": ["coverage/**"]
  }
}
```

**Impact**: Tests only re-run when source or test files change

### 4. Type Checking Caching

Added `typecheck` task configuration:

```json
{
  "typecheck": {
    "cache": true,
    "dependsOn": ["^build"],
    "inputs": [
      "src/**/*.ts",
      "src/**/*.tsx",
      "tsconfig.json",
      "package.json"
    ],
    "outputs": []
  }
}
```

### 5. Linting Caching

**Before**: `lint` had `cache: false`
**After**: Enabled caching for all lint tasks

```json
{
  "lint": {
    "cache": true,
    "inputs": [
      "src/**/*.ts",
      "src/**/*.tsx",
      "src/**/*.js",
      "src/**/*.jsx",
      "biome.json",
      "package.json"
    ]
  }
}
```

### 6. Build Dependencies

Optimized dependency chains:

- All builds: `dependsOn: ["^build"]` - wait for upstream package builds
- Root build: `dependsOn: ["^build"]` - parallel package builds

## Performance Gains

### Expected Improvements

| Task | Before | After | Improvement |
|------|--------|-------|-------------|
| Repeat builds (no changes) | ~2min | ~5s | **96% faster** |
| Repeat tests (no changes) | ~30s | ~2s | **93% faster** |
| Repeat lint (no changes) | ~15s | ~1s | **93% faster** |
| Repeat typecheck (no changes) | ~20s | ~1s | **95% faster** |

### Cache Hit Scenarios

**Full cache hit** (no file changes):
```bash
pnpm build
# ✓ build: cache hit, replaying logs 5.2s
```

**Partial cache hit** (only one package changed):
```bash
pnpm build
# ✓ @revealui/core:build: cache hit
# ✓ @revealui/services:build: cache hit
# • @revealui/auth:build: rebuilding (src/auth.ts changed)
```

**Cache miss** (source files changed):
```bash
pnpm build
# • All packages: rebuilding
```

## Turbo Cache Location

Turbo stores cache in:
- **Local**: `./node_modules/.cache/turbo/`
- **Remote** (if configured): Vercel Remote Cache

## Cache Invalidation

Cache is invalidated when:

1. **Input files change** - Any file in `inputs` array
2. **Dependencies change** - package.json updates
3. **Config changes** - tsconfig.json, vite.config.ts, etc.
4. **Environment variables change** - Listed in `env` array
5. **Manual clear** - `pnpm clean` or `turbo prune`

## Best Practices

### 1. Keep Inputs Specific

❌ **Too broad**:
```json
{
  "inputs": ["**/*"]  // Invalidates on any file change
}
```

✅ **Specific**:
```json
{
  "inputs": [
    "src/**/*.ts",
    "package.json",
    "tsconfig.json"
  ]
}
```

### 2. Use Outputs for Artifacts

Specify exact output locations:

```json
{
  "outputs": [
    "dist/**",
    ".next/**",
    "coverage/**"
  ]
}
```

### 3. Persistent Tasks

Keep `persistent: true` for dev servers:

```json
{
  "dev": {
    "cache": false,      // Don't cache dev servers
    "persistent": true   // Keep running
  }
}
```

## Monitoring Cache Performance

Check cache hit rates:

```bash
# Build with cache stats
pnpm build --summarize

# View cache usage
turbo run build --dry-run
```

## Clearing Cache

When needed:

```bash
# Clear Turbo cache only
turbo prune

# Full clean (includes node_modules)
pnpm clean
```

## Verification

Test the optimizations:

```bash
# First run (cold cache)
pnpm build
# Should take ~2 minutes

# Second run (warm cache)
pnpm build
# Should take ~5 seconds (96% faster!)

# Verify cache hits
pnpm build --dry-run
```

## Target Metrics

From the Script Management Plan:

- ✅ **>70% cache hit rate** on repeat builds
- ✅ **20% faster test execution**
- ✅ **Incremental builds** supported

## Related Documentation

- [Turbo Documentation](https://turbo.build/repo/docs)
- [BuildCache Utility](scripts/lib/cache.ts)
- [SCRIPTS.md](./SCRIPTS.md) - All available scripts

---

**Last Updated**: Phase 3 - Script Optimization

---

# Caching Strategy Guide

This guide covers the comprehensive caching strategy implemented in RevealUI, including CDN configuration, browser caching, service workers, application-level caching, and edge computing.

## Table of Contents

- [Overview](#overview)
- [CDN Caching](#cdn-caching)
- [Browser Caching](#browser-caching)
- [Service Workers](#service-workers)
- [Application-Level Caching](#application-level-caching)
- [Edge Caching & ISR](#edge-caching--isr)
- [Cache Invalidation](#cache-invalidation)
- [Performance Impact](#performance-impact)
- [Best Practices](#best-practices)
- [Benchmarking](#benchmarking)

## Overview

A multi-layered caching strategy is essential for:
- Reducing server load (80-95% reduction possible)
- Improving response times (10-50x faster)
- Reducing bandwidth costs (60-90% savings)
- Better user experience (instant navigation)
- Offline support
- Improved reliability

Our caching strategy includes:
1. **CDN Caching** - Edge caching for global performance
2. **Browser Caching** - HTTP caching and service workers
3. **Application Caching** - React Query/SWR for data caching
4. **Edge Caching** - Next.js ISR and edge functions

## CDN Caching

> **Removed (C11, 2026-07-23).** The `@revealui/cache` CDN helpers (`packages/cache/src/cdn-config.ts`: `generateCacheControl`, purge/warm helpers, provider config generators) were tests-only with zero app consumers and were deleted. Set Cache-Control and purge via your host CDN / framework (Vercel, Cloudflare, `next/cache`). The package still ships store adapters and `CacheInvalidationChannel` for application-level stores.

## Browser Caching

### HTTP Caching

```typescript
// In Next.js API Route
export async function GET() {
  const data = await fetchData()

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
    },
  })
}
```

### Stale-While-Revalidate

```typescript
// Serve stale content while revalidating in background
{
  'Cache-Control': 'max-age=300, stale-while-revalidate=60'
}
```

This allows:
1. Serve from cache for 5 minutes
2. Between 5-6 minutes: serve stale, revalidate in background
3. After 6 minutes: fetch fresh

## Service Workers

RevealUI does not ship a service-worker helper. Apps that need offline support or PWA features should use their framework's native integration:

- **Next.js**: pair with [`next-pwa`](https://github.com/shadowwalker/next-pwa) or hand-author a service worker in `public/sw.js` and register it from a client component on page load.
- **Vite**: use [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/).

CDN purge / edge rate limiting helpers were removed from `@revealui/cache` (C11). Use platform APIs; keep app-level stores via `@revealui/cache/adapters` + `CacheInvalidationChannel`.

## Application-Level Caching

Use [TanStack Query](https://tanstack.com/query/latest) directly — RevealUI does not wrap it. The patterns below are conventions the team has standardised on for admin and marketing apps.

### React Query Configuration

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,            // 1 minute
      gcTime: 5 * 60_000,           // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  )
}
```

### Cache Key Conventions

Use a stable tuple shape so invalidation stays predictable:

```typescript
// ['<app-scope>', '<resource>', '<view>', ...params]
const usersListKey = ['app', 'users', 'list', { page: 1, limit: 20 }] as const
const userDetailKey = ['app', 'users', 'detail', 123] as const
const postsInfiniteKey = ['app', 'posts', 'infinite', { category: 'tech' }] as const
```

### Cache Invalidation

```typescript
import { useQueryClient } from '@tanstack/react-query'

function useInvalidateUsers() {
  const queryClient = useQueryClient()

  return {
    // Invalidate all user queries (matches ['app', 'users', ...])
    all: () => queryClient.invalidateQueries({ queryKey: ['app', 'users'] }),
    // Invalidate a specific user
    byId: (id: number) =>
      queryClient.invalidateQueries({ queryKey: ['app', 'users', 'detail', id] }),
    // Invalidate lists only
    lists: () => queryClient.invalidateQueries({ queryKey: ['app', 'users', 'list'] }),
  }
}
```

### Optimistic Updates

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'

function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateUserAPI,
    onMutate: async (newUser) => {
      await queryClient.cancelQueries({ queryKey: ['app', 'users'] })
      const previousUsers = queryClient.getQueryData<User[]>(['app', 'users', 'list'])

      queryClient.setQueryData<User[]>(['app', 'users', 'list'], (old) =>
        old?.map((u) => (u.id === newUser.id ? { ...u, ...newUser } : u)),
      )

      return { previousUsers }
    },
    onError: (_err, _newUser, context) => {
      queryClient.setQueryData(['app', 'users', 'list'], context?.previousUsers)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['app', 'users'] })
    },
  })
}
```

### Prefetching

```typescript
import { useQueryClient } from '@tanstack/react-query'

function UserLink({ userId }: { userId: number }) {
  const queryClient = useQueryClient()

  const prefetch = () =>
    queryClient.prefetchQuery({
      queryKey: ['app', 'users', 'detail', userId],
      queryFn: () => fetchUser(userId),
      staleTime: 30_000,
    })

  // Hover-with-delay prefetch: start on pointer enter, cancel on pointer leave.
  return (
    <Link
      to={`/users/${userId}`}
      onPointerEnter={prefetch}
    >
      View User
    </Link>
  )
}
```

### Cache Persistence

React Query ships a first-party persister. Install and wire it directly:

```bash
pnpm add @tanstack/query-sync-storage-persister @tanstack/react-query-persist-client
```

```typescript
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

const persister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: 'app-cache',
})

<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000, buster: 'v1' }}
>
  <YourApp />
</PersistQueryClientProvider>
```

## Edge Caching & ISR

> **Removed (C11, 2026-07-23).** The `@revealui/cache` edge helpers (`packages/cache/src/edge-cache.ts`: ISR presets, `revalidatePath`/`revalidateTag` wrappers, edge rate limit, geo/A-B helpers) were tests-only with zero app consumers and were deleted. Use framework primitives directly (e.g. Next.js `export const revalidate`, `next/cache` `revalidateTag` / `revalidatePath`).

## Cache Invalidation

### When to Invalidate

| Event | Invalidation Strategy |
|-------|----------------------|
| Create | Invalidate lists |
| Update | Invalidate item + lists |
| Delete | Invalidate item + lists |
| Bulk operation | Invalidate resource |
| User logout | Clear user-specific caches |

### Invalidation Patterns

```typescript
// After creating a post
queryClient.invalidateQueries({ queryKey: CacheInvalidator.lists('posts') })

// After updating a post
queryClient.invalidateQueries({ queryKey: CacheInvalidator.byId('posts', postId) })
queryClient.invalidateQueries({ queryKey: CacheInvalidator.lists('posts') })

// After deleting a post
queryClient.invalidateQueries({ queryKey: CacheInvalidator.byId('posts', postId) })
queryClient.invalidateQueries({ queryKey: CacheInvalidator.lists('posts') })

// After user logout
queryClient.clear()
await clearAllCaches()
```

## Performance Impact

### Cache Hit Rates

Expected cache hit rates:

| Cache Layer | Target Hit Rate | Latency Reduction |
|-------------|----------------|-------------------|
| CDN | >80% | 10-20x faster |
| Browser (HTTP) | >70% | 50-100x faster (instant) |
| Service Worker | >60% | 100-1000x faster |
| React Query | >80% | 50-100x faster |

### Performance Comparison

**Without Caching:**
- Server request: 150ms
- Database query: 50ms
- Total: 200ms per request
- 1000 requests = 200s

**With Multi-Layer Caching (80% hit rate):**
- 800 cached: ~2ms = 1.6s
- 200 fresh: ~200ms = 40s
- Total: 41.6s
- **Improvement: 79% faster**

### Production Impact

For an application with 1M requests/day:

**Server Load:**
- Without caching: 1M requests
- With 80% cache hit rate: 200K requests
- **Load reduction: 80%**

**Response Times:**
- Without caching: 200ms average
- With caching: 42ms average
- **Improvement: 79% faster**

**Bandwidth:**
- Without caching: 200GB/day
- With CDN + compression: 40GB/day
- **Savings: 80%**

## Best Practices

### 1. Layer Your Caching

```
User → Browser Cache → Service Worker → CDN → Edge Cache → Origin
         ↓              ↓                ↓        ↓           ↓
       Instant      ~2ms            ~20ms    ~50ms      ~200ms
```

### 2. Use Appropriate TTLs

| Content Type | CDN TTL | Browser TTL |
|--------------|---------|-------------|
| Immutable assets | 1 year | 1 year |
| Versioned assets | 1 year | 1 month |
| Dynamic content | 5 minutes | 0 |
| User-specific | 0 | 5 minutes (private) |
| API responses | 1 minute | 0 |

### 3. Tag Everything

```typescript
// Tag responses for easy invalidation
response.headers.set('Cache-Tag', 'post,post:123,user:456,category:tech')

// Invalidate related content
await purgeCacheByTag(['user:456']) // Invalidates all content for user 456
```

### 4. Prefetch Strategically

Wire prefetching with the platform primitives — React Query's `prefetchQuery`, plus `requestIdleCallback` and `IntersectionObserver` for timing:

```typescript
// Prefetch on hover
<a onPointerEnter={() => queryClient.prefetchQuery(queryOpts)} />

// Prefetch on idle (lowest priority)
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => queryClient.prefetchQuery(queryOpts))
}

// Prefetch on visibility
const observer = new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) {
    queryClient.prefetchQuery(queryOpts)
    observer.disconnect()
  }
})
observer.observe(element)
```

### 5. Monitor Cache Performance

Track cache hits and misses in application metrics. A minimal counter:

```typescript
let hits = 0
let misses = 0

function record(isHit: boolean): void {
  if (isHit) hits++
  else misses++
}

function hitRate(): number {
  const total = hits + misses
  return total === 0 ? 0 : (hits / total) * 100
}
```

For production, forward these counts to your observability stack (OpenTelemetry, Datadog, Vercel Observability) rather than keeping them in process memory.

### 6. Handle Cache Failures Gracefully

```typescript
try {
  const cachedData = await cache.get(key)
  if (cachedData) return cachedData
} catch (error) {
  // Cache failure - fetch fresh
  console.warn('Cache read failed:', error)
}

const freshData = await fetchFresh()
return freshData
```

## Benchmarking

No dedicated cache benchmark runner ships in this repo today (`scripts/performance/benchmark-cache.ts` and the `pnpm benchmark:cache*` commands described in earlier drafts of this doc were never built). The one benchmark that exists is `packages/cache/src/__tests__/benchmark-pglite-vs-map.test.ts`, which compares PGlite-backed and in-memory cache performance:

```bash
# Run the cache benchmark
pnpm --filter @revealui/cache test
```

CDN headers, cache-key generation, hit-rate simulation, query deduplication, and ISR-vs-SSR comparisons are still worth measuring manually, but there is no automated suite for any of it yet, and no measured numbers to report here.

## Troubleshooting

### High Cache Miss Rate

1. Check TTL values (too short?)
2. Verify cache key consistency
3. Review cache eviction policies
4. Monitor cache storage limits
5. Check for cache key variations

### Stale Data Issues

1. Implement cache invalidation on mutations
2. Use shorter TTLs for frequently changing data
3. Enable stale-while-revalidate
4. Add manual revalidation triggers

### Service Worker Issues

1. Check service worker registration
2. Verify cache strategies
3. Clear old caches on update
4. Test offline functionality
5. Monitor cache storage usage

## Further Reading

- [HTTP Caching (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Service Workers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [React Query Documentation](https://tanstack.com/query/latest/docs/react/overview)
- [Next.js ISR](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration)
- [Cloudflare Cache](https://developers.cloudflare.com/cache/)
