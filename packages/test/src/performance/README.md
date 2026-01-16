# Authentication Performance Tests

Performance and load testing for the RevealUI authentication system.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Linux
# See https://k6.io/docs/getting-started/installation/

# Or use Docker
docker pull grafana/k6
```

## Test Scenarios

### 1. Sign-In Performance Test
Tests sign-in endpoint under normal load.

```bash
k6 run src/performance/auth-sign-in.js
```

**Targets:**
- 95% of requests < 1.5s
- < 1% error rate
- Handles 50 concurrent users

### 2. Sign-Up Performance Test
Tests sign-up endpoint under normal load.

```bash
k6 run src/performance/auth-sign-up.js
```

**Targets:**
- 95% of requests < 2s
- < 1% error rate
- Handles 20 concurrent users

### 3. Session Validation Test
Tests session validation performance.

```bash
k6 run src/performance/auth-session-validation.js
```

**Targets:**
- 95% of requests < 500ms
- < 1% error rate
- Handles 100 concurrent users

### 4. Rate Limiting Test
Tests rate limiting behavior.

```bash
k6 run src/performance/auth-rate-limiting.js
```

**Targets:**
- Rate limiting works correctly
- Legitimate users not affected
- < 10% rate limit hits

### 5. Stress Test
Finds breaking point of the system.

```bash
k6 run src/performance/auth-stress.js
```

**Targets:**
- System handles up to 300 concurrent users
- Graceful degradation under load
- < 10% error rate at peak

## Running All Tests

```bash
# From packages/test directory
pnpm test:perf:auth

# Or individually
k6 run src/performance/auth-sign-in.js
k6 run src/performance/auth-sign-up.js
k6 run src/performance/auth-session-validation.js
k6 run src/performance/auth-rate-limiting.js
k6 run src/performance/auth-stress.js
```

## Custom Base URL

```bash
k6 run -e BASE_URL=https://staging.example.com src/performance/auth-sign-in.js
```

## Performance Targets

| Endpoint | p50 | p95 | p99 | Throughput |
|----------|-----|-----|-----|------------|
| Sign-In | < 500ms | < 1.5s | < 3s | 10+ req/s |
| Sign-Up | < 800ms | < 2s | < 4s | 5+ req/s |
| Session Validation | < 100ms | < 500ms | < 1s | 50+ req/s |
| Sign-Out | < 200ms | < 500ms | < 1s | 20+ req/s |

## Analyzing Results

### Key Metrics to Review

1. **Response Time Distribution**
   - p50 (median)
   - p95 (95th percentile)
   - p99 (99th percentile)

2. **Error Rate**
   - Should be < 1% for normal load
   - < 10% acceptable for stress tests

3. **Throughput**
   - Requests per second
   - Should meet targets above

4. **Rate Limiting**
   - Verify rate limits work
   - Legitimate users not blocked

### Example Output

```
✓ status is 200
✓ has user data
✓ has session cookie
✓ response time < 2s

checks.........................: 100.00% ✓ 1000      ✗ 0
data_received..................: 500 kB  8.3 kB/s
data_sent......................: 200 kB  3.3 kB/s
http_req_duration..............: avg=450ms    min=200ms    med=400ms   max=1.5s     p(90)=800ms   p(95)=1.2s
http_req_failed................: 0.00%   ✓ 0         ✗ 1000
http_reqs......................: 1000    16.666667/s
iterations.....................: 1000    16.666667/s
vus............................: 50      min=10      max=50
```

## Continuous Performance Testing

Add to CI/CD pipeline:

```yaml
# .github/workflows/performance.yml
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
          filename: packages/test/src/performance/auth-sign-in.js
```

## Troubleshooting

### Tests Failing

1. **Check server is running**
   ```bash
   pnpm dev
   ```

2. **Check database connection**
   - Ensure `DATABASE_URL` or `POSTGRES_URL` is set
   - Database is accessible

3. **Check rate limits**
   - May need to adjust rate limit thresholds
   - Check rate limit configuration

### High Response Times

1. **Database queries**
   - Check for slow queries
   - Verify indexes exist
   - Check connection pool size

2. **Password hashing**
   - bcrypt rounds may be too high
   - Consider async hashing

3. **Network latency**
   - Test against local server
   - Check database location

## Next Steps

After running performance tests:

1. **Identify bottlenecks**
   - Review slow endpoints
   - Check database query times
   - Review rate limiting impact

2. **Optimize**
   - Add database indexes
   - Optimize queries
   - Add caching where appropriate
   - Adjust rate limits

3. **Retest**
   - Verify optimizations work
   - Confirm targets met

4. **Document**
   - Record performance baselines
   - Document optimizations made
   - Update performance targets
