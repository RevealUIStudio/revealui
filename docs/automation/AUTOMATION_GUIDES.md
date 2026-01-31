# Automation & Operations Guides

Comprehensive guides for development automation, testing, and deployment in RevealUI Framework.

## Table of Contents

1. [Auto-Start Development Guide](#auto-start-development-guide)
2. [Deployment Setup](#deployment-setup)
3. [Testing Infrastructure](#testing-infrastructure)

---

## Auto-Start Development Guide

This guide explains how the automation checks MCP server configuration and provides Ralph workflow suggestions when running `pnpm dev`.

### Overview

The RevealUI framework includes automation that:

1. **MCP configuration check** - Validates MCP server configuration when you run `pnpm dev`
2. **Ralph workflow suggestions** - Reminds you about active Ralph workflows or suggests using Ralph for complex tasks

### MCP Server Configuration Check

#### How It Works

When you run `pnpm dev`, the automation script:

1. Checks if `.cursor/mcp-config.json` exists (indicates MCP is configured)
2. Validates environment variables for each MCP server
3. Shows which servers are configured and ready

**Important**: MCP servers are managed by Cursor IDE automatically. The automation script doesn't start them - it only checks if they're configured correctly. Cursor IDE will start MCP servers when needed based on `.cursor/mcp-config.json`.

#### Configuration

**Enable Configuration Check (Default)**

By default, MCP configuration is checked if:
- `.cursor/mcp-config.json` exists (MCP is configured)
- Required environment variables are set for the servers

**Disable Configuration Check**

Set environment variable to disable:

```bash
# In .env.development.local or shell
AUTO_START_MCP=false
```

Or use the non-automated dev command:

```bash
pnpm dev:no-automation
```

#### Available MCP Servers

The automation checks for these servers and validates their configuration:

1. **Vercel** - Requires `VERCEL_API_KEY` or `VERCEL_TOKEN`
2. **Stripe** - Requires `STRIPE_SECRET_KEY`
3. **Neon** - Requires `NEON_API_KEY`
4. **Supabase** - Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY`
5. **Playwright** - No env vars required (always available)
6. **Next.js DevTools** - No env vars required (always available)

#### Starting MCP Servers

**By Cursor IDE (Recommended)**: Cursor IDE automatically starts MCP servers when needed based on `.cursor/mcp-config.json`.

**Manual Start**: Start MCP servers manually if needed:

```bash
# All servers
pnpm mcp:all

# Individual servers
pnpm mcp:vercel
pnpm mcp:stripe
# etc...
```

### Ralph Workflow Suggestions

#### How It Works

The automation script:

1. Checks if a Ralph workflow is currently active
2. If active, shows status and continuation commands
3. If not active, suggests using Ralph for complex tasks (optional)

#### Active Workflow Detection

If you have an active Ralph workflow, you'll see:

```
📋 Ralph workflow is active
   Check status: pnpm ralph:status
   Continue: pnpm ralph:continue
```

#### Suggestions

If no active workflow and suggestions are enabled, you'll see:

```
💡 Tip: Use Ralph workflow for complex, multi-iteration tasks
   Start: pnpm ralph:start "<task>" --completion-promise "DONE"
   Set AUTO_SUGGEST_RALPH=false to disable this message
```

#### Disable Suggestions

Set environment variable to disable:

```bash
# In .env.development.local or shell
AUTO_SUGGEST_RALPH=false
```

### Environment Variables

Add these to your `.env.development.local`:

```bash
# MCP Auto-Start Control
AUTO_START_MCP=true              # Enable/disable MCP auto-start (default: true if configured)
AUTO_SUGGEST_RALPH=true          # Enable/disable Ralph suggestions (default: true)

# MCP Server Configuration (required for auto-start)
VERCEL_API_KEY=your_key_here     # For Vercel MCP
STRIPE_SECRET_KEY=sk_test_...    # For Stripe MCP
NEON_API_KEY=your_key_here       # For Neon MCP
SUPABASE_URL=https://...         # For Supabase MCP
SUPABASE_ANON_KEY=your_key_here  # For Supabase MCP
```

### Usage Examples

#### Default Behavior (Auto-Start Enabled)

```bash
# Starts MCP servers automatically, shows Ralph tips
pnpm dev
```

#### Disable Auto-Start

```bash
# Set env var
export AUTO_START_MCP=false
pnpm dev

# Or use non-automated command
pnpm dev:no-automation
```

#### Disable Ralph Suggestions

```bash
# Set env var
export AUTO_SUGGEST_RALPH=false
pnpm dev
```

#### Full Control

```bash
# Disable all automation
export AUTO_START_MCP=false
export AUTO_SUGGEST_RALPH=false
pnpm dev

# Or just use the non-automated command (no suggestions shown)
pnpm dev:no-automation
```

### Troubleshooting

#### MCP Servers Not Starting

1. **Check configuration**:
   ```bash
   ls .cursor/mcp-config.json  # Should exist
   ```

2. **Check environment variables**:
   ```bash
   # Verify required vars are set
   echo $VERCEL_API_KEY
   echo $STRIPE_SECRET_KEY
   # etc...
   ```

3. **Manual start** (to see errors):
   ```bash
   pnpm mcp:all
   ```

#### Automation Script Failing

The automation script is designed to **never block** `pnpm dev` startup. If automation fails, you'll see a warning but dev will still start.

To debug:
```bash
# Run automation script directly
tsx scripts/automation/auto-start-dev.ts
```

#### MCP Servers Already Running

If MCP servers are already running from a previous session, starting them again is safe. The MCP protocol handles multiple instances gracefully (they'll connect to the same servers).

### Best Practices

1. **Enable auto-start by default** - It's convenient and doesn't interfere if you don't need it
2. **Use Ralph workflow suggestions** - Helps you discover the feature for complex tasks
3. **Set env vars in `.env.development.local`** - Keeps configuration persistent
4. **Check MCP status manually** if needed:
   ```bash
   # See what servers are configured
   cat .cursor/mcp-config.json
   ```

### Related Commands

- `pnpm dev` - Start dev with automation (default)
- `pnpm dev:no-automation` - Start dev without automation
- `pnpm mcp:all` - Start all MCP servers manually
- `pnpm ralph:start` - Start a Ralph workflow
- `pnpm ralph:status` - Check Ralph workflow status

### Implementation Details

The automation script (`scripts/automation/auto-start-dev.ts`) runs before `turbo run dev` and:

1. Checks for Ralph workflows
2. Validates MCP configuration
3. Starts MCP servers in background (non-blocking)
4. Provides helpful tips and status messages

All automation is **non-blocking** - if it fails, `pnpm dev` will still start normally.

---

## Deployment Setup

### Overview

RevealUI uses Vercel for both staging and production deployments. This document covers the setup and configuration for automated deployments.

### Environments

#### Staging Environment
- **Trigger**: Automatic on pushes to `main` branch
- **Purpose**: Performance testing and validation
- **URL**: Auto-generated Vercel deployment URL (e.g., `https://revealui-xyz.vercel.app`)
- **Retention**: Deployments are temporary and may be cleaned up by Vercel

#### Production Environment
- **Trigger**: Manual approval after staging validation
- **Purpose**: Live user-facing application
- **URL**: Production domain (configured in Vercel)
- **Retention**: Permanent deployments with rollback capability

### Required Secrets

Add these secrets to your GitHub repository:

#### Vercel Integration
```
VERCEL_TOKEN          # Vercel API token for deployments
VERCEL_PROJECT_ID     # Optional: Project ID for advanced Vercel features
VERCEL_ORG_ID         # Optional: Organization ID for team deployments
```

#### Environment Variables
```
STAGING_URL           # Base URL for staging performance tests
PRODUCTION_URL        # Production domain URL
```

### Vercel Configuration

#### Project Setup
1. Connect your GitHub repository to Vercel
2. Configure build settings:
   - **Framework**: Next.js (for CMS) + Static (for Web)
   - **Build Command**: `pnpm build:packages && pnpm build`
   - **Output Directory**: Auto-detected from `vercel.json`
   - **Install Command**: `pnpm install --frozen-lockfile`

#### Domain Configuration
- **Staging**: Uses Vercel's auto-generated URLs
- **Production**: Configure your custom domain in Vercel dashboard

### Deployment Workflow

#### Automatic Staging Deployment
1. **Trigger**: Push to `main` branch or manual workflow dispatch
2. **Build**: Packages and applications are built
3. **Deploy**: Pushed to Vercel staging
4. **Test**: Performance tests run against staging URL
5. **Gate**: Results determine production deployment readiness

#### Manual Production Deployment
1. **Trigger**: Manual workflow dispatch after staging approval
2. **Validation**: Requires staging URL input
3. **Deploy**: Production deployment to custom domain
4. **Verification**: Smoke tests and health checks
5. **Monitoring**: Deployment status and rollback plan

### Troubleshooting

#### Common Issues

**Vercel CLI Authentication**
```
Error: No authorization token was found
```
**Solution**: Ensure `VERCEL_TOKEN` secret is properly set

**Build Failures**
```
Error: Build failed due to missing dependencies
```
**Solution**: Check that `pnpm install` completed successfully

**Domain Configuration**
```
Error: Domain not configured
```
**Solution**: Configure custom domain in Vercel dashboard

#### Rollback Procedures

**Emergency Rollback**
1. Go to Vercel Dashboard → Your Project → Deployments
2. Find the failing deployment
3. Click "Rollback" to revert to previous version
4. Monitor application health

**Via GitHub Actions**
1. Run "Production Deployment" workflow with `force_deploy: true`
2. Select a previous working deployment
3. Monitor rollback completion

### Monitoring

#### Health Checks
- **Staging**: Automatic health checks during deployment
- **Production**: Smoke tests after deployment completion

#### Performance Monitoring
- **Lighthouse**: Automated performance scoring
- **Load Testing**: Response time and throughput validation
- **Regression Detection**: Performance baseline comparisons

### Security Considerations

- **Secrets Management**: All Vercel tokens stored as GitHub secrets
- **Environment Isolation**: Staging and production use separate environments
- **Access Control**: Production deployments require manual approval
- **Audit Trail**: All deployments logged in GitHub Actions and Vercel

### Cost Optimization

- **Staging Cleanup**: Vercel automatically removes old staging deployments
- **Production Optimization**: Use Vercel Analytics to monitor usage
- **Build Caching**: GitHub Actions caching reduces build times

### Support

For deployment issues:
1. Check Vercel dashboard for deployment logs
2. Review GitHub Actions workflow runs
3. Check environment variables and secrets
4. Contact DevOps team for assistance

---

## Testing Infrastructure

### Overview

This guide provides comprehensive testing procedures for the GitHub infrastructure improvements. Test the infrastructure systematically to ensure all components work correctly.

### Pre-Testing Checklist

#### Repository Configuration
- [ ] Branch protection rules applied to `main` branch
- [ ] Required secrets configured (`VERCEL_TOKEN`, etc.)
- [ ] All workflows are present and syntactically valid

#### Local Development Setup
- [ ] Node.js 24.x installed (check `.nvmrc`)
- [ ] Dependencies installed (`pnpm install`)
- [ ] All validation scripts executable

### Phase 1: Validation Scripts Testing

#### Test Validation Scripts Locally

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

#### Test Changeset Tools

```bash
# Test changeset helper
pnpm changeset:status

# Test changeset validation (if changesets exist)
pnpm changeset:version --dry-run
```

### Phase 2: Branch Protection Testing

#### Manual Branch Protection Test

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

### Phase 3: CI/CD Pipeline Testing

#### Test CI Pipeline Execution

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

#### Test Security Scanning

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

### Phase 4: Deployment Testing

#### Test Staging Deployment

**Trigger Staging Deployment:**
1. Merge the test PR to `main` branch
2. Monitor the "Performance" workflow
3. Check staging deployment job

**Verify Staging Deployment:**
- [ ] Vercel deployment succeeds
- [ ] Health checks pass
- [ ] Performance tests run against staging URL
- [ ] Staging URL is accessible

#### Test Production Deployment Gates

**Verify Production Gates:**
- [ ] Staging tests must pass before production deployment
- [ ] Production deployment requires manual approval
- [ ] Production deployment uses staging artifacts
- [ ] Rollback procedures are documented

### Phase 5: Automated Verification

#### Run Verification Scripts

```bash
# Verify branch protection (requires GitHub CLI)
pnpm verify:branch-protection

# Test local validation (if available)
pnpm validate:all
```

#### Monitor Workflow Metrics

**Check GitHub Actions:**
- [ ] All workflows complete successfully
- [ ] No workflow timeouts or cancellations
- [ ] Reasonable execution times (< 15 minutes for CI)
- [ ] No excessive resource usage

### Test Scenarios

#### Happy Path Testing
1. **Clean PR:** Create PR with no issues
   - Expected: All checks pass, mergeable after approval

2. **Code Quality Issues:** Introduce linting errors
   - Expected: `lint` check fails, blocks merge

3. **Type Errors:** Add TypeScript errors
   - Expected: `typecheck` check fails, blocks merge

4. **Test Failures:** Break existing tests
   - Expected: `test` check fails, blocks merge

#### Security Testing
1. **Vulnerable Dependencies:** Add known vulnerable package
   - Expected: Security scans fail, blocks merge

2. **Secret Exposure:** Commit fake secrets
   - Expected: Secret scanning alerts, review required

#### Deployment Testing
1. **Staging Success:** Clean merge triggers staging
   - Expected: Staging deploys successfully, tests pass

2. **Production Gates:** Attempt production deploy
   - Expected: Requires manual approval, uses staging results

### Troubleshooting Common Issues

#### Status Checks Not Appearing
```
Problem: Required status checks don't show in branch protection
Solution: Wait 5-10 minutes after workflows run, then refresh
```

#### Workflow Not Triggering
```
Problem: Workflows not running on PR
Solution: Check workflow triggers match branch names exactly
```

#### Deployment Failures
```
Problem: Vercel deployment fails
Solution: Check VERCEL_TOKEN secret is configured correctly
```

#### Validation Script Errors
```
Problem: Local validation scripts fail
Solution: Ensure all dependencies are installed and Node.js version matches
```

### Success Criteria

#### Infrastructure Health
- [ ] All workflows execute successfully
- [ ] Branch protection prevents unauthorized merges
- [ ] Security scanning blocks vulnerable code
- [ ] Deployment pipeline works end-to-end
- [ ] Validation scripts provide clear feedback

#### Developer Experience
- [ ] Clear error messages and guidance
- [ ] Reasonable wait times for CI checks
- [ ] Helpful documentation and troubleshooting
- [ ] No false positives in validation

#### Security Posture
- [ ] Zero bypassable security controls
- [ ] All code changes require review
- [ ] Security scans prevent vulnerable deployments
- [ ] Audit trail maintained for all changes

### Performance Benchmarks

#### CI Pipeline Performance
- **Total CI Time:** < 15 minutes
- **Individual Job Times:**
  - `lint`: < 2 minutes
  - `typecheck`: < 3 minutes
  - `test`: < 5 minutes
  - `build-cms`: < 4 minutes
  - `build-web`: < 2 minutes

#### Deployment Performance
- **Staging Deploy:** < 5 minutes
- **Production Deploy:** < 3 minutes (after approval)
- **Health Checks:** < 1 minute

### Continuous Monitoring

#### Daily Checks
- [ ] Workflow success rates (> 95%)
- [ ] Average CI completion times
- [ ] Security scan results (no critical vulnerabilities)

#### Weekly Reviews
- [ ] Branch protection effectiveness
- [ ] Deployment success rates
- [ ] User feedback on development experience

#### Monthly Audits
- [ ] Security control effectiveness
- [ ] Performance regression detection
- [ ] Infrastructure documentation updates

### Quick Test Commands

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

---

## Related Documentation

- [Agents Guide](./AGENTS.md) - AI agent capabilities and workflows
- [Integrations Guide](./INTEGRATIONS.md) - Claude Code, Ralph, and Brutal Honesty
- [Automation Boundaries](./AUTOMATION_BOUNDARIES.md) - What works vs. what requires manual intervention
- [Branch Protection Setup](./BRANCH_PROTECTION_SETUP.md) - Security controls and enforcement
- [Cohesion Engine](./COHESION.md) - Code quality analysis and improvement

**Last Updated**: January 2026
