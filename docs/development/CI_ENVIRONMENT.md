# CI/CD Environment Documentation

This document explains the CI/CD environment used by RevealUI and how it differs from local development environments.

## Overview

RevealUI uses **vanilla GitHub Actions** for CI/CD, not Nix or Docker. This is an intentional choice for simplicity, speed, and reliability.

## CI Environment Specifications

### Versions

| Tool | Version | Source |
|------|---------|--------|
| **Node.js** | 24.12.0 | `actions/setup-node@v4` |
| **pnpm** | 10.28.2 | `pnpm/action-setup@v4` |
| **PostgreSQL** | 16 (pg16) | Docker `pgvector/pgvector:pg16` |
| **pgvector** | Latest | Included in Docker image |
| **OS** | ubuntu-latest | GitHub Actions default |

### Configuration Files

**Primary CI workflow:** `.github/workflows/ci.yml`

**Key sections:**
```yaml
# Node.js setup
- uses: actions/setup-node@v4
  with:
    node-version: '24.12.0'

# pnpm setup
- uses: pnpm/action-setup@v4
  with:
    version: 10.28.2

# PostgreSQL service
services:
  postgres:
    image: pgvector/pgvector:pg16
    env:
      POSTGRES_DB: revealui
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - 5432:5432
```

## Local vs CI Comparison

| Aspect | Pure Nix (Local) | Dev Containers (Local) | Manual (Local) | CI |
|--------|------------------|------------------------|----------------|-----|
| **Node.js** | ⚠️ 22 | ✅ 24.12.0 | ✅ 24.12.0 | ✅ 24.12.0 |
| **pnpm** | ✅ 10.28.2 | ✅ 10.28.2 | ✅ 10.28.2 | ✅ 10.28.2 |
| **PostgreSQL** | ✅ 16 | ✅ 16 | ⚠️ Varies | ✅ 16 |
| **pgvector** | ✅ Yes | ✅ Yes | ⚠️ Maybe | ✅ Yes |
| **Setup method** | direnv + Nix | docker-compose | manual | GitHub Actions |
| **Database location** | `.pgdata/` | Docker volume | System | Service container |
| **Environment manager** | Nix flakes | Docker | None | GitHub Actions |
| **Build speed** | ⚡ Fast | 🐌 Slower | ⚡ Fast | ⚡ Fast (cached) |

### Parity Analysis

**✅ Close Parity:**
- pnpm version (exact match)
- PostgreSQL version (exact match)
- pgvector extension (present in both)

**⚠️ Partial Parity:**
- Node.js version (Nix: 22, Others/CI: 24.12.0)

**❌ No Parity:**
- Environment setup method (different approaches)
- Database location (not relevant to code)

## Why CI Doesn't Use Nix or Docker

### Performance

**GitHub Actions with native Node.js is faster:**
- No Nix installation overhead (~30-60s)
- No Docker build time (~1-2 minutes)
- Optimized caching with `actions/cache`
- Pre-installed tools on runners

**Benchmark (typical CI run):**
- Vanilla Actions: ~3-4 minutes
- With Nix: ~4-6 minutes (first run), ~3-4 minutes (cached)
- With Docker: ~5-7 minutes (first run), ~4-5 minutes (cached)

### Simplicity

**Standard GitHub Actions are easier to:**
- Understand (familiar YAML syntax)
- Maintain (no Nix/Docker expertise needed)
- Debug (better GitHub Actions logging)
- Customize (extensive action ecosystem)

### Reliability

**Fewer moving parts:**
- No Nix flake evaluation failures
- No Docker layer caching issues
- No container networking complexities
- Direct access to GitHub Actions features

### Caching

**GitHub's built-in caching works better:**
- `actions/cache` optimized for Actions runners
- `actions/setup-node` has built-in caching
- `pnpm/action-setup` has optimized store caching
- Faster cache restoration than Nix/Docker

## CI Workflow Stages

### 1. Setup (30-60s)

```yaml
- Checkout code
- Setup Node.js 24.12.0
- Setup pnpm 10.28.2
- Cache pnpm store
- Start PostgreSQL service
```

### 2. Install Dependencies (1-2 minutes)

```yaml
- pnpm install --frozen-lockfile
- Cache restored: ~30s
- Fresh install: ~2 minutes
```

### 3. Build (1-2 minutes)

```yaml
- pnpm build
- TypeScript compilation
- Next.js build
- Turbo cache enabled
```

### 4. Test (1-2 minutes)

```yaml
- pnpm test
- Database migrations
- Unit tests
- Integration tests
```

### 5. Lint & Type Check (30s-1 minute)

```yaml
- pnpm lint
- pnpm type-check
```

**Total CI time:** ~3-7 minutes (depending on cache hits)

## Environment Variables

### CI-Specific Variables

Set in GitHub Actions secrets/variables:

```bash
# Database (provided by service container)
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/revealui

# Node environment
NODE_ENV=test
CI=true

# Cache control
TURBO_TOKEN=${{ secrets.TURBO_TOKEN }}
TURBO_TEAM=${{ secrets.TURBO_TEAM }}
```

### Local vs CI

| Variable | Local (Nix) | Local (Docker) | CI |
|----------|-------------|----------------|-----|
| `POSTGRES_URL` | `localhost:5432` | `db:5432` | `localhost:5432` |
| `PGDATA` | `.pgdata/` | N/A (volume) | N/A (service) |
| `NODE_ENV` | `development` | `development` | `test` |
| `CI` | Not set | Not set | `true` |

## Testing Against CI Locally

### Option 1: Use Act (GitHub Actions locally)

```bash
# Install act
brew install act  # macOS
# or: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run CI locally
act push

# Run specific job
act -j test
```

**Pros:** Exact CI simulation
**Cons:** Slow, requires Docker, not all features supported

### Option 2: Use Dev Containers

Dev Containers match CI most closely (Node 24.12.0).

```bash
# Open in VS Code Dev Container
# Run commands:
pnpm install
pnpm build
pnpm test
```

**Pros:** Fast, full feature support
**Cons:** Still not exact CI environment

### Option 3: Manual Node 24 testing (Nix users)

```bash
# Exit Nix shell
exit

# Use nvm for Node 24
nvm use 24.12.0
pnpm install
pnpm test
```

**Pros:** Tests Node 24 compatibility
**Cons:** Tedious, no PostgreSQL from Nix

## Common CI Issues

### Issue: "Cannot find module" errors

**Cause:** Missing dependency in `package.json`
**Solution:** Install and commit:
```bash
pnpm add <missing-package>
git add package.json pnpm-lock.yaml
git commit -m "Add missing dependency"
```

### Issue: Tests pass locally, fail in CI

**Possible causes:**
1. **Node version difference** (Nix: 22 vs CI: 24)
2. **Environment variable missing** in CI secrets
3. **Timezone difference** (CI uses UTC)
4. **File system case sensitivity** (CI: Linux, Local: might be Mac)

**Debug:**
```bash
# Check Node version locally
node --version

# Run tests with CI environment variables
NODE_ENV=test CI=true pnpm test

# Check for case-sensitive imports
# (import './Component.tsx' vs './component.tsx')
```

### Issue: Database connection fails

**Cause:** Connection string mismatch

**Local (Nix):**
```bash
postgresql://postgres@localhost:5432/revealui
```

**CI:**
```bash
postgresql://postgres:postgres@localhost:5432/revealui
```

**Solution:** Make connection string configurable:
```typescript
const url = process.env.POSTGRES_URL || 'postgresql://postgres@localhost:5432/revealui';
```

### Issue: Build succeeds locally, fails in CI

**Possible causes:**
1. **TypeScript errors ignored locally** (strict mode difference)
2. **ESLint warnings treated as errors** in CI
3. **Different build caching** (Turbo cache)

**Solution:**
```bash
# Run with CI-like strictness
NODE_ENV=production pnpm build

# Clear Turbo cache
rm -rf .turbo
pnpm build
```

## Node.js Version Strategy

### Current State

- **CI:** Node.js 24.12.0 (target version)
- **Dev Containers:** Node.js 24.12.0 (matches CI)
- **Nix:** Node.js 22 (nixpkgs limitation)
- **Manual:** Node.js 24.12.0 (user installs)

### Why This Is Acceptable

**Node.js 22 and 24 are highly compatible:**
- Same major APIs
- No breaking changes in our use case
- RevealUI doesn't use Node 24-specific features (yet)

**CI catches Node 24 issues:**
- All PRs run tests on Node 24
- Any Node 24-specific breakage fails CI
- Team gets immediate feedback

### When to Worry

**Watch for:**
- CI tests failing with Node-specific errors
- Crypto/Buffer API differences (rare)
- Module resolution changes (rare)
- Performance characteristics (unlikely)

**If issues arise:**
1. Check CI logs for Node version-specific errors
2. Test locally on Node 24 (use Dev Containers or nvm)
3. Update code to be compatible with both versions
4. Document any version-specific workarounds

### Future Plans

**When Node.js 24 arrives in nixpkgs:**
```nix
# Update flake.nix
nodejs = pkgs.nodejs_24;  # Currently: nodejs_22
```

**Timeline:** Expected Q1-Q2 2026 (monitor nixpkgs unstable)

**Tracking:** See `flake.nix` lines 14-16 for update status

## Best Practices

### Write CI-Agnostic Code

**✅ Good:**
```typescript
// Use environment variables
const dbUrl = process.env.POSTGRES_URL;

// Detect CI environment
const isCI = process.env.CI === 'true';

// Make tests timezone-agnostic
const date = new Date().toISOString();
```

**❌ Bad:**
```typescript
// Hardcoded connection
const dbUrl = 'postgresql://postgres@localhost:5432/revealui';

// Assumes local setup
const dataDir = '.pgdata/';

// Timezone-dependent tests
expect(date).toBe('2026-01-30 08:00:00');  // Fails in UTC
```

### Test in CI Early

**Don't wait for CI to find issues:**

```bash
# Before pushing, run CI-like checks
NODE_ENV=test pnpm build
NODE_ENV=test pnpm test
pnpm lint
pnpm type-check

# Or use a pre-push hook (recommended)
```

### Keep CI Fast

**Optimization tips:**
- Use `--frozen-lockfile` (don't update lockfile in CI)
- Enable Turbo caching
- Cache pnpm store with `actions/cache`
- Only run tests on affected packages
- Use matrix builds for parallel testing

### Monitor CI Performance

**Track metrics:**
- Build time (target: <5 minutes)
- Cache hit rate (target: >80%)
- Test execution time (target: <2 minutes)
- Flaky test frequency (target: 0%)

**Tools:**
- GitHub Actions insights (built-in)
- Turbo Remote Cache analytics
- Custom timing logs in workflows

## Troubleshooting Checklist

When CI fails but local passes:

- [ ] Check Node.js version (`node --version`)
- [ ] Check environment variables (CI secrets configured?)
- [ ] Check database connection string
- [ ] Run tests with `NODE_ENV=test`
- [ ] Check timezone-dependent logic
- [ ] Check file path case sensitivity
- [ ] Clear caches and rebuild
- [ ] Check for flaky tests (race conditions)
- [ ] Review CI logs for specific error messages

## Future Improvements

### Potential Changes

**Under consideration:**

1. **Add Nix to CI (optional workflow)**
   - Test Nix environment in CI
   - Validate flake.nix correctness
   - Compare build times

2. **Node.js version matrix**
   - Test on both Node 22 and 24
   - Ensure compatibility
   - Catch version-specific issues early

3. **Turbo Remote Cache**
   - Share build cache across CI runs
   - Faster builds for unchanged packages
   - Already configured, need Vercel account

4. **Parallel test execution**
   - Split tests across multiple runners
   - Reduce total CI time
   - Cost vs speed tradeoff

### Not Planned

**Rejected ideas:**

- ❌ **Use Nix in CI** - Too slow, overcomplicated
- ❌ **Use Dev Containers in CI** - Docker overhead, slower than native
- ❌ **Match local environments exactly** - Unnecessary constraint, different priorities

## Summary

**Key takeaways:**

1. **CI uses vanilla GitHub Actions** for speed and simplicity
2. **Node version mismatch is acceptable** (Nix: 22 vs CI: 24)
3. **CI is source of truth** for compatibility testing
4. **Local environments prioritize convenience** over exact CI match
5. **Write CI-agnostic code** using environment variables
6. **Test early** before pushing to CI

**Questions?** See [ENVIRONMENT_COMPARISON.md](../guides/ENVIRONMENT_COMPARISON.md) or open a GitHub issue.
