# Load Testing Scripts

This directory contains k6 load testing scripts for the RevealUI Framework.

## Prerequisites

Install k6:
```bash
# Windows (via Chocolatey)
choco install k6

# macOS (via Homebrew)
brew install k6

# Or download from https://k6.io/
```

## Test Scripts

### 1. Authentication Load Test (`auth-login.js`)

Tests concurrent user logins.

**Run:**
```bash
k6 run load-tests/auth-login.js
```

**With custom base URL:**
```bash
k6 run -e BASE_URL=https://staging.your-domain.com load-tests/auth-login.js
```

### 2. API Endpoint Load Test (`api-pages.js`)

Tests high traffic on public API endpoints.

**Run:**
```bash
k6 run load-tests/api-pages.js
```

### 3. Payment Processing Load Test (`payment-processing.js`)

Tests payment endpoints under load (requires authentication).

**Run:**
```bash
k6 run -e TEST_TOKEN=your_jwt_token load-tests/payment-processing.js
```

## Performance Targets

- **Authentication**: 95% of requests < 2s
- **API Endpoints**: 95% of requests < 1s
- **Payment Processing**: 95% of requests < 3s
- **Error Rate**: < 1-2% depending on endpoint

## Running All Tests

```bash
# Run all tests sequentially
for test in load-tests/*.js; do
  k6 run "$test"
done
```

## Staging Environment Testing

```bash
# Set base URL for staging
export BASE_URL=https://staging.your-domain.com

# Run tests
k6 run load-tests/auth-login.js
k6 run load-tests/api-pages.js
```

## Cloud Load Testing

For distributed load testing, use k6 Cloud:

```bash
k6 cloud load-tests/auth-login.js
```

## Analyzing Results

Key metrics to monitor:
- Response time percentiles (p50, p95, p99)
- Error rate
- Requests per second
- Virtual user performance

See `docs/LOAD-TESTING-GUIDE.md` for detailed analysis guidelines.

