# Infrastructure Testing Guide

## Overview

This guide provides comprehensive testing procedures for the GitHub infrastructure improvements. Test the infrastructure systematically to ensure all components work correctly.

## Pre-Testing Checklist

### ✅ Repository Configuration
- [ ] Branch protection rules applied to `main` branch
- [ ] Required secrets configured (`VERCEL_TOKEN`, etc.)
- [ ] All workflows are present and syntactically valid

### ✅ Local Development Setup
- [ ] Node.js 24.x installed (check `.nvmrc`)
- [ ] Dependencies installed (`pnpm install`)
- [ ] All validation scripts executable

## Phase 1: Validation Scripts Testing

### Test Validation Scripts Locally

```bash
# Test workspace validation
pnpm run validate:workspace

# Test dependency validation
pnpm run validate:deps

# Test type validation (requires TypeScript)
pnpm run validate:ts
```

**Expected Results:**
- ✅ Scripts run without errors
- ✅ Clear pass/fail messages
- ✅ No missing dependencies or configuration issues

### Test Changeset Tools

```bash
# Test changeset helper
pnpm changeset:status

# Test changeset validation (if changesets exist)
pnpm changeset:version --dry-run
```

## Phase 2: Branch Protection Testing

### Manual Branch Protection Test

1. **Create Test Branch:**
   ```bash
   git checkout -b test-infrastructure
   git commit --allow-empty -m "Test infrastructure"
   git push origin test-infrastructure
   ```

2. **Create Test PR:**
   - Go to GitHub → Pull Requests → New Pull Request
   - Base: `main`, Compare: `test-infrastructure`
   - Create PR with title "Test: Infrastructure Validation"

3. **Verify Branch Protection:**
   - [ ] PR cannot be merged without approval
   - [ ] All required status checks are running
   - [ ] "Merge pull request" button is disabled
   - [ ] Security scans are executing

4. **Test Review Process:**
   - [ ] Add yourself as reviewer
   - [ ] Approve the PR
   - [ ] Verify merge is now allowed (after all checks pass)

## Phase 3: CI/CD Pipeline Testing

### Test CI Pipeline Execution

**Monitor CI Checks on Test PR:**
- [ ] `validate-config` - Should pass configuration validation
- [ ] `lint` - Should run ESLint/Biome checks
- [ ] `typecheck` - Should validate TypeScript compilation
- [ ] `test` - Should run unit tests with coverage
- [ ] `security-scan` - Should check for vulnerabilities
- [ ] `docs-verification` - Should validate documentation
- [ ] `build-cms` - Should build Next.js CMS application
- [ ] `build-web` - Should build Vite web application
- [ ] `validate-crdt` - Should validate database schema
- [ ] `integration-tests` - Should run database integration tests

**Expected Results:**
- ✅ All checks pass (green checkmarks)
- ✅ No workflow failures
- ✅ Test coverage reports generated
- ✅ Build artifacts uploaded

### Test Security Scanning

**Verify Security Checks:**
- [ ] Snyk vulnerability scan completes
- [ ] Secret scanning runs without errors
- [ ] Dependency review executes
- [ ] CodeQL analysis finishes

**Security Test Scenario:**
```bash
# Create a test file with a fake secret (remove after test)
echo "API_KEY=fake_secret_123" > test-secret.txt
git add test-secret.txt
git commit -m "Test security scanning"
git push
```

**Expected Results:**
- ⚠️ Secret scanning should flag the fake secret
- ✅ Other security checks should pass
- 🧹 Remove the test file after verification

## Phase 4: Deployment Testing

### Test Staging Deployment

**Trigger Staging Deployment:**
1. Merge the test PR to `main` branch
2. Monitor the "Performance" workflow
3. Check staging deployment job

**Verify Staging Deployment:**
- [ ] Vercel deployment succeeds
- [ ] Health checks pass
- [ ] Performance tests run against staging URL
- [ ] Staging URL is accessible

### Test Production Deployment Gates

**Verify Production Gates:**
- [ ] Staging tests must pass before production deployment
- [ ] Production deployment requires manual approval
- [ ] Production deployment uses staging artifacts
- [ ] Rollback procedures are documented

## Phase 5: Automated Verification

### Run Verification Scripts

```bash
# Verify branch protection (requires GitHub CLI)
pnpm verify:branch-protection

# Test local validation (if available)
pnpm validate:all
```

### Monitor Workflow Metrics

**Check GitHub Actions:**
- [ ] All workflows complete successfully
- [ ] No workflow timeouts or cancellations
- [ ] Reasonable execution times (< 15 minutes for CI)
- [ ] No excessive resource usage

## Test Scenarios

### Happy Path Testing
1. **Clean PR:** Create PR with no issues
   - Expected: All checks pass, mergeable after approval

2. **Code Quality Issues:** Introduce linting errors
   - Expected: `lint` check fails, blocks merge

3. **Type Errors:** Add TypeScript errors
   - Expected: `typecheck` check fails, blocks merge

4. **Test Failures:** Break existing tests
   - Expected: `test` check fails, blocks merge

### Security Testing
1. **Vulnerable Dependencies:** Add known vulnerable package
   - Expected: Security scans fail, blocks merge

2. **Secret Exposure:** Commit fake secrets
   - Expected: Secret scanning alerts, review required

### Deployment Testing
1. **Staging Success:** Clean merge triggers staging
   - Expected: Staging deploys successfully, tests pass

2. **Production Gates:** Attempt production deploy
   - Expected: Requires manual approval, uses staging results

## Troubleshooting Common Issues

### Status Checks Not Appearing
```
Problem: Required status checks don't show in branch protection
Solution: Wait 5-10 minutes after workflows run, then refresh
```

### Workflow Not Triggering
```
Problem: Workflows not running on PR
Solution: Check workflow triggers match branch names exactly
```

### Deployment Failures
```
Problem: Vercel deployment fails
Solution: Check VERCEL_TOKEN secret is configured correctly
```

### Validation Script Errors
```
Problem: Local validation scripts fail
Solution: Ensure all dependencies are installed and Node.js version matches
```

## Success Criteria

### Infrastructure Health ✅
- [ ] All workflows execute successfully
- [ ] Branch protection prevents unauthorized merges
- [ ] Security scanning blocks vulnerable code
- [ ] Deployment pipeline works end-to-end
- [ ] Validation scripts provide clear feedback

### Developer Experience ✅
- [ ] Clear error messages and guidance
- [ ] Reasonable wait times for CI checks
- [ ] Helpful documentation and troubleshooting
- [ ] No false positives in validation

### Security Posture ✅
- [ ] Zero bypassable security controls
- [ ] All code changes require review
- [ ] Security scans prevent vulnerable deployments
- [ ] Audit trail maintained for all changes

## Performance Benchmarks

### CI Pipeline Performance
- **Total CI Time:** < 15 minutes
- **Individual Job Times:**
  - `lint`: < 2 minutes
  - `typecheck`: < 3 minutes
  - `test`: < 5 minutes
  - `build-cms`: < 4 minutes
  - `build-web`: < 2 minutes

### Deployment Performance
- **Staging Deploy:** < 5 minutes
- **Production Deploy:** < 3 minutes (after approval)
- **Health Checks:** < 1 minute

## Continuous Monitoring

### Daily Checks
- [ ] Workflow success rates (> 95%)
- [ ] Average CI completion times
- [ ] Security scan results (no critical vulnerabilities)

### Weekly Reviews
- [ ] Branch protection effectiveness
- [ ] Deployment success rates
- [ ] User feedback on development experience

### Monthly Audits
- [ ] Security control effectiveness
- [ ] Performance regression detection
- [ ] Infrastructure documentation updates

---

## Quick Test Commands

```bash
# Local validation
pnpm validate:workspace
pnpm validate:deps

# Branch protection check
pnpm verify:branch-protection

# Changeset testing
pnpm changeset:status

# Full CI simulation
pnpm typecheck && pnpm lint && pnpm test
```

**Remember:** Testing infrastructure is an ongoing process. Run these tests regularly to ensure continued reliability.