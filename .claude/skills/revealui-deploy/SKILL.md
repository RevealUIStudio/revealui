---
name: revealui-deploy
description: |
  RevealUI deployment guide — Vercel configuration, GitHub Actions deploy workflow,
  secret management, domain aliasing, and troubleshooting. Invoke when working on
  deploy.yml, vercel.json, deployment secrets, domain configuration, or debugging
  deploy failures.
---

# RevealUI Deploy

## Architecture

RevealUI deploys 5 apps via GitHub Actions to Vercel. Vercel Git Integration is DISABLED — all deploys go through `.github/workflows/deploy.yml`. Only `test` and `main` branches trigger deploys; `develop` is local-only.

### Branch-to-Environment Mapping

| Branch | Environment | Domain Pattern |
|--------|------------|----------------|
| `main` | production | `*.revealui.com` |
| `test` | test | `test.*.revealui.com` |

`develop` and `feature/*` branches do NOT deploy. Development is local-only.

### App Matrix

| App | Vercel Project ID | Prod Domain | Test Domain |
|-----|------------------|-------------|-------------|
| api | `prj_zk6EQijYXwd9L7BccuBssi436ktM` | api.revealui.com | test.api.revealui.com |
| cms | `prj_7sEFDg4MH6C26nJPjrukK86QdwfG` | cms.revealui.com | test.cms.revealui.com |
| marketing | `prj_frTIYlnONVPLNIjKnQpINiGb5lm0` | revealui.com | test.revealui.com |
| docs | `prj_OPwr0FrgcK17AOBCyoj4JIilJ9S1` | docs.revealui.com | test.docs.revealui.com |
| revealcoin | `prj_XDiPXngciRytGA8j0vNIDz7hENRM` | revealcoin.revealui.com | test.revealcoin.revealui.com |

## GitHub Actions Secrets

| Secret | Source | Purpose |
|--------|--------|---------|
| `VERCEL_TOKEN` | vercel.com/account/tokens | API token for Vercel CLI |
| `VERCEL_ORG_ID` | Vercel dashboard > Settings > General > Team ID | Team/org identifier (format: `team_...`) |
| `TURBO_TOKEN` | Vercel remote cache token | Turborepo remote caching (optional) |

GitHub Actions variable (not secret):

| Variable | Value | Purpose |
|----------|-------|---------|
| `TURBO_TEAM` | `revealuistudio` | Turborepo team slug |

## Creating/Rotating VERCEL_TOKEN

1. Go to **vercel.com/account/tokens** (must be logged into the RevealUIStudio account)
2. Create token:
   - **Name**: `revealui-github-actions-deploy`
   - **Scope**: Full Account (covers all projects)
   - **Expiration**: No expiration or 1 year
3. Copy the token immediately (shown only once)
4. Set in GitHub:
   ```bash
   # Write to file to avoid shell quoting issues
   echo -n 'PASTE_TOKEN_HERE' > /tmp/vt.txt
   gh secret set VERCEL_TOKEN < /tmp/vt.txt
   rm /tmp/vt.txt
   ```
5. Verify locally before deploying:
   ```bash
   vercel whoami --token 'PASTE_TOKEN_HERE'
   # Should return: revealuistudio
   ```

### Setting VERCEL_ORG_ID

Find Team ID in Vercel dashboard under Settings > General, or:
```bash
vercel team ls --token 'YOUR_TOKEN'
```
The ID column shows the team ID (format: `team_...`).

```bash
gh secret set VERCEL_ORG_ID --body 'team_XXXXX'
```

## Deploy Workflow

File: `.github/workflows/deploy.yml`

### Flow
1. **Resolve** — determines environment from branch name
2. **Deploy** — 5 apps in parallel via matrix strategy:
   - `vercel pull` — fetches env vars and project settings
   - `vercel build` — builds with Vercel's build system
   - `vercel deploy --prebuilt` — deploys build output
   - `vercel alias` — aliases to stable custom domain (non-production only)
3. **Smoke test** — health checks on production/test (API + CMS)
4. **Summary** — structured JSON output

### Token Passing

The `--token` flag MUST be passed explicitly to every `vercel` command. The Vercel CLI does NOT reliably read `VERCEL_TOKEN` from the environment in GitHub Actions CI.

Use double-quoted interpolation to prevent shell mangling:
```yaml
run: vercel pull --yes --token="${{ secrets.VERCEL_TOKEN }}"
```

**Never use** unquoted interpolation:
```yaml
# BAD — shell can mangle the token
run: vercel pull --token=${{ secrets.VERCEL_TOKEN }}
```

### Lockfile Policy

All CI branches (`main`/`test`) use `--frozen-lockfile` (strict, supply chain protection). `develop` is local-only and has no CI lockfile policy.

## Troubleshooting

### "The token provided via --token argument is not valid"

1. Verify token works locally: `vercel whoami --token 'TOKEN'`
2. If local works but CI doesn't — the stored secret is corrupted. Re-set via file:
   ```bash
   echo -n 'TOKEN' > /tmp/vt.txt
   gh secret set VERCEL_TOKEN < /tmp/vt.txt
   rm /tmp/vt.txt
   ```
3. If local also fails — token is expired or wrong scope. Create a new one.

### "No existing credentials found"

The `--token` flag is missing from the `vercel` command. Every `vercel pull`, `vercel build`, `vercel deploy`, and `vercel alias` call needs `--token="${{ secrets.VERCEL_TOKEN }}"`.

### "No Project found"

`VERCEL_PROJECT_ID` doesn't match any project in the org. Verify the project ID in the Vercel dashboard under Project Settings > General.

### "Could not find org"

`VERCEL_ORG_ID` is wrong. Get the correct team ID from Vercel dashboard or `vercel team ls`.

### Deploy succeeds but domain not updating

Non-production deploys need the `vercel alias` step. Check that:
- The alias step's `if` condition matches the environment
- `--scope` uses the correct org ID
- The domain is configured in the Vercel project's domain settings

## Manual Deploy (emergency)

```bash
cd ~/projects/RevealUI

# Deploy single app to preview
VERCEL_PROJECT_ID=prj_XXX vercel pull --yes --environment=preview --token='TOKEN'
VERCEL_PROJECT_ID=prj_XXX vercel build --token='TOKEN'
VERCEL_PROJECT_ID=prj_XXX vercel deploy --prebuilt --token='TOKEN'

# Deploy to production
VERCEL_PROJECT_ID=prj_XXX vercel pull --yes --environment=production --token='TOKEN'
VERCEL_PROJECT_ID=prj_XXX vercel build --prod --token='TOKEN'
VERCEL_PROJECT_ID=prj_XXX vercel deploy --prebuilt --prod --token='TOKEN'
```

## Related Files

- `.github/workflows/deploy.yml` — deploy workflow
- `.github/workflows/ci.yml` — CI checks (must pass before deploy)
- `apps/*/vercel.json` — per-app Vercel configuration (if any)

## Rules

1. **Never trigger deploys casually** — one attempt, then wait. Let git push handle it.
2. **Never skip CI** — deploy workflow runs alongside CI, but broken builds should not deploy.
3. **Production deploys require `main` branch** — no manual `--prod` deploys from feature branches.
4. **Credential rotation** — when rotating VERCEL_TOKEN, test locally first, then set in GitHub.
5. **Domain changes** — update both the Vercel project domain settings AND the deploy workflow matrix.
