# Manual Branch Protection Setup

Since the automated script requires GitHub CLI authentication, here's the manual setup process:

## Step 1: Authenticate GitHub CLI (if needed)
```bash
gh auth login
# Follow prompts to authenticate
```

## Step 2: Manual Setup via GitHub UI

### Navigate to Repository Settings
1. Go to your repository: `https://github.com/joshua-v-dev/RevealUI`
2. Click **"Settings"** tab
3. Click **"Branches"** in the left sidebar
4. Click **"Add rule"** button

### Configure Branch Protection Rule
- **Branch name pattern**: `main`
- Check **"Require a pull request before merging"**
- Check **"Require approvals"**
  - **Required number of approvals**: `1`
- Check **"Dismiss stale pull request approvals when new commits are pushed"**
- Check **"Require review from Code Owners"**: Leave unchecked
- Check **"Restrict who can dismiss pull request reviews"**
  - Select: "Repository administrators"
- Check **"Allow force pushes"**: Leave unchecked
- Check **"Allow deletions"**: Leave unchecked

### Required Status Checks
Under **"Require status checks to pass before merging"**:
- Check **"Require branches to be up to date before merging"**
- Add these status checks:

```
validate-config
lint
typecheck
test
security-scan
docs-verification
build-cms
build-web
validate-crdt
integration-tests
snyk-security
secret-scanning
dependency-review
codeql-analysis
```

### Include Administrators
- Check **"Include administrators"**
- This ensures rules apply to repository admins too

## Step 3: Verify Setup

After applying the rules, create a test PR to verify:
1. PR cannot be merged without approval
2. All status checks must pass
3. Security scans block if vulnerabilities found

## Alternative: Use GitHub CLI (if authenticated)

```bash
# If you have proper authentication, run:
pnpm setup:branch-protection

# Or manually with gh:
gh api repos/joshua-v-dev/RevealUI/branches/main/protection \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks.strict=true \
  -f required_status_checks.contexts='["validate-config","lint","typecheck","test","security-scan","docs-verification","build-cms","build-web","validate-crdt","integration-tests","snyk-security","secret-scanning","dependency-review","codeql-analysis"]' \
  -f enforce_admins=true \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f required_pull_request_reviews.dismiss_stale_reviews=true \
  -f restrictions=null \
  -f allow_force_pushes=false \
  -f allow_deletions=false
```

## Troubleshooting

### Status Checks Not Appearing
**Problem**: Required status checks don't show up in the dropdown
**Solution**: Wait 5-10 minutes after workflows run, or push a commit to trigger them

### Repository Not Found
**Problem**: `gh` commands return "Not Found"
**Solution**:
1. Verify repository name: `gh repo view`
2. Check if repository is private and you have access
3. Re-authenticate: `gh auth refresh`

### Permission Denied
**Problem**: Need admin access for branch protection
**Solution**: Ensure you have admin/owner permissions on the repository