# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the RevealUI project.

<!-- Test: Verifying quality-checks.yml and security-audit.yml workflows -->

## Workflows

### Core CI/CD

#### `ci.yml` - Continuous Integration
**Triggers:** Pull requests, pushes to main/master

Comprehensive CI pipeline with parallel execution:
- **Lint:** Biome and ESLint checks
- **Typecheck:** TypeScript validation across all packages
- **Unit Tests:** Matrix testing across all packages
- **E2E Tests:** Playwright tests with browser matrix (Chrome, Firefox, WebKit)
- **Build:** All apps (cms, web, docs, dashboard, landing)
- **Docker Build:** Multi-platform images for main branch

#### `test.yml` - Test Suite
**Triggers:** Pull requests, pushes to main/master

Focused test execution with coverage reporting:
- Unit tests for all packages
- Integration tests
- Coverage upload to Codecov

### Quality Assurance

#### `quality-checks.yml` - Quality Metrics **[NEW]**
**Triggers:** Pull requests, pushes to main/master

Enforces 100% quality standards:

**Type Safety Audit:**
- Scans for avoidable `any` types using `pnpm audit:any`
- Fails CI if any avoidable `any` types found
- Uploads detailed audit report
- **Target:** 0 avoidable `any` types

**Console Statement Audit:**
- Scans for `console.*` statements in production code
- Fails CI if production console statements found
- Tests, scripts, and config files are allowed
- Uploads detailed audit report
- **Target:** 0 console statements in production

**Build All Packages:**
- Ensures all 21 packages build successfully
- Verifies no TypeScript compilation errors
- Uses Turbo cache for performance
- **Target:** 21/21 packages building

**Benefits:**
- Prevents quality regressions
- Maintains 100% quality metrics
- Automated enforcement (no manual reviews needed)
- Clear feedback for developers

### Security

#### `security-audit.yml` - Security Scanning **[NEW]**
**Triggers:** Pull requests, pushes to main/master, weekly schedule (Mondays 9am UTC), manual dispatch

Comprehensive security checks:

**Dependency Vulnerability Scan:**
- Uses `pnpm audit` to check for known vulnerabilities
- Fails on critical/high severity issues
- Warns on moderate severity issues
- Uploads audit report for review

**Secrets & Credentials Scan:**
- Scans for hardcoded passwords, API keys, tokens
- Detects AWS keys, Google API keys, Stripe keys
- Checks for database URLs with credentials
- Pattern-based detection with regex

**Environment Variable Security:**
- Ensures no `.env` files are committed (except `.env.example`)
- Checks for exposed database URLs
- Validates environment configuration

**Auth & Authorization Review:**
- Checks for hardcoded JWT secrets
- Validates password strength requirements
- Scans for plaintext password storage
- Reviews authentication patterns

**API Security Review:**
- Detects CORS misconfigurations (wildcards)
- Checks for rate limiting on API routes
- Validates API security best practices

**Schedule:** Runs weekly to catch new vulnerabilities

#### `secrets-scan.yml` - Secret Detection
**Triggers:** Pull requests, pushes

Lightweight secret scanning focused on preventing accidental commits.

#### `codeql.yml` - CodeQL Analysis
**Triggers:** Pull requests, pushes, scheduled

GitHub's semantic code analysis for security vulnerabilities.

### Validation

#### `validate-types.yml` - Type Validation
**Triggers:** Pull requests, pushes

Validates TypeScript types across the monorepo.

#### `validate-docs.yml` - Documentation Validation
**Triggers:** Pull requests, pushes

Ensures documentation quality and accuracy.

#### `doc-validation.yml` - Doc Structure Validation
**Triggers:** Pull requests, pushes

Validates documentation structure and formatting.

#### `structure-validation.yml` - Project Structure
**Triggers:** Pull requests, pushes

Validates project organization and file structure.

### Visual Testing

#### `visual-regression.yml` - Visual Regression Tests
**Triggers:** Pull requests, pushes to main

Captures and compares screenshots to detect UI changes.

### Other

#### `check-vultr-model.yml` - Vultr Model Check
**Triggers:** Pull requests, pushes

Validates Vultr AI model configuration.

#### `regenerate-types.yml` - Type Regeneration
**Triggers:** Manual dispatch

Regenerates TypeScript types from database schema.

## Quality Metrics Enforcement

The `quality-checks.yml` workflow enforces these metrics:

| Metric | Target | Status |
|--------|--------|--------|
| Build Success | 21/21 packages | ✅ 100% |
| Type Safety | 0 avoidable `any` | ✅ 100% |
| Console Cleanup | 0 in production | ✅ 100% |
| Test Coverage | All tests passing | ✅ 100% |

## Security Posture

The `security-audit.yml` workflow maintains:

- ✅ No critical/high severity vulnerabilities
- ✅ No hardcoded secrets or credentials
- ✅ No committed `.env` files
- ✅ Secure authentication patterns
- ✅ API rate limiting implemented

## Local Development

Run quality checks locally before pushing:

```bash
# Type safety audit
pnpm audit:any

# Console statement audit
pnpm audit:console

# Build all packages
pnpm build

# Run all tests
pnpm test

# Security: dependency audit
pnpm audit

# Full CI simulation
pnpm lint && pnpm typecheck:all && pnpm test && pnpm build
```

## Monitoring

### Artifacts
Workflows upload artifacts for debugging:
- Type safety audit reports (30 days retention)
- Console audit reports (30 days retention)
- Dependency audit reports (30 days retention)
- Test results and screenshots (7 days retention)
- Build artifacts (7 days retention)

### Notifications
- Failed checks block PR merges
- Weekly security audit summary (email)
- Quality metric reports available in Actions tab

## Contributing

When adding new workflows:
1. Follow existing naming conventions
2. Add comprehensive documentation here
3. Use appropriate timeouts (avoid hanging jobs)
4. Upload artifacts for debugging
5. Provide clear failure messages
6. Test locally with `act` if possible

## Maintenance

- Review and update dependency versions quarterly
- Audit workflow permissions regularly
- Monitor action usage and costs
- Update this documentation when workflows change
