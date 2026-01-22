# Staging Performance Testing

This document explains how to implement performance testing in staging environments.

## Overview

Staging performance testing ensures that performance regressions are caught before they reach production. This provides an additional safety net beyond CI testing.

## How It Works

1. **Staging Deployment**: Code is automatically deployed to staging environment
2. **Performance Tests**: Load tests are run against the staging environment
3. **Budget Comparison**: Results are compared against production performance budgets
4. **Gate Check**: Production deployment is blocked if staging performance fails

## Setup

### 1. Environment Configuration

Create `.env.staging` with your staging environment variables:

```bash
# Staging URLs
STAGING_URL=https://staging.your-domain.com
STAGING_API_URL=https://staging-api.your-domain.com

# Database
STAGING_DATABASE_URL=postgresql://user:password@staging-db-host:5432/staging_db

# Add other staging-specific variables...
```

### 2. GitHub Secrets

Add these secrets to your GitHub repository:

- `STAGING_URL`: Your staging application URL
- `STAGING_API_URL`: Your staging API URL
- `STAGING_DATABASE_URL`: Staging database connection string

### 3. Deployment Configuration

The staging workflow expects your deployment platform to be configured. Update the deployment step in `.github/workflows/staging-performance.yml`:

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

## Performance Budgets

Staging uses slightly more lenient performance budgets than production to account for:

- Different infrastructure (may be less optimized)
- Additional logging/monitoring overhead
- Network latency differences

Current staging budgets are 25-50% more lenient than production.

## Workflow

The staging performance testing workflow:

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

## Running Tests Locally

Test staging performance locally:

```bash
# Run tests against staging
BASE_URL=https://staging.your-domain.com pnpm test:performance

# Check regression against production budgets
PERFORMANCE_ENV=staging pnpm tsx scripts/test/performance-regression.ts
```

## Troubleshooting

### Staging Deployment Issues

1. **Deployment fails**: Check your deployment platform configuration
2. **Health check fails**: Ensure your staging app has a `/api/health` endpoint
3. **Database connection**: Verify staging database credentials

### Performance Test Issues

1. **Tests time out**: Increase the staging deployment wait time
2. **High error rates**: Check if staging services are running correctly
3. **Slow response times**: Staging infrastructure may be under-provisioned

## Benefits

- **Early Detection**: Catch performance issues before production
- **Real Environment**: Test against infrastructure similar to production
- **Deployment Safety**: Prevent bad deployments from reaching users
- **Confidence**: Know that production deployments maintain performance

## Next Steps

After implementing staging performance testing:

1. Monitor staging test results over time
2. Adjust performance budgets based on real data
3. Consider adding performance alerting
4. Implement gradual rollout strategies for risky changes