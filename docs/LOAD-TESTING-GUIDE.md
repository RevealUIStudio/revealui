---
alwaysApply: true
---

# Load Testing Guide for RevealUI Framework

## Overview

This guide outlines the load testing strategy for RevealUI Framework to ensure the system can handle expected production traffic.

---

## Load Testing Tools

### Recommended: k6

**Installation:**
```bash
# Windows (via Chocolatey)
choco install k6

# macOS (via Homebrew)
brew install k6

# Or download from https://k6.io/
```

### Alternative: Artillery

```bash
pnpm add -D artillery
```

---

## Test Scenarios

### 1. Authentication Load Test

**Scenario**: Concurrent user logins

```javascript
// load-tests/auth-login.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.01'],    // Less than 1% failures
  },
};

export default function () {
  const payload = JSON.stringify({
    email: 'test-user@example.com',
    password: 'Test1234!',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(
    'http://localhost:4000/api/users/login',
    payload,
    params
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has JWT token': (r) => JSON.parse(r.body).token !== undefined,
  });

  sleep(1);
}
```

**Run:**
```bash
k6 run load-tests/auth-login.js
```

---

### 2. API Endpoint Load Test

**Scenario**: High traffic on public API endpoints

```javascript
// load-tests/api-pages.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 100 },   // Stay at 100 users
    { duration: '1m', target: 200 },   // Spike to 200 users
    { duration: '2m', target: 200 },   // Stay at 200 users
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% under 1s
    http_req_failed: ['rate<0.05'],    // Less than 5% failures
  },
};

export default function () {
  const res = http.get('http://localhost:4000/api/pages?limit=10');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has data': (r) => JSON.parse(r.body).docs !== undefined,
  });

  sleep(Math.random() * 2); // Random sleep 0-2s
}
```

---

### 3. Payment Flow Load Test

**Scenario**: Concurrent checkout sessions

```javascript
// load-tests/checkout.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 20 },    // Ramp up to 20 concurrent checkouts
    { duration: '3m', target: 20 },    // Maintain load
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% under 3s (payment APIs slower)
    http_req_failed: ['rate<0.01'],    // Less than 1% failures
  },
};

export default function () {
  // Login first to get token
  const loginRes = http.post(
    'http://localhost:4000/api/users/login',
    JSON.stringify({
      email: 'test-user@example.com',
      password: 'Test1234!',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const token = JSON.parse(loginRes.body).token;

  // Create checkout session
  const checkoutRes = http.post(
    'http://localhost:4000/api/create-checkout-session',
    JSON.stringify({
      price: { id: 'price_test_123' },
      quantity: 1,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  check(checkoutRes, {
    'status is 200': (r) => r.status === 200,
    'has session ID': (r) => JSON.parse(r.body).sessionId !== undefined,
  });

  sleep(3);
}
```

---

### 4. Database Query Load Test

**Scenario**: Heavy read operations

```javascript
// load-tests/database-queries.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50,                    // 50 virtual users
  duration: '5m',             // Run for 5 minutes
  thresholds: {
    http_req_duration: ['p(95)<500'],   // Database queries should be fast
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Test various queries
  const queries = [
    '/api/pages?limit=10&sort=-createdAt',
    '/api/posts?where[status][equals]=published',
    '/api/products?limit=20',
    '/api/media?limit=10',
  ];

  const query = queries[Math.floor(Math.random() * queries.length)];
  const res = http.get(`http://localhost:4000${query}`);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

---

## Performance Targets

### Response Time Targets

| Endpoint Type | p50 | p95 | p99 |
|--------------|-----|-----|-----|
| Health Check | <100ms | <200ms | <500ms |
| Public APIs | <300ms | <1000ms | <2000ms |
| Auth Endpoints | <500ms | <1500ms | <3000ms |
| Payment APIs | <1000ms | <3000ms | <5000ms |

### Throughput Targets

- **Public APIs**: 100+ req/sec
- **Auth Endpoints**: 10+ req/sec
- **Webhook Processing**: 50+ req/sec

### Resource Limits

- **CPU**: < 80% under normal load
- **Memory**: < 70% of available
- **Database Connections**: < 80% of pool size

---

## Running Load Tests

### Local Environment

```bash
# Start application
pnpm dev

# In another terminal, run load test
k6 run load-tests/auth-login.js

# With output to InfluxDB (optional)
k6 run --out influxdb=http://localhost:8086/k6 load-tests/auth-login.js
```

### Staging Environment

```bash
# Update test URLs to staging
k6 run -e BASE_URL=https://staging.your-domain.com load-tests/auth-login.js

# Run all tests
for test in load-tests/*.js; do
  k6 run -e BASE_URL=https://staging.your-domain.com "$test"
done
```

### Cloud Load Testing

Use k6 Cloud for distributed load testing:

```bash
# Upload and run in cloud
k6 cloud load-tests/auth-login.js
```

---

## Analyzing Results

### Key Metrics

1. **Response Time Distribution**
   - Review p50, p95, p99 percentiles
   - Identify slow endpoints

2. **Error Rate**
   - Acceptable: < 1% error rate
   - Investigate any 5xx errors

3. **Throughput**
   - Requests per second
   - Data transferred

4. **Virtual User Performance**
   - How many concurrent users can system handle?
   - At what point does performance degrade?

### k6 Output Example

```
     ✓ status is 200
     ✓ has JWT token

     checks.........................: 100.00% ✓ 2000      ✗ 0   
     data_received..................: 1.2 MB  20 kB/s
     data_sent......................: 500 kB  8.3 kB/s
     http_req_blocked...............: avg=1.2ms    min=0s       med=0s      max=15ms     p(90)=2ms     p(95)=3ms   
     http_req_duration..............: avg=250ms    min=100ms    med=200ms   max=2s       p(90)=450ms   p(95)=850ms 
     http_req_failed................: 0.00%   ✓ 0         ✗ 1000
     http_reqs......................: 1000    16.666667/s
     iteration_duration.............: avg=1.25s    min=1.1s     med=1.2s    max=3s       p(90)=1.45s   p(95)=1.85s 
     iterations.....................: 1000    16.666667/s
     vus............................: 50      min=10      max=50
     vus_max........................: 50      min=50      max=50
```

---

## Stress Testing

### Purpose

Find the breaking point of the system.

### Stress Test Configuration

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },    // Normal load
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },    // 2x normal load
    { duration: '5m', target: 200 },
    { duration: '2m', target: 300 },    // 3x normal load
    { duration: '5m', target: 300 },
    { duration: '10m', target: 0 },     // Recovery
  ],
};
```

### What to Monitor

1. **System Resources**
   - CPU utilization
   - Memory usage
   - Database connections
   - Network bandwidth

2. **Application Metrics**
   - Response time degradation
   - Error rate increase
   - Queue depths
   - Database query times

3. **Recovery**
   - How quickly system recovers after load removed
   - Any lingering effects

---

## Soak Testing

### Purpose

Verify system stability over extended periods.

### Configuration

```javascript
export const options = {
  vus: 50,                    // Constant 50 users
  duration: '4h',             // Run for 4 hours
};
```

### What to Look For

- Memory leaks (increasing memory over time)
- Connection pool exhaustion
- Gradual performance degradation
- Resource leak indicators

---

## Load Test Scenarios

### Scenario 1: Normal Business Day

- **Users**: 100-500 concurrent
- **Duration**: 8 hours
- **Pattern**: Gradual ramp-up, steady load, evening drop-off

### Scenario 2: Marketing Campaign

- **Users**: Spike from 100 to 1000 in 10 minutes
- **Duration**: 2 hours elevated load
- **Pattern**: Sudden spike, sustained high load, gradual decrease

### Scenario 3: Black Friday / Flash Sale

- **Users**: Spike from 500 to 2000
- **Duration**: 4 hours
- **Pattern**: Extreme spike, very high load, checkout heavy

---

## Continuous Load Testing

### Integration with CI/CD

Add to `.github/workflows/performance.yml`:

```yaml
name: Performance Testing

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly, Sunday 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/k6-action@v0.3.1
        with:
          filename: load-tests/auth-login.js
          cloud: true
          token: ${{ secrets.K6_CLOUD_TOKEN }}
```

---

## Action Items After Load Testing

1. **Review Results**
   - Analyze metrics
   - Identify bottlenecks
   - Compare against targets

2. **Optimize**
   - Fix slow queries
   - Add caching where needed
   - Optimize resource usage

3. **Document Findings**
   - Record max capacity
   - Note any issues discovered
   - Update infrastructure plans

4. **Retest**
   - Verify optimizations effective
   - Confirm system meets targets

---

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Test Examples](https://k6.io/docs/examples/)
- [Artillery Documentation](https://www.artillery.io/docs)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/api-load-testing/)

---

**Last Updated**: January 16, 2025  
**Status**: Ready for Implementation

