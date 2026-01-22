# 🚨 CRITICAL: Tune Performance Budgets Now

## Prerequisites

### Install k6 (Required for Performance Testing)

Performance tests require k6 to be installed:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install k6

# Or install manually:
curl -L https://github.com/grafana/k6/releases/latest/download/k6-v0.54.0-linux-amd64.tar.gz | tar -xz
sudo mv k6-v0.54.0-linux-amd64/k6 /usr/local/bin/

# Verify installation
k6 version
```

### Alternative: Dry Run Mode

Test the script logic without k6 installed:

```bash
# Dry run mode (uses mock data)
pnpm test:performance:dry-run
```

## Why This Matters

Your performance testing system is now **functional but potentially inaccurate**. The current budgets are **educated guesses** that may cause:

- **❌ False alarms**: Builds fail when performance is actually fine
- **❌ Missed issues**: Real performance regressions slip through undetected

**Without proper budget tuning, your entire performance safety system is suspect.**

## Immediate Action Required

### Step 1: Generate Baseline Data (5-10 runs)
```bash
# Run performance tests multiple times to build statistical confidence
for i in {1..5}; do
  echo "=== Run $i/5 ==="
  pnpm test:performance
  sleep 30  # Wait between runs to avoid interference
done

# Or use dry-run mode if k6 is not installed:
for i in {1..5}; do
  echo "=== Dry Run $i/5 ==="
  pnpm test:performance:dry-run
  sleep 5
done
```

### Step 2: Analyze & Tune Budgets
```bash
# Analyze the baseline data and get recommended budgets
pnpm test:performance:analyze
```

### Step 3: Update Budgets
Copy the recommended values from the analysis output into:
- `scripts/test/performance-regression.ts` (PRODUCTION_BUDGETS and STAGING_BUDGETS)

### Step 4: Verify
```bash
# Test that budgets work correctly
pnpm test:performance
pnpm tsx scripts/test/performance-regression.ts
```

## What You'll Get

**Before Tuning** (current):
- Auth sign-in: 1.5s p95 (guess)
- API pages: 1s p95 (guess)
- Error rates: 1% (guess)

**After Tuning** (data-driven):
- Auth sign-in: 1.7s p95 (based on 95th percentile + 25% buffer)
- API pages: 1.2s p95 (based on real data)
- Error rates: 0.6% (based on actual observed maximums)

## Impact

✅ **Accurate regression detection** - No more false positives or negatives
✅ **Reliable CI** - Builds fail only on real performance issues
✅ **Staging protection** - Deployments blocked only when warranted
✅ **Data-driven decisions** - Budgets based on statistical analysis

## Time Estimate: 15-30 minutes

This is the **highest-leverage improvement** you can make to your performance testing system. Don't deploy with guesswork budgets!

---

**Quick Start:**
```bash
# Generate baseline data (run this 5 times)
pnpm test:performance

# Analyze and update budgets
pnpm test:performance:analyze
```

See `docs/development/performance/PERFORMANCE_BUDGET_TUNING.md` for detailed instructions.