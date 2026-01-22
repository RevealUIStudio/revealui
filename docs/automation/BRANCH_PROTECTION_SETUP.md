# Branch Protection Setup Guide

## Overview

Branch protection rules are **critical security controls** that prevent unauthorized code changes from reaching the main branch. Without these rules, all CI/CD security measures are bypassed.

## Critical Security Impact

**Without Branch Protection:**
- ❌ PRs can be merged without reviews
- ❌ Failing CI checks are ignored
- ❌ Security vulnerabilities bypass validation
- ❌ Code quality standards unenforced

**With Branch Protection:**
- ✅ All changes require code review
- ✅ CI/CD pipelines must pass
- ✅ Security scans block vulnerable code
- ✅ Quality gates enforced automatically

## Required Branch Protection Rules

### Target Branch: `main`

#### Require Pull Request Reviews
```
Required approving reviews: 1
Dismiss stale pull request approvals: true
Require review from Code Owners: false
Restrict push access: true
Allow force pushes: false
Allow deletions: false
```

#### Require Status Checks
**Required status checks before merging:**
- `validate-config` (CI)
- `lint` (CI)
- `typecheck` (CI)
- `test` (CI)
- `security-scan` (CI)
- `docs-verification` (CI)
- `build-cms` (CI)
- `build-web` (CI)
- `validate-crdt` (CI)
- `integration-tests` (CI)
- `snyk-security` (Security Scanning)
- `secret-scanning` (Security Scanning)
- `dependency-review` (Security Scanning)
- `codeql-analysis` (Security Scanning)

#### Additional Settings
```
Require branches to be up to date: true
Restrict who can dismiss pull request reviews: [Repository administrators only]
Include administrators: true
```

## Implementation Steps

### Option 1: GitHub UI Configuration (Recommended)

1. **Navigate to Repository Settings:**
   - Go to your repository on GitHub
   - Click "Settings" tab
   - Click "Branches" in left sidebar

2. **Add Branch Protection Rule:**
   - Click "Add rule" button
   - Enter `main` in "Branch name pattern"
   - Configure the settings as specified above

3. **Status Check Configuration:**
   - In the "Require status checks to pass" section
   - Add each required check from the list above
   - Ensure "Require branches to be up to date" is checked

### Option 2: GitHub CLI Configuration

```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Set branch protection rules
gh api repos/{owner}/{repo}/branches/main/protection \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  --input - << EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "validate-config",
      "lint",
      "typecheck",
      "test",
      "security-scan",
      "docs-verification",
      "build-cms",
      "build-web",
      "validate-crdt",
      "integration-tests",
      "snyk-security",
      "secret-scanning",
      "dependency-review",
      "codeql-analysis"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "dismissal_restrictions": {
      "users": [],
      "teams": []
    }
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false
}
EOF
```

## Verification Steps

### Manual Verification
1. **Create a test PR** to the main branch
2. **Verify required checks** are running
3. **Attempt to merge without approval** - should be blocked
4. **Attempt to merge with failing checks** - should be blocked

### Automated Verification Script

```bash
#!/usr/bin/env node
// scripts/verify-branch-protection.mjs

import { execSync } from 'child_process';

const REPO = process.env.GITHUB_REPOSITORY || 'joshua-v-dev/RevealUI';
const BRANCH = 'main';

console.log(`🔍 Verifying branch protection for ${REPO}:${BRANCH}\n`);

try {
  // Get branch protection rules
  const cmd = `gh api repos/${REPO}/branches/${BRANCH}/protection`;
  const protection = JSON.parse(execSync(cmd, { encoding: 'utf8' }));

  console.log('✅ Branch protection is enabled\n');

  // Check required status checks
  const requiredChecks = protection.required_status_checks?.contexts || [];
  console.log(`📋 Required status checks (${requiredChecks.length}):`);
  requiredChecks.forEach(check => console.log(`   • ${check}`));

  // Verify critical checks are present
  const criticalChecks = [
    'validate-config', 'lint', 'typecheck', 'test',
    'security-scan', 'build-cms', 'build-web'
  ];

  const missingChecks = criticalChecks.filter(check =>
    !requiredChecks.includes(check)
  );

  if (missingChecks.length > 0) {
    console.error(`❌ Missing critical checks: ${missingChecks.join(', ')}`);
    process.exit(1);
  }

  // Check PR review requirements
  const reviews = protection.required_pull_request_reviews;
  if (reviews?.required_approving_review_count >= 1) {
    console.log(`✅ PR reviews required: ${reviews.required_approving_review_count}`);
  } else {
    console.error('❌ PR reviews not properly configured');
    process.exit(1);
  }

  // Check admin enforcement
  if (protection.enforce_admins?.enabled) {
    console.log('✅ Admin enforcement enabled');
  } else {
    console.warn('⚠️ Admin enforcement not enabled');
  }

  console.log('\n🎉 Branch protection verification passed!');

} catch (error) {
  console.error(`❌ Branch protection verification failed: ${error.message}`);
  console.error('\nTo fix: Configure branch protection rules in repository settings');
  process.exit(1);
}
```

## Required Status Checks Explained

### CI Pipeline Checks
- **`validate-config`**: Ensures environment configuration is valid
- **`lint`**: Code style and quality validation
- **`typecheck`**: TypeScript compilation verification
- **`test`**: Unit test execution and coverage
- **`security-scan`**: Dependency vulnerability scanning
- **`docs-verification`**: Documentation validation
- **`build-cms`**: Next.js CMS application build
- **`build-web`**: Vite web application build
- **`validate-crdt`**: Database schema validation
- **`integration-tests`**: End-to-end integration testing

### Security Scanning Checks
- **`snyk-security`**: Snyk vulnerability scanning
- **`secret-scanning`**: GitLeaks secret detection
- **`dependency-review`**: GitHub dependency review
- **`codeql-analysis`**: GitHub CodeQL security analysis

## Troubleshooting

### Status Checks Not Appearing
**Problem:** Required status checks don't show up in branch protection settings

**Solutions:**
1. **Wait for workflow runs**: Status checks only appear after workflows have run
2. **Check workflow names**: Ensure job names match exactly in branch protection
3. **Verify workflow triggers**: Ensure workflows run on pull requests to main

### PR Reviews Being Dismissed
**Problem:** Reviews are dismissed when new commits are pushed

**Solution:** This is expected behavior with "Dismiss stale reviews" enabled. Re-request review after addressing feedback.

### Administrators Can't Merge
**Problem:** Repository admins can't merge their own PRs

**Solution:** This is expected with "Include administrators" enabled. Require another admin or team member to review.

## Advanced Configuration

### Code Owners Integration
```yaml
# .github/CODEOWNERS
# Require code owner reviews for specific paths
packages/core/ @core-team
packages/security/ @security-team
```

### Branch Protection for Other Branches
Consider protecting `develop` branch with similar rules:
- Fewer required reviews (1 instead of 2)
- Same status checks
- Allow force pushes for maintainers

### Status Check Customization
For complex repositories, consider:
- **Separate check suites** for different types of validation
- **Conditional checks** based on changed files
- **External status checks** from third-party services

## Security Benefits

### Attack Vector Mitigation
- **Prevents unauthorized merges** without review
- **Blocks vulnerable code** through security scanning
- **Enforces quality standards** automatically
- **Maintains audit trail** of all changes

### Compliance Benefits
- **SOX/HIPAA**: Change approval requirements
- **GDPR**: Data protection through security scanning
- **Industry Standards**: CIS, NIST security controls

## Monitoring & Maintenance

### Regular Audits
- **Monthly**: Review branch protection effectiveness
- **Quarterly**: Update required status checks for new workflows
- **After incidents**: Verify controls prevented similar issues

### Metrics to Track
- **PR merge success rate**: Should be high with proper reviews
- **Time to merge**: Should balance speed vs. quality
- **Security incidents prevented**: Track vulnerabilities caught by scans

## Emergency Procedures

### Temporary Bypass (Rare)
In extreme circumstances, administrators can temporarily disable branch protection, but this should:
1. Be logged with justification
2. Be re-enabled immediately after
3. Trigger additional security review

### Alternative Merge Strategies
- **Squash merges**: Clean history, easier to revert
- **Rebase merges**: Linear history, preserves context
- **Merge commits**: Full history preservation

## Support

For branch protection issues:
1. Check repository settings → Branches
2. Verify workflow status in Actions tab
3. Review PR checks and required statuses
4. Contact repository administrators

---

**Remember:** Branch protection is your last line of defense. Without it, all other security measures are advisory only.