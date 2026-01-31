# Tooling Versions & Requirements

**Last Updated:** 2026-01-30

## Overview

This document specifies the versions of all major development tools used in the RevealUI monorepo, explains version requirements, and documents the update process.

## Core Tool Versions

### Runtime

| Tool | Version | Requirement | Status |
|------|---------|-------------|--------|
| **Node.js** | >= 24.12.0 | Hard requirement | ✅ Current |
| **pnpm** | 10.28.2 | Recommended | ✅ Current |

### Build Tools

| Tool | Version | Usage | Status |
|------|---------|-------|--------|
| **Next.js** | 16.1.3 | CMS, Dashboard, Landing apps | ✅ Latest stable |
| **Vite** | 7.3.1 | Package builds, dev server | ✅ Latest stable |
| **Turbopack** | (via Next.js) | Dev mode only | ⚠️ Prod disabled |
| **Turborepo** | 2.7.5 | Monorepo orchestration | ✅ Latest stable |

### TypeScript & Compilation

| Tool | Version | Usage | Status |
|------|---------|-------|--------|
| **TypeScript** | 5.9.3 | Type checking, compilation | ✅ Current |
| **tsup** | 8.5.1 | Package bundling | ✅ Current |
| **esbuild** | via tsup | Fast bundling | ✅ Current |

### Testing

| Tool | Version | Usage | Status |
|------|---------|-------|--------|
| **Vitest** | 4.0.18 | Unit/integration tests | ✅ Standardized |
| **@vitest/coverage-v8** | 4.0.18 | Code coverage | ✅ Standardized |
| **@vitest/ui** | 4.0.18 | Test UI dashboard | ✅ Standardized |
| **Playwright** | 1.57.0 | E2E tests | ✅ Current |

### Linting & Formatting

| Tool | Version | Usage | Status |
|------|---------|-------|--------|
| **Biome** | 2.3.11 | Formatting, linting | ✅ Current |
| **ESLint** | 9.39.2 | Legacy linting | ⚠️ Migrating to Biome |

## Version Requirements Rationale

### Node.js >= 24.12.0

**Why so aggressive?**
- Latest LTS features (native TypeScript support, improved ESM)
- Performance improvements (V8 engine updates)
- Security patches

**Deployment considerations:**
- Vercel supports Node.js 24.x
- Docker images available
- Local development requires nvm or similar

**Flexibility options:**
If deployment flexibility is needed, consider:
```json
{
  "engines": {
    "node": ">=22.0.0"  // More flexible for older platforms
  }
}
```

### Next.js 16.1.3

**Why Next.js 16?**
- React 19 support
- Turbopack dev mode (significantly faster HMR)
- Improved build performance
- Better App Router stability

**Production note:**
- Turbopack disabled for production builds (see `docs/architecture/TURBOPACK-DECISIONS.md`)

### Vitest 4.0.18

**Why Vitest 4.x?**
- Vite 7.x compatibility
- Improved watch mode performance
- Better workspace support for monorepos
- Native TypeScript support

**Standardization:**
All packages updated to 4.0.18 for consistency (Jan 2026).

### Turbopack Status

**Dev Mode:** ✅ Enabled
**Production:** ❌ Disabled (TURBOPACK=0 flag)

**Why?**
- Module resolution issues in production builds
- Workspace package subpath exports not fully supported
- See detailed investigation: `docs/architecture/TURBOPACK-DECISIONS.md`

**When to re-evaluate:**
- Next.js 16.2+ releases
- Next.js 17 (aiming for Turbopack as default)

## Package-Specific Versions

### Packages with Version Variations

#### Vitest v2 vs v4

**packages/setup:** Uses Vitest 2.1.9
- Reason: Recently created package, not yet updated to 4.x
- Action: Will update in next maintenance cycle

**All other packages:** Vitest 4.0.18 ✅

## Update Process

### Minor Version Updates (Patch/Minor)

**Frequency:** Monthly or as needed for security patches

**Process:**
```bash
# Update specific package
pnpm update <package>

# Update all packages
pnpm update -r

# Check for outdated packages
pnpm outdated
```

### Major Version Updates

**Frequency:** Quarterly or when significant improvements available

**Process:**
1. **Research** - Read changelogs, breaking changes
2. **Test branch** - Create dedicated branch for updates
3. **Update incrementally** - One major tool at a time
4. **Run tests** - Full test suite after each update
5. **Update docs** - Reflect changes in this document
6. **PR review** - Thorough review before merge

**Example workflow:**
```bash
# 1. Create branch
git checkout -b chore/update-vitest-5

# 2. Update package.json files
# Edit manually or use:
pnpm add -D vitest@5 @vitest/coverage-v8@5 @vitest/ui@5 --workspace-root

# 3. Install
pnpm install

# 4. Test
pnpm test
pnpm build

# 5. Commit & PR
git add .
git commit -m "chore: update Vitest to v5"
```

## Version Pinning Strategy

### Exact Versions (`1.2.3`)
Used for:
- Critical dependencies (Next.js, React)
- Ensures reproducible builds

### Caret Ranges (`^1.2.3`)
Used for:
- Dev dependencies
- Non-breaking updates automatically available
- Balance between stability and security

### Tilde Ranges (`~1.2.3`)
Not used in this project.

## Compatibility Matrix

### Next.js 16 Compatibility

| Package | Compatible Version | Notes |
|---------|-------------------|-------|
| React | 19.2.3 | Required for Next 16 |
| Vite | 7.3.1 | ✅ Compatible |
| TypeScript | 5.9.3 | ✅ Compatible |
| Turbopack | (bundled) | Dev only |

### Vitest 4 Compatibility

| Package | Compatible Version | Notes |
|---------|-------------------|-------|
| Vite | 7.3.1 | Required |
| @vitest/coverage-v8 | 4.0.18 | Must match Vitest version |
| @vitest/ui | 4.0.18 | Must match Vitest version |

## Known Issues & Workarounds

### 1. Turbopack Production Builds
**Issue:** Module resolution failures
**Workaround:** `TURBOPACK=0` flag in production builds
**Tracking:** `docs/architecture/TURBOPACK-DECISIONS.md`

### 2. Vitest Workspace Configuration
**Issue:** Some packages have slightly different Vitest versions
**Workaround:** Workspace-level vitest.config.ts
**Resolution:** Standardized to 4.0.18 (Jan 2026)

### 3. ESM Module Resolution
**Issue:** `.js` extensions in TypeScript imports
**Workaround:** `moduleResolution: "bundler"` in tsconfig
**Status:** Working correctly

## Upgrading Guidelines

### Before Upgrading

**Checklist:**
- [ ] Review changelog for breaking changes
- [ ] Check monorepo compatibility (workspace support)
- [ ] Verify Node.js version requirements
- [ ] Read migration guides (if major version)

### Testing After Upgrade

**Required checks:**
```bash
# 1. Clean install
pnpm install --frozen-lockfile

# 2. Type checking
pnpm typecheck:all

# 3. Linting
pnpm lint:biome

# 4. Tests (critical!)
pnpm test

# 5. Coverage
pnpm test:coverage

# 6. Builds
pnpm build

# 7. Dev server
pnpm dev:cms  # Verify it starts without errors
```

### Communication

After successful upgrade:
1. Update this document with new versions
2. Update package.json files
3. Update CI/CD if needed (GitHub Actions, Vercel)
4. Announce in team chat with migration notes

## CI/CD Versions

### GitHub Actions

```yaml
# .github/workflows/ci.yml
- uses: actions/setup-node@v4
  with:
    node-version: '24.12.0'

- uses: pnpm/action-setup@v4
  with:
    version: 10.28.2
```

### Vercel Deployment

```json
// vercel.json or project settings
{
  "buildCommand": "pnpm build",
  "nodeVersion": "24.x"
}
```

## Resources

### Official Documentation
- [Node.js Releases](https://nodejs.org/en/about/releases/)
- [Next.js Docs](https://nextjs.org/docs)
- [Vite Docs](https://vitejs.dev/)
- [Vitest Docs](https://vitest.dev/)
- [Turborepo Docs](https://turbo.build/repo/docs)

### Version Managers
- [nvm](https://github.com/nvm-sh/nvm) - Node Version Manager
- [Corepack](https://nodejs.org/api/corepack.html) - Package manager manager (built into Node 24+)

### Upgrade Tools
- [npm-check-updates](https://www.npmjs.com/package/npm-check-updates) - Check for dependency updates
- [Renovate Bot](https://github.com/renovatebot/renovate) - Automated dependency updates

## Maintenance Schedule

| Task | Frequency | Responsibility |
|------|-----------|----------------|
| Security patches | As released | DevOps/Lead Dev |
| Minor updates | Monthly | Team rotation |
| Major updates | Quarterly | Tech Lead + Team |
| Audit & review | Quarterly | Tech Lead |

## Version History

| Date | Change | Version | Notes |
|------|--------|---------|-------|
| 2026-01-30 | Standardized Vitest | 4.0.16 → 4.0.18 | All packages unified |
| 2026-01-30 | Initial documentation | - | Baseline versions documented |

---

**Last Updated:** 2026-01-30
**Maintained By:** Development Team
**Next Review:** 2026-04-30
