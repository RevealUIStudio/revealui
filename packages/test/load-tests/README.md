# Load Testing Scripts

This directory contains k6 load testing scripts for the RevealUI Framework.

## Prerequisites

Autocannon is automatically installed via the project's package.json:
```bash
pnpm install
```

Verify installation:
```bash
npx autocannon --version
```

## Test Configuration

Load tests are configured in `endpoints.json` and organized by functional area:

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

Tests are run via the performance baseline script which uses autocannon:

```bash
# Run all performance tests
pnpm test:performance

# Run in dry-run mode (no actual requests)
DRY_RUN=true pnpm test:performance
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

Results are saved to `baseline.json` and compared against budgets in `performance-regression.ts`.

## Configuration

Test endpoints and parameters are configured in `endpoints.json`. Each endpoint specifies:
- URL and HTTP method
- Headers and request body
- Load testing parameters (connections, duration, etc.)

## CI/CD Integration

Performance tests run automatically in:
- `.github/workflows/performance-tests.yml` (PR validation)
- `.github/workflows/staging-performance.yml` (staging deployment validation)

Tests fail if performance degrades beyond budget thresholds.

