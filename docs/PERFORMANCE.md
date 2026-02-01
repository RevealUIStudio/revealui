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
- Cache active sessions in Redis
- Reduce database lookups

#### 3. Rate Limiting
- Use Redis for distributed rate limiting
- More efficient than in-memory

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
   - In-memory vs Redis
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
