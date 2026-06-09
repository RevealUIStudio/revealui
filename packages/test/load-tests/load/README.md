---
title: "Load Testing Scripts"
description: "This directory contains k6 load testing scripts for the RevealUI Framework."
visibility: internal
status: verified
audience: maintainer
---

# Load Testing Scripts

This directory contains k6 load testing scripts for the RevealUI Framework.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Linux — see https://k6.io/docs/getting-started/installation/

# Or use Docker
docker pull grafana/k6
```

An `endpoints.json` file in this directory also supports autocannon-based performance
baseline testing via `pnpm test:perf:dry-run` / `pnpm test:perf:analyze`.

## Test Configuration

Load tests are k6 scripts organized by functional area. Endpoint configuration for
the autocannon baseline runner is in `endpoints.json`:

### Authentication Tests

- `auth-sign-in` - Sign-in endpoint performance
- `auth-sign-up` - Sign-up endpoint performance

### API Tests

- `api-pages` - Public API endpoints performance

### Payment Tests

- `payments-processing` - Payment processing performance (requires TEST_TOKEN)

### CMS Tests

- `cms-load` - CMS content endpoints performance

### AI Tests

- `ai-load` - AI generation endpoints performance (requires TEST_TOKEN)

## Running Tests

k6 scripts run directly or via package.json scripts:

```bash
# Run auth load tests (sign-in, sign-up, rate-limiting)
pnpm test:perf:auth

# Run individual auth tests
pnpm test:perf:auth:signin
pnpm test:perf:auth:signup
pnpm test:perf:auth:session
pnpm test:perf:auth:ratelimit
pnpm test:perf:auth:stress

# Autocannon baseline (dry-run or analyze)
DRY_RUN=true pnpm test:perf:dry-run
pnpm test:perf:analyze
```

## Performance Targets

- **Authentication**: 95% of requests < 2s
- **API Endpoints**: 95% of requests < 1s
- **Payment Processing**: 95% of requests < 3s
- **Error Rate**: < 1-2% depending on endpoint

## Running All Tests

```bash
# Run all auth load tests
pnpm test:perf:auth

# Or run individual k6 scripts manually from packages/test directory
k6 run load-tests/auth/auth-sign-in.js
k6 run load-tests/auth/auth-sign-up.js
k6 run load-tests/auth/auth-session-validation.js
k6 run load-tests/auth/auth-rate-limiting.js
k6 run load-tests/auth/auth-stress.js
```

## Environment Variables

Set these for different testing scenarios:

```bash
# Test different environments
export BASE_URL=https://staging.your-domain.com

# For authenticated endpoints
export TEST_TOKEN=your-jwt-token-here
```

## Analyzing Results

The performance baseline script outputs key metrics:
- Response time percentiles (p50, p95, p99)
- Error rate
- Requests per second
- Average latency

For autocannon baseline tests, results are saved to `baseline.json` and compared against budgets in `performance-regression.ts`.

## Configuration

Test endpoints and parameters are configured in `endpoints.json`. Each endpoint specifies:
- URL and HTTP method
- Headers and request body
- Load testing parameters (connections, duration, etc.)

## CI/CD Integration

Load tests are not currently wired into CI workflows. Run them manually against staging or local environments before major releases.

