# Performance Budget Tuning

This guide explains how to tune performance budgets based on real baseline data to ensure accurate performance regression detection.

## Overview

Performance budgets define acceptable thresholds for response times and error rates. Incorrect budgets lead to:
- **False positives**: Too strict budgets cause unnecessary build failures
- **False negatives**: Too loose budgets allow performance regressions to slip through

## Process

### Step 1: Establish Baseline Data

Run performance tests multiple times to collect baseline metrics:

```bash
# Run performance tests 5-10 times to build statistical confidence
for i in {1..5}; do
  echo "Run $i/5"
  pnpm test:performance
  sleep 30  # Wait between runs
done
```

### Step 2: Analyze Baseline Data

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

### Step 3: Update Budgets

Copy the recommended budgets from the analysis output into `scripts/test/performance-regression.ts`:

```typescript
const PRODUCTION_BUDGETS = {
  'auth/auth-sign-in.js': { p95: 1688, errorRate: 0.005 }, // Based on analysis
  // ... other endpoints
}
```

### Step 4: Test Budgets

Run performance tests to verify budgets work correctly:

```bash
# Run tests to ensure they pass with new budgets
pnpm test:performance

# Run regression check
pnpm tsx scripts/test/performance-regression.ts
```

## Budget Calculation Logic

The analysis script calculates recommended budgets using:

### P95 Response Time Budget
- **Formula**: 95th percentile of observed P95 values × 1.25 (25% buffer)
- **Rationale**: Uses statistical outlier detection, adds buffer for natural variance
- **Example**: If 95th percentile of P95s is 1350ms → budget = 1688ms

### Error Rate Budget
- **Formula**: Max observed error rate × 1.1, minimum 1%
- **Rationale**: Catches any increase in errors, with small buffer
- **Example**: If max error rate is 0.5% → budget = 0.55%

## Environment-Specific Budgets

### Production Budgets
- **Strict**: Designed to catch real performance regressions
- **Buffer**: 25% above typical performance
- **Goal**: Prevent user-facing performance issues

### Staging Budgets
- **Lenient**: 50% higher P95 than production
- **Error tolerance**: 2-3x production rates
- **Goal**: Allow testing in different infrastructure while still catching major issues

## Monitoring & Updates

### Regular Review
Update budgets quarterly or when:
- Infrastructure changes (new servers, databases, networks)
- Major code changes affecting performance
- New endpoints are added
- Performance characteristics change significantly

### Automated Updates
Consider setting up automated budget updates:
```bash
# Monthly cron job to update budgets
0 2 1 * * /path/to/project/scripts/test/analyze-performance-baseline.ts > budgets-update.txt
```

## Troubleshooting

### Budgets Too Strict (False Positives)
**Symptoms**: Frequent build failures despite acceptable performance
**Solution**:
1. Run analysis: `pnpm --filter test test:perf:analyze`
2. Increase buffer in formula (try 1.4 instead of 1.25)
3. Review if infrastructure changes affected baselines

### Budgets Too Loose (Missed Regressions)
**Symptoms**: Performance degrades but tests pass
**Solution**:
1. Run analysis with fresh baseline data
2. Decrease buffer in formula (try 1.15 instead of 1.25)
3. Review actual user impact of "acceptable" degradation

### Inconsistent Results
**Symptoms**: High variance in performance metrics
**Solution**:
1. Increase sample size (run tests 10+ times)
2. Review test environment stability
3. Consider time-based testing (avoid peak hours)

## Best Practices

1. **Use Real Data**: Always base budgets on actual performance data
2. **Regular Updates**: Review budgets quarterly minimum
3. **Environment Awareness**: Different budgets for staging vs production
4. **Statistical Confidence**: Use sufficient sample sizes for reliable statistics
5. **Business Alignment**: Consider user experience impact, not just technical metrics

## Example Output

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