---
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

### 4. Baseline and Regression Scripts

Located in `scripts/test/`:
- `performance-baseline.ts` - Record baseline performance metrics
- `performance-regression.ts` - Compare current vs baseline metrics

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

### Analyze Performance

```bash
# Analyze auth performance metrics
tsx scripts/performance/analyze-auth-performance.ts

# Analyze baseline data
pnpm --filter test test:perf:analyze
```

## Performance Budgets

### Overview

Performance budgets define acceptable thresholds for response times and error rates. Incorrect budgets lead to:
- **False positives**: Too strict budgets cause unnecessary build failures
- **False negatives**: Too loose budgets allow performance regressions to slip through

### Establishing Performance Budgets

#### Step 1: Collect Baseline Data

Run performance tests multiple times to collect baseline metrics:

```bash
# Run performance tests 5-10 times to build statistical confidence
for i in {1..5}; do
  echo "Run $i/5"
  pnpm test:performance
  sleep 30  # Wait between runs
done
```

#### Step 2: Analyze Baseline Data

Use the analysis script to understand current performance characteristics:

```bash
# Analyze the collected baseline data
pnpm --filter test test:perf:analyze
```

This produces output like:
```
📊 auth/auth-sign-in.js:
   Sample Size: 5 runs
   Current P95: avg=1200ms, median=1150ms, 95th%ile=1350ms
   Error Rates: avg=0.20%, median=0.15%, max=0.50%
   Data Range: P95 1100ms - 1350ms
   Recommended Budgets: P95 ≤1688ms, Error Rate ≤0.55%
```

#### Step 3: Update Budgets

Copy the recommended budgets from the analysis output into `scripts/test/performance-regression.ts`:

```typescript
const PRODUCTION_BUDGETS = {
  'auth/auth-sign-in.js': { p95: 1688, errorRate: 0.005 }, // Based on analysis
  // ... other endpoints
}
```

#### Step 4: Test Budgets

Run performance tests to verify budgets work correctly:

```bash
# Run tests to ensure they pass with new budgets
pnpm test:performance

# Run regression check
pnpm tsx scripts/test/performance-regression.ts
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

Consider setting up automated budget updates:
```bash
# Monthly cron job to update budgets
0 2 1 * * /path/to/project/scripts/test/analyze-performance-baseline.ts > budgets-update.txt
```

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

Update the deployment step in `.github/workflows/staging-performance.yml`:

```yaml
- name: Deploy to staging
  run: |
    # Add your staging deployment commands here
    # Examples for different platforms:

    # Vercel
    npx vercel --prod=false

    # Railway
    railway deploy

    # Render
    # Configure webhook deployment

    # Docker
    docker build -t myapp:staging .
    docker push registry.example.com/myapp:staging
```

### Running Staging Tests Locally

```bash
# Run tests against staging
BASE_URL=https://staging.your-domain.com pnpm test:performance

# Check regression against production budgets
PERFORMANCE_ENV=staging pnpm tsx scripts/test/performance-regression.ts
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

Performance tests can be run in CI/CD:

```yaml
# Example workflow
- name: Run Performance Tests
  run: |
    pnpm test:performance:baseline
    pnpm test:performance:regression
```

### Continuous Performance Testing

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
1. Run analysis: `pnpm --filter test test:perf:analyze`
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

Location: `scripts/performance/benchmark-api.ts`

### Running Benchmarks

```bash
# Run all API benchmarks
pnpm benchmark:api

# Run specific benchmark
pnpm benchmark:api compression
pnpm benchmark:api caching
pnpm benchmark:api rate-limit
```

### Benchmark Suites

1. **Compression Benchmark**
   - Compare gzip vs brotli
   - Measure compression ratios at different levels
   - Test with various payload sizes

2. **Caching Benchmark**
   - Measure cache hit/miss performance
   - Test invalidation strategies
   - Compare in-memory vs database-backed

3. **Payload Optimization Benchmark**
   - Measure field selection impact
   - Test pagination performance
   - Compare offset vs cursor pagination

4. **Rate Limiting Benchmark**
   - Compare fixed window vs sliding window
   - Test token bucket performance
   - Measure overhead of rate limiting

### Example Results

```
Compression Benchmark:
  Gzip Level 6:     65% reduction, 15ms
  Brotli Level 6:   72% reduction, 18ms
  Brotli Level 11:  78% reduction, 45ms (pre-compress only)

Caching Benchmark:
  Cache Hit:        2ms avg
  Cache Miss:       150ms avg
  Hit Rate:         85%

Payload Optimization:
  Full Payload:     125KB
  Optimized:        32KB (74% reduction)
  Field Selection:  5ms overhead

Rate Limiting:
  Fixed Window:     0.3ms overhead
  Sliding Window:   0.8ms overhead
  Token Bucket:     0.5ms overhead
```

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

Location: `packages/core/src/optimization/bundle-analyzer.ts`

### Analyzing Your Bundle

```bash
# Run bundle analysis
pnpm benchmark:bundle:size

# Analyze specific app
pnpm benchmark:bundle:size -- cms
```

### Using the Bundle Analyzer

```typescript
import { analyzeBundleDirectory, generateBundleReport } from '@revealui/core/optimization/bundle-analyzer'

// Analyze build output
const stats = analyzeBundleDirectory('.next')

// Generate report
const report = generateBundleReport(stats)
console.log(report)

// Get health score
const { score, factors } = getBundleHealthScore(stats)
console.log(`Bundle Health: ${score}/100`)
```

### Bundle Health Metrics

The bundle health score (0-100) is calculated from:

1. **Bundle Size** (40% weight)
   - Excellent: <500KB
   - Good: 500KB-1MB
   - Poor: >1MB

2. **Large Files** (30% weight)
   - Files >100KB are flagged
   - Each large file reduces score by 10 points

3. **Code Splitting** (20% weight)
   - Optimal: ~10 chunks
   - Too few: Not enough splitting
   - Too many: Over-splitting overhead

4. **Dependencies** (10% weight)
   - Duplicate dependencies reduce score
   - Each duplicate -20 points

### Optimization Suggestions

The analyzer provides automatic suggestions:

```typescript
const suggestions = getOptimizationSuggestions(stats)

for (const suggestion of suggestions) {
  console.log(`${suggestion.severity}: ${suggestion.message}`)
  if (suggestion.potentialSavings) {
    console.log(`  Potential savings: ${formatSize(suggestion.potentialSavings)}`)
  }
}
```

## Code Splitting

Location: `packages/core/src/optimization/code-splitting.ts`

### Route-Based Code Splitting

```typescript
import { lazy } from 'react'

// Basic lazy loading
const HomePage = lazy(() => import('./pages/HomePage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))

// With retry logic
import { lazyWithRetry } from '@revealui/core/optimization/code-splitting'

const HomePage = lazyWithRetry(() => import('./pages/HomePage'), {
  maxRetries: 3,
  retryDelay: 1000,
})
```

### Component-Based Code Splitting

```typescript
// Split large components
const Chart = lazy(() => import('./components/Chart'))
const Modal = lazy(() => import('./components/Modal'))
const Editor = lazy(() => import('./components/Editor'))

// Use with Suspense
<Suspense fallback={<Loading />}>
  <Chart data={data} />
</Suspense>
```

### Prefetching

```typescript
import { lazyWithPrefetch } from '@revealui/core/optimization/code-splitting'

const { Component: Dashboard, prefetch } = lazyWithPrefetch(
  () => import('./pages/Dashboard')
)

// Prefetch on hover
<Link to="/dashboard" onMouseEnter={prefetch}>
  Dashboard
</Link>
```

### Load on Interaction

```typescript
import { loadOnInteraction } from '@revealui/core/optimization/code-splitting'

const buttonRef = useRef<HTMLButtonElement>(null)

useEffect(() => {
  const cleanup = loadOnInteraction(
    buttonRef.current,
    () => import('./components/Modal'),
    ['click']
  )

  return cleanup
}, [])
```

### Load on Visibility

```typescript
import { prefetchOnVisible } from '@revealui/core/optimization/code-splitting'

const elementRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const cleanup = prefetchOnVisible(
    elementRef.current,
    () => import('./components/Footer'),
    { rootMargin: '50px' }
  )

  return cleanup
}, [])
```

### Vendor Chunk Splitting

```typescript
import { VENDOR_CHUNK_CONFIGS } from '@revealui/core/optimization/code-splitting'

// Automatically splits vendors:
// - react-vendors: React, ReactDOM, React Router
// - ui-vendors: class-variance-authority, clsx
// - utils-vendors: Lodash, date-fns, classnames
// - vendors: All other node_modules
```

### Bundle Budgets

```typescript
import { checkBundleBudgets, DEFAULT_BUDGETS } from '@revealui/core/optimization/code-splitting'

const violations = checkBundleBudgets({
  totalSize: 600 * 1024,
  initialSize: 250 * 1024,
  asyncSizes: [80 * 1024, 120 * 1024],
  cssSize: 55 * 1024,
}, DEFAULT_BUDGETS)

// Default budgets:
// - maxSize: 500KB
// - maxInitialSize: 200KB
// - maxAsyncSize: 100KB
// - maxCSSSize: 50KB
```

## Asset Optimization

Location: `packages/core/src/optimization/asset-optimizer.ts`

### Image Optimization

```typescript
import { DEFAULT_IMAGE_CONFIG } from '@revealui/core/optimization/asset-optimizer'

// Next.js Image configuration
export default {
  images: {
    domains: ['cdn.example.com'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    formats: ['webp', 'avif'],
    minimumCacheTTL: 31536000, // 1 year
  },
}
```

#### Responsive Images

```typescript
import { generateSrcSet, generateSizesAttribute } from '@revealui/core/optimization/asset-optimizer'

// Generate srcset
const srcset = generateSrcSet('/image.jpg', [640, 1024, 1920])
// /image.jpg?w=640 640w, /image.jpg?w=1024 1024w, /image.jpg?w=1920 1920w

// Generate sizes attribute
const sizes = generateSizesAttribute([
  { media: '(max-width: 768px)', size: '100vw' },
  { media: '(max-width: 1200px)', size: '50vw' },
], '33vw')
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

```typescript
import { generateFontFace, generateFontPreload } from '@revealui/core/optimization/asset-optimizer'

// Generate font-face CSS
const fontFace = generateFontFace('Inter', '/fonts/inter.woff2', {
  display: 'swap',
  weights: [400, 700],
  styles: ['normal'],
})

// Preload critical fonts
const preload = generateFontPreload('/fonts/inter.woff2', 'font/woff2')
```

#### Next.js Font Optimization

```tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '700'],
  variable: '--font-inter',
})

export default function RootLayout({ children }) {
  return (
    <html className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
```

### CSS Optimization

```typescript
// Remove unused CSS
import { removeUnusedCSS } from '@revealui/core/optimization/asset-optimizer'

const optimizedCSS = removeUnusedCSS(css, usedSelectors)

// Inline critical CSS
import { inlineCriticalCSS } from '@revealui/core/optimization/asset-optimizer'

const html = inlineCriticalCSS(htmlContent, criticalCSS)
```

### SVG Optimization

```typescript
import { optimizeSVG, svgToDataURI } from '@revealui/core/optimization/asset-optimizer'

// Optimize SVG
const optimized = optimizeSVG(svgString, {
  removeComments: true,
  removeMetadata: true,
  removeDimensions: true,
})

// Convert to data URI for inlining
const dataURI = svgToDataURI(optimized)
```

### Resource Hints

```typescript
import {
  preloadCriticalAssets,
  prefetchNextPage,
  dnsPrefetch,
  preconnect,
} from '@revealui/core/optimization/asset-optimizer'

// Preload critical resources
preloadCriticalAssets([
  { href: '/fonts/inter.woff2', as: 'font', type: 'font/woff2' },
  { href: '/critical.css', as: 'style' },
])

// DNS prefetch for external domains
dnsPrefetch([
  'https://api.example.com',
  'https://cdn.example.com',
])

// Preconnect to critical origins
preconnect([
  'https://fonts.googleapis.com',
  'https://cdn.example.com',
])

// Prefetch next page
prefetchNextPage(['/about', '/contact'])
```

## Build Performance

Location: `packages/core/src/optimization/build-optimizer.ts`

### Next.js Optimization Config

```typescript
import { DEFAULT_NEXT_CONFIG } from '@revealui/core/optimization/build-optimizer'

// next.config.js
export default {
  ...DEFAULT_NEXT_CONFIG,

  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },

  swcMinify: true,
  outputFileTracing: true,

  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      'lodash',
      'date-fns',
      '@radix-ui/react-icons',
    ],
  },

  productionBrowserSourceMaps: false,
  compress: true,
}
```

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

```typescript
import { BuildProfiler } from '@revealui/core/optimization/build-optimizer'

const profiler = new BuildProfiler()

profiler.start('build')
profiler.start('compile')
// ... compilation
profiler.end('compile')
profiler.start('optimize')
// ... optimization
profiler.end('optimize')
profiler.end('build')

// Get slowest operations
const slowest = profiler.getSlowestProfiles(10)
```

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

```typescript
import { checkBundleBudgets } from '@revealui/core/optimization/code-splitting'

const violations = checkBundleBudgets(stats, budgets)

if (violations.length > 0) {
  console.error('Bundle budget violations:')
  for (const violation of violations) {
    console.error(`${violation.type}: ${formatSize(violation.exceeded)} over budget`)
  }
  process.exit(1)
}
```

### CI Integration

```yaml
# .github/workflows/bundle-check.yml
- name: Check Bundle Size
  run: |
    pnpm build
    pnpm benchmark:bundle:size
    # Fail if bundle exceeds budget
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

Location: `scripts/performance/benchmark-bundle.ts`

### Running Benchmarks

```bash
# Run all bundle benchmarks
pnpm benchmark:bundle

# Run specific benchmark
pnpm benchmark:bundle:build        # Build performance
pnpm benchmark:bundle:size         # Bundle size
pnpm benchmark:bundle:splitting    # Code splitting
pnpm benchmark:bundle:assets       # Asset optimization
pnpm benchmark:bundle:tree-shaking # Tree shaking
pnpm benchmark:bundle:compression  # Compression
```

### Benchmark Results

Example output:

```
=== Bundle Size Analysis ===

CMS Bundle:
  Total Size: 387.45 KB
  Files: 124
  Large Files: 3
  Health Score: 85/100

  Top 5 Large Files:
    vendors.js: 156.23 KB (40.3%)
    main.js: 98.76 KB (25.5%)
    react-vendors.js: 87.45 KB (22.6%)

=== Code Splitting Effectiveness ===

Chunk Analysis:
  Total Chunks: 12
  Initial Chunks: 3
  Async Chunks: 9

Size Distribution:
  Initial Load: 312.44 KB (70.5%)
  Async Chunks: 130.67 KB (29.5%)

Code Splitting Impact:
  Without splitting: 443.11 KB
  With splitting (30% async loaded): 351.64 KB
  Savings: 91.47 KB (20.6%)

=== Tree Shaking Effectiveness ===

lodash:
  Without: 71.00 KB
  With: 5.00 KB
  Savings: 66.00 KB (93.0%)
  Method: Per-method imports

Total Impact:
  Without tree shaking: 472.00 KB
  With tree shaking: 61.00 KB
  Total savings: 411.00 KB (87.1%)
```

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

1. Run bundle analyzer: `pnpm benchmark:bundle:size`
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
- **Styles**: `src/**/*.css` (for web/cms builds)
- **Assets**: `public/**` (for web/cms builds)
- **Build configs**: `vite.config.ts`, `next.config.mjs`

**Example**:
```json
{
  "cms:build": {
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

## Integration with BuildCache

This optimization complements the BuildCache utility (scripts/lib/cache.ts):

- **Turbo**: Caches task outputs across runs
- **BuildCache**: Caches build artifacts with content-based keys

Use both for maximum performance:

```typescript
import { BuildCache } from '@revealui/scripts-lib'

const cache = new BuildCache()
const key = await cache.getCacheKey(['src/**/*.ts'])

if (await cache.isCached(key)) {
  await cache.restore(key, 'dist/')
} else {
  // Build runs (Turbo may still cache this)
  await cache.save(key, 'dist/')
}
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

Location: `packages/core/src/caching/cdn-config.ts`

### Cache-Control Headers

```typescript
import { generateCacheControl, CDN_CACHE_PRESETS } from '@revealui/core/caching/cdn-config'

// Generate Cache-Control header
const cacheControl = generateCacheControl({
  maxAge: 3600,          // 1 hour client cache
  sMaxAge: 31536000,     // 1 year CDN cache
  staleWhileRevalidate: 86400,  // 1 day SWR
  public: true,
  immutable: false,
})

// Use presets
const staticCacheControl = generateCacheControl(CDN_CACHE_PRESETS.static)
```

### CDN Cache Presets

```typescript
// Immutable assets (hashed filenames)
CDN_CACHE_PRESETS.immutable
// max-age=31536000, s-maxage=31536000, public, immutable

// Static assets (images, fonts)
CDN_CACHE_PRESETS.static
// max-age=2592000, s-maxage=31536000, stale-while-revalidate=86400, public

// API responses
CDN_CACHE_PRESETS.api
// max-age=0, s-maxage=60, stale-while-revalidate=30, public

// HTML pages
CDN_CACHE_PRESETS.page
// max-age=0, s-maxage=300, stale-while-revalidate=60, public

// Private user data
CDN_CACHE_PRESETS.private
// max-age=300, private, stale-while-revalidate=60

// No caching
CDN_CACHE_PRESETS.noCache
// no-store
```

### Cache Purging

#### Purge by URL

```typescript
import { purgeCDNCache } from '@revealui/core/caching/cdn-config'

await purgeCDNCache(
  [
    'https://example.com/api/users',
    'https://example.com/about',
  ],
  {
    provider: 'cloudflare',
    apiKey: process.env.CLOUDFLARE_API_KEY,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
  }
)
```

#### Purge by Tag

```typescript
import { purgeCacheByTag, generateCacheTags } from '@revealui/core/caching/cdn-config'

// Generate tags
const tags = generateCacheTags({
  type: 'post',
  id: 123,
  related: ['user:456', 'category:tech'],
})
// ['post', 'post:123', 'user:456', 'category:tech']

// Purge by tags
await purgeCacheByTag(['post', 'user:456'], {
  provider: 'cloudflare',
  apiKey: process.env.CLOUDFLARE_API_KEY,
  zoneId: process.env.CLOUDFLARE_ZONE_ID,
})
```

#### Purge Everything

```typescript
import { purgeAllCache } from '@revealui/core/caching/cdn-config'

await purgeAllCache({
  provider: 'cloudflare',
  apiKey: process.env.CLOUDFLARE_API_KEY,
  zoneId: process.env.CLOUDFLARE_ZONE_ID,
})
```

### Cache Warming

```typescript
import { warmCDNCache } from '@revealui/core/caching/cdn-config'

const result = await warmCDNCache(
  [
    '/popular-page-1',
    '/popular-page-2',
    '/popular-page-3',
  ],
  {
    concurrency: 5,
    headers: {
      'User-Agent': 'Cache-Warmer/1.0',
    },
  }
)

console.log(`Warmed: ${result.warmed}, Failed: ${result.failed}`)
```

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

Location: `packages/core/src/caching/service-worker.ts`

### Registration

```typescript
import { registerServiceWorker } from '@revealui/core/caching/service-worker'

// Register on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    registerServiceWorker({
      scope: '/',
      scriptURL: '/sw.js',
    })
  })
}
```

### React Hook

```typescript
import { useServiceWorker } from '@revealui/core/caching/service-worker'

function App() {
  const sw = useServiceWorker()

  useEffect(() => {
    sw.register()

    return () => {
      // Cleanup if needed
    }
  }, [])

  return <div>App</div>
}
```

### Update Notification

```typescript
// Listen for service worker updates
window.addEventListener('sw-update-available', (event) => {
  const registration = event.detail.registration

  // Show update notification
  showNotification('New version available!', {
    onUpdate: async () => {
      await skipWaitingAndActivate()
    },
  })
})
```

### Cache Management

```typescript
import {
  clearAllCaches,
  clearCache,
  precacheURLs,
  getCacheSize,
} from '@revealui/core/caching/service-worker'

// Clear all caches
await clearAllCaches()

// Clear specific cache
await clearCache('static-assets-v1')

// Precache URLs
await precacheURLs([
  '/',
  '/about',
  '/contact',
  '/styles/critical.css',
  '/fonts/inter.woff2',
])

// Get cache size
const { quota, usage, available } = await getCacheSize()
console.log(`Using ${usage} of ${quota} bytes (${available} available)`)
```

### Offline Detection

```typescript
import { isOffline, onNetworkChange } from '@revealui/core/caching/service-worker'

// Check if offline
if (isOffline()) {
  showOfflineMessage()
}

// Listen for network changes
const cleanup = onNetworkChange((online) => {
  if (online) {
    hideOfflineMessage()
    syncOfflineData()
  } else {
    showOfflineMessage()
  }
})
```

## Application-Level Caching

Location: `packages/core/src/caching/app-cache.ts`

### React Query Configuration

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEFAULT_REACT_QUERY_CONFIG } from '@revealui/core/caching/app-cache'

const queryClient = new QueryClient(DEFAULT_REACT_QUERY_CONFIG)

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  )
}
```

### Cache Key Generation

```typescript
import { CacheKeyGenerator } from '@revealui/core/caching/app-cache'

const keyGen = new CacheKeyGenerator('app')

// List keys
const usersListKey = keyGen.list('users', { page: 1, limit: 20 })
// ['app', 'users', 'list', '{"page":1,"limit":20}']

// Detail keys
const userDetailKey = keyGen.detail('users', 123)
// ['app', 'users', 'detail', '123']

// Infinite query keys
const postsInfiniteKey = keyGen.infinite('posts', { category: 'tech' })
// ['app', 'posts', 'infinite', '{"category":"tech"}']

// Custom keys
const customKey = keyGen.custom('users', 'me', 'preferences')
// ['app', 'users', 'me', 'preferences']
```

### Cache Invalidation

```typescript
import { CacheInvalidator } from '@revealui/core/caching/app-cache'
import { useQueryClient } from '@tanstack/react-query'

function Component() {
  const queryClient = useQueryClient()

  const handleUpdate = () => {
    // Invalidate all user queries
    queryClient.invalidateQueries({
      queryKey: CacheInvalidator.byResource('users'),
    })

    // Invalidate specific user
    queryClient.invalidateQueries({
      queryKey: CacheInvalidator.byId('users', 123),
    })

    // Invalidate lists only
    queryClient.invalidateQueries({
      queryKey: CacheInvalidator.lists('users'),
    })
  }
}
```

### Optimistic Updates

```typescript
import { OptimisticUpdater } from '@revealui/core/caching/app-cache'
import { useMutation, useQueryClient } from '@tanstack/react-query'

function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateUserAPI,
    onMutate: async (newUser) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['app', 'users'] })

      // Snapshot previous value
      const previousUsers = queryClient.getQueryData(['app', 'users', 'list'])

      // Optimistically update
      queryClient.setQueryData(
        ['app', 'users', 'list'],
        (old) => OptimisticUpdater.updateInList(old, newUser.id, newUser)
      )

      return { previousUsers }
    },
    onError: (err, newUser, context) => {
      // Rollback on error
      queryClient.setQueryData(['app', 'users', 'list'], context.previousUsers)
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['app', 'users'] })
    },
  })
}
```

### Prefetching

```typescript
import { CachePrefetcher } from '@revealui/core/caching/app-cache'
import { useQueryClient } from '@tanstack/react-query'

function UserLink({ userId }) {
  const queryClient = useQueryClient()

  const prefetchUser = () => {
    queryClient.prefetchQuery({
      queryKey: ['app', 'users', 'detail', userId],
      queryFn: () => fetchUser(userId),
    })
  }

  // Prefetch on hover
  const hoverHandlers = CachePrefetcher.onHover(prefetchUser, 300)

  return (
    <Link to={`/users/${userId}`} {...hoverHandlers}>
      View User
    </Link>
  )
}
```

### Cache Persistence

```typescript
import { CachePersistence } from '@revealui/core/caching/app-cache'

const persistence = new CachePersistence({
  key: 'app-cache',
  storage: 'localStorage',
  version: 1,
  maxAge: 86400000, // 1 day
})

// Save to storage
await persistence.save(data)

// Load from storage
const cachedData = await persistence.load()

// Remove from storage
await persistence.remove()
```

## Edge Caching & ISR

Location: `packages/core/src/caching/edge-cache.ts`

### ISR Configuration

```typescript
// app/posts/[id]/page.tsx
export const revalidate = 3600 // 1 hour

export async function generateStaticParams() {
  const posts = await getPosts()

  return posts.map((post) => ({
    id: String(post.id),
  }))
}

export default async function Page({ params }) {
  const post = await getPost(params.id)

  return <PostDetail post={post} />
}
```

### On-Demand Revalidation

```typescript
import { revalidatePath, revalidateTag } from '@revealui/core/caching/edge-cache'

// Revalidate specific path
await revalidatePath('/posts/123', process.env.REVALIDATE_SECRET)

// Revalidate by tag
await revalidateTag('posts', process.env.REVALIDATE_SECRET)

// Revalidate multiple paths
import { revalidatePaths } from '@revealui/core/caching/edge-cache'

const result = await revalidatePaths(
  ['/posts/123', '/posts/456', '/'],
  process.env.REVALIDATE_SECRET
)

console.log(`Revalidated: ${result.revalidated}, Failed: ${result.failed}`)
```

### Edge Caching Headers

```typescript
import { setEdgeCacheHeaders } from '@revealui/core/caching/edge-cache'
import { NextResponse } from 'next/server'

export async function GET() {
  const data = await fetchData()
  const response = NextResponse.json(data)

  return setEdgeCacheHeaders(response, {
    maxAge: 0,
    sMaxAge: 300,
    staleWhileRevalidate: 60,
    tags: ['api', 'users'],
  })
}
```

### Edge Rate Limiting

```typescript
import { EdgeRateLimiter } from '@revealui/core/caching/edge-cache'
import { NextRequest, NextResponse } from 'next/server'

const rateLimiter = new EdgeRateLimiter({
  limit: 100,
  window: 60000, // 1 minute
})

export function middleware(request: NextRequest) {
  const result = rateLimiter.check(request)

  if (!result.allowed) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': new Date(result.reset).toISOString(),
      },
    })
  }

  return NextResponse.next()
}
```

### Geolocation-Based Caching

```typescript
import { getGeoLocation, getPersonalizationConfig } from '@revealui/core/caching/edge-cache'

export function middleware(request: NextRequest) {
  const geo = getGeoLocation(request)
  const personalization = getPersonalizationConfig(request)

  // Customize response based on location
  const response = NextResponse.next()

  response.headers.set('X-User-Country', geo?.country || 'unknown')
  response.headers.set('X-User-Device', personalization.device)

  return response
}
```

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

```typescript
// Prefetch on hover (300ms delay to avoid false positives)
const handlers = CachePrefetcher.onHover(prefetchFn, 300)

// Prefetch on idle
CachePrefetcher.onIdle(prefetchFn)

// Prefetch on visibility
CachePrefetcher.onVisible(element, prefetchFn)
```

### 5. Monitor Cache Performance

```typescript
import { CacheStatsTracker } from '@revealui/core/caching/app-cache'

const tracker = new CacheStatsTracker()

// Track hits and misses
if (cachedData) {
  tracker.recordHit()
} else {
  tracker.recordMiss()
}

// Get statistics
const stats = tracker.getStats()
console.log(`Hit rate: ${stats.hitRate.toFixed(1)}%`)
```

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

Location: `scripts/performance/benchmark-cache.ts`

### Running Benchmarks

```bash
# Run all cache benchmarks
pnpm benchmark:cache

# Run specific benchmark
pnpm benchmark:cache:cdn          # CDN headers
pnpm benchmark:cache:keys         # Cache key generation
pnpm benchmark:cache:optimistic   # Optimistic updates
pnpm benchmark:cache:hit-rate     # Cache hit rate simulation
pnpm benchmark:cache:dedupe       # Query deduplication
pnpm benchmark:cache:cdn-perf     # CDN vs origin performance
pnpm benchmark:cache:isr          # ISR vs SSR
pnpm benchmark:cache:storage      # Storage performance
```

### Example Results

```
=== Cache Hit Rate Simulation ===

Cache Statistics:
  Total Queries: 1000
  Cache Hits: 847
  Cache Misses: 153
  Hit Rate: 84.7%

Performance Impact:
  With cache: 25,644ms
  Without cache: 150,000ms
  Time savings: 124,356ms (82.9%)

=== ISR vs SSR Performance ===

Rendering Strategy Comparison (10,000 page views):

SSR (Server-Side Rendering):
  Generations: 10,000
  Time per generation: 150ms
  Total time: 1500.0s

ISR (Incremental Static Regeneration):
  Generations: 17
  Cached serves: 9,983
  Time per generation: 150ms
  Time per cached serve: 20ms
  Total time: 202.2s

Performance Impact:
  Time savings: 1297.8s (86.5%)
  Speedup: 7.4x
  Server load reduction: 99.8%
```

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
