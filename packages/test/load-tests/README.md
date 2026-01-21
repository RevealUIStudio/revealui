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

## Test Categories

Load tests are organized by functional area:

### Authentication Tests (`auth/`)

**General Load Tests:**
- `auth-login.js` - Tests concurrent user logins
- `auth-load.js` - Tests auth endpoints under load

**Performance Tests:**
- `auth-sign-in.js` - Sign-in performance testing
- `auth-sign-up.js` - Sign-up performance testing
- `auth-session-validation.js` - Session validation performance
- `auth-rate-limiting.js` - Rate limiting behavior testing
- `auth-stress.js` - Stress testing auth endpoints

**Run auth tests:**
```bash
# From packages/test directory
k6 run load-tests/auth/auth-login.js
k6 run load-tests/auth/auth-sign-in.js

# Or using pnpm scripts from project root
pnpm --filter test test:load:auth
pnpm --filter test test:perf:auth:signin
```

### API Tests (`api/`)

- `api-pages.js` - Tests high traffic on public API endpoints

**Run API tests:**
```bash
# From packages/test directory
k6 run load-tests/api/api-pages.js

# Or using pnpm script from project root
pnpm --filter test test:load:api
```

### Payment Tests (`payments/`)

- `payment-processing.js` - Tests payment endpoints under load (requires authentication)

**Run payment tests:**
```bash
# From packages/test directory
k6 run -e TEST_TOKEN=your_jwt_token load-tests/payments/payment-processing.js

# Or using pnpm script from project root
pnpm --filter test test:load:payment
```

### CMS Tests (`cms/`)

- `cms-load.js` - Tests CMS endpoints under load

**Run CMS tests:**
```bash
# From packages/test directory
k6 run load-tests/cms/cms-load.js

# Or using pnpm script from project root
pnpm --filter test test:load:cms
```

### AI Tests (`ai/`)

- `ai-load.js` - Tests AI endpoints under load

**Run AI tests:**
```bash
# From packages/test directory
k6 run load-tests/ai/ai-load.js

# Or using pnpm script from project root
pnpm --filter test test:load:ai
```

## Performance Targets

- **Authentication**: 95% of requests < 2s
- **API Endpoints**: 95% of requests < 1s
- **Payment Processing**: 95% of requests < 3s
- **Error Rate**: < 1-2% depending on endpoint

## Running All Tests

```bash
# Using pnpm script from project root (recommended)
pnpm --filter test test:load:all

# Or manually from packages/test directory
for category in load-tests/*/; do
  for test in "$category"*.js; do
    k6 run "$test"
  done
done
```

## Running Category Tests

```bash
# Run all auth tests
pnpm --filter test test:perf:auth

# Run all load tests
pnpm --filter test test:load:all
```

## Staging Environment Testing

```bash
# Set base URL for staging
export BASE_URL=https://staging.your-domain.com

# Run tests from packages/test directory
cd packages/test
k6 run load-tests/auth/auth-login.js
k6 run load-tests/api/api-pages.js
```

## Cloud Load Testing

For distributed load testing, use k6 Cloud:

```bash
# From packages/test directory
k6 cloud load-tests/auth/auth-login.js
k6 cloud load-tests/api/api-pages.js
```

## Analyzing Results

Key metrics to monitor:
- Response time percentiles (p50, p95, p99)
- Error rate
- Requests per second
- Virtual user performance

See `docs/LOAD-TESTING-GUIDE.md` for detailed analysis guidelines.

