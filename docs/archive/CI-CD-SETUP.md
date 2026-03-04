# CI/CD Setup - Complete Guide

## Overview

The RevealUI project now has comprehensive CI/CD workflows set up using GitHub Actions for automated testing, building, and visual regression detection.

## Workflows

### 1. Visual Regression Tests (`.github/workflows/visual-regression.yml`)

**Triggers:**
- Pull requests to `main` or `develop`
- Pushes to `main`

**What it does:**
- Installs dependencies and Playwright browsers
- Builds necessary packages
- Runs visual snapshot tests (`pnpm test:e2e:visual:chromium`)
- Uploads test reports and visual diffs
- Comments on PRs when visual regressions are detected

**Artifacts:**
- `playwright-report`: Full HTML test report (30 days)
- `test-results`: Raw test results (7 days)
- `visual-diffs`: Visual diff images on failure (30 days)

**Features:**
- ✅ Caches pnpm dependencies for faster builds
- ✅ Caches Playwright browsers
- ✅ Automatic PR comments on test failures
- ✅ Workflow summaries in GitHub Actions
- ✅ Concurrency control (cancels in-progress runs)

### 2. Main CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:**
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`

**Jobs:**

#### Lint & Format Check
- Runs Biome linter on all code
- Checks code formatting and style

#### Unit & Integration Tests
- Runs all unit tests via `pnpm test`
- Uploads coverage reports (7 days retention)

#### Build Check
- Builds all packages
- Ensures no build errors

#### Status Check
- Aggregates all job results
- Fails if any check fails

## Local Development

### Run Visual Tests Locally

```bash
# Run visual tests
pnpm test:e2e:visual:chromium

# Update snapshots (when UI changes are intentional)
pnpm test:e2e:visual:update:chromium

# View test report
pnpm test:e2e:report

# Run in UI mode (interactive)
pnpm test:e2e:ui
```

### Run Other Tests

```bash
# Unit tests
pnpm test

# Unit tests with coverage
pnpm test:coverage

# Lint code
pnpm exec biome check .

# Build all packages
pnpm run build
```

## Pull Request Workflow

### When Creating a PR

1. **Create your feature branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes and commit:**
   ```bash
   git add .
   git commit -m "feat: Add my feature"
   ```

3. **Push and create PR:**
   ```bash
   git push origin feature/my-feature
   # Create PR on GitHub
   ```

4. **CI automatically runs:**
   - Linting
   - Unit tests
   - Build check
   - Visual regression tests

### If Visual Tests Fail

The bot will comment on your PR with details. Two scenarios:

**Scenario 1: Visual changes are intentional**
```bash
# Pull latest changes
git pull origin feature/my-feature

# Update snapshots
pnpm test:e2e:visual:update:chromium

# Commit updated snapshots
git add e2e/__snapshots__
git commit -m "test(e2e): Update visual snapshots"
git push
```

**Scenario 2: Visual changes are unintentional (bugs)**
```bash
# Fix the UI regression
# ... make fixes ...

# Commit the fix
git add .
git commit -m "fix: Correct UI regression"
git push
```

## Viewing Test Results

### In GitHub Actions

1. Go to your PR or commit
2. Click the "Actions" tab or "Checks" on the PR
3. Click on the failed workflow
4. Download artifacts:
   - **playwright-report**: View full HTML report
   - **visual-diffs**: See before/after images

### Locally

```bash
# View the HTML report
pnpm test:e2e:report

# Check test-results directory
ls test-results/

# View snapshots
ls e2e/__snapshots__/
```

## Configuration

### Timeouts

- Visual tests: 20 minutes max
- Unit tests: 15 minutes max
- Lint: 10 minutes max
- Build: 15 minutes max

### Caching

**pnpm dependencies:**
- Key: `${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}`
- Invalidated when `pnpm-lock.yaml` changes

**Playwright browsers:**
- Key: `${{ runner.os }}-playwright-${{ hashFiles('**/pnpm-lock.yaml') }}`
- Invalidated when Playwright version changes

### Concurrency

- Only one workflow run per branch
- New pushes cancel in-progress runs
- Saves CI minutes and provides faster feedback

## Troubleshooting

### "Visual tests failed but I don't see any differences"

This can happen due to:
- Font rendering differences between CI and local
- Animation timing
- Dynamic content (timestamps, etc.)

**Solution:** Adjust tolerance in `playwright.config.ts`:
```typescript
expect: {
  toHaveScreenshot: {
    maxDiffPixelRatio: 0.02, // Allow 2% difference
    threshold: 0.3, // Allow 30% color difference per pixel
  },
}
```

### "Tests pass locally but fail in CI"

- Ensure you've committed all snapshot files
- Check if Header/Footer globals exist in the database
- Verify environment variables are set correctly

### "Playwright browser cache not working"

The cache is invalidated when:
- `pnpm-lock.yaml` changes
- Playwright version is updated

This is intentional to ensure browser versions stay in sync.

## Environment Variables

For CI/CD, you may need to set these in GitHub Secrets:

```bash
# If using external services
DATABASE_URL=postgresql://...
BLOB_READ_WRITE_TOKEN=...

# If testing authenticated routes
ADMIN_EMAIL=test@example.com
ADMIN_PASSWORD=test-password-here
```

Set these at: Repository Settings → Secrets and variables → Actions

## Maintenance

### Updating Snapshots After Intentional UI Changes

```bash
# 1. Make UI changes
# 2. Update snapshots locally
pnpm test:e2e:visual:update:chromium

# 3. Review the changes
git diff e2e/__snapshots__/

# 4. Commit if correct
git add e2e/__snapshots__
git commit -m "test(e2e): Update snapshots for [feature name]"
```

### Adding New Visual Tests

1. Edit `e2e/visual-snapshots.e2e.ts`
2. Add new test case
3. Generate baseline:
   ```bash
   pnpm test:e2e:visual:update:chromium
   ```
4. Commit both test and snapshot

### Disabling Visual Tests Temporarily

If visual tests are flaky and need investigation:

```yaml
# In .github/workflows/visual-regression.yml
# Comment out or add condition:
if: false  # Temporarily disable
```

## Best Practices

✅ **DO:**
- Run tests locally before pushing
- Update snapshots when UI changes are intentional
- Review visual diffs carefully in PR artifacts
- Keep snapshots in Git (they're the baseline)
- Use descriptive commit messages for snapshot updates

❌ **DON'T:**
- Commit `-actual.png` or `-diff.png` files (they're gitignored)
- Update snapshots without reviewing changes
- Ignore failing visual tests
- Commit snapshots from failed tests

## Performance

**Current CI run times:**
- Visual Regression: ~8-10 minutes
- Unit Tests: ~5 minutes
- Lint: ~2 minutes
- Build: ~5 minutes

**Optimizations in place:**
- Dependency caching (saves ~2-3 minutes)
- Browser caching (saves ~1-2 minutes)
- Parallel job execution
- Frozen lockfile installs

## Monitoring

**Key metrics to track:**
- CI success rate
- Average run time
- Flaky test frequency
- Visual regression catch rate

GitHub provides insights at:
- Repository → Insights → Actions

## Support

If you have issues with CI/CD:

1. Check the workflow logs in GitHub Actions
2. Run tests locally to reproduce
3. Review this documentation
4. Check `docs/VISUAL-SNAPSHOTS-GUIDE.md` for visual testing details

## Summary

✅ **Automated testing on every PR**
✅ **Visual regression detection**
✅ **Automatic PR comments on failures**
✅ **Comprehensive artifact uploads**
✅ **Fast feedback with caching**
✅ **Easy snapshot updates**

Your CI/CD pipeline is production-ready! 🚀
