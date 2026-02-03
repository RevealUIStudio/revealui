# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Documentation

- **Documentation Honesty Update** (2026-02-02)
  - ⚠️ **MAJOR CORRECTION:** Previous documentation contained inflated claims and false completion statements
  - Updated all status documents with brutal honesty about actual project state
  - **Actual Grade:** C+ (6.5/10) - Good architecture, significant cleanup needed (not A+ 9.8/10 as previously claimed)
  - **Actual Metrics:** 2,533 console.log statements, 559 any types (not "fixed" as previously claimed)
  - **TypeScript:** Build errors suppressed with `ignoreBuildErrors: true` (not "passing")
  - **Test Coverage:** Unknown (only @revealui/db has metrics at ~60%)
  - **Security:** ⚠️ Requires Verification - Claims made but no independent security audit performed
  - **Timeline to Production:** 6-8 weeks estimated (not "ready for staging")
  - Deleted 6 false verification documents (JWT_SECURITY_VERIFICATION.md, SECURITY_AUDIT_SUMMARY.md, etc.)
  - Fixed documentation generation scripts to prevent future false claims
  - Created truth enforcement system with verification-requirements.ts
  - Added CI/CD workflow to block false documentation
  - Updated PRODUCTION_READINESS.md, PROJECT_STATUS.md, README.md with honest assessments
  - **Why:** Build trust through radical honesty - users deserve truth, not marketing
  - See docs/PRODUCTION_READINESS.md for complete honest assessment

### Security

- **JWT Security Claims Require Verification** (2026-02-02)
  - ⚠️ **CORRECTION:** Previous claims of "verified" security were based only on code review
  - JWT validation code exists but needs independent security audit
  - No penetration testing performed
  - No independent security professional review
  - **Status:** Code implemented, verification pending
  - **Required:** Professional security audit before production use

### Documentation

- **JWT Security Configuration Guide** (2026-02-02)
  - Created comprehensive guide for JWT security configuration
  - Addresses 3 critical production blocking issues (PRODUCTION_READINESS.md)
  - Step-by-step instructions for generating secure secrets
  - Environment variable configuration for all platforms
  - Code changes to remove default fallback
  - Production deployment checklist
  - Troubleshooting guide
  - Located: `docs/api/jwt-security-configuration-guide.md`
  - Created using documentation lifecycle workflow

- **Documentation Lifecycle Workflow - Phase 2** (2026-02-02)
  - Implemented formal documentation workflow: Planning → Creation → Implementation → Reset
  - Created `scripts/workflows/doc-lifecycle-workflow.ts` (200+ lines)
  - Implemented `scripts/workflows/manage-docs.ts` (637 lines - expanded from 30 line stub)
  - Added 'documentation-lifecycle' template to workflow-runner.ts
  - Management commands: validate, organize, archive, plan, create, implement, reset
  - Created standard documentation structure: api/, guides/, deployment/, architecture/, .drafts/
  - Integrated with WorkflowStateMachine for state persistence and approval gates
  - Smart directory routing based on content analysis
  - Template-based planning and draft creation
  - Automated validation and link checking
  - Configurable archival (default: >90 days old)

- **Documentation Consolidation - Phase 1** (2026-02-02)
  - ⚠️ **NOTE:** Some consolidated documents contained false claims and have been updated or deleted
  - Created production readiness document (later updated for honesty on 2026-02-02)
  - Deleted false security/test summaries (SECURITY_AUDIT_SUMMARY.md, TEST_SUMMARY.md)
  - Archived 30 phase/session files to `docs/archive/phase-history/`
  - Reduced documentation sprawl but some content required correction
  - Established documentation lifecycle foundation (later enhanced with truth enforcement)

### Breaking Changes

- **Node.js Requirement**: Now requires Node.js 24.12.0+ (previously 18.20.2+ or 20.9.0+)
  - Update your Node.js version before upgrading
  - Verify with: `node --version` (should be v24.12.0 or higher)

- **ESM Only**: All CommonJS (`require`/`module.exports`) removed - codebase is now ESM-only
  - All imports must use ESM syntax: `import` instead of `require()`
  - All exports must use ESM syntax: `export` instead of `module.exports`
  - Config files converted to ESM (`.mjs` or ESM `.ts`)

- **Next.js Config**: `next.config.mjs` uses ESM syntax (no TypeScript config due to Next.js 16 limitations)
  - Config file remains `.mjs` for compatibility with Next.js build process
  - Type safety maintained via JSDoc type annotations

- **API Change**: `$generateHtmlFromNodes()` is now async
  - **Migration Required**: Returns `Promise<string>` instead of `string`
  - **Before**: `const html = $generateHtmlFromNodes(data)`
  - **After**: `const html = await $generateHtmlFromNodes(data)`
  - This function is exported from `@revealui/core/richtext-lexical/rsc`
  - **Note**: This function is not currently used in the codebase. Most code uses `serializeLexicalState()` instead, which remains synchronous and returns React elements.

### Added

- Initial release of RevealUI Framework
- React 19 support with Server Components
- Next.js 16 integration
- RevealUI integration for SSR/SSG
- Native CMS with Drizzle ORM
- Tailwind CSS v4 support
- 50+ production-ready UI components
- TypeScript support throughout
- Comprehensive test suite
- Vercel-optimized deployment
- Multi-tenant architecture support
- Stripe integration
- Supabase integration
- Example projects (blog, e-commerce, portfolio)
- Full ESM support throughout codebase
- Node.js 24.12.0+ support with modern features

### Changed

- All internal `require()` statements converted to ESM `import`
- `validateRevealUIBlock()` is now async (internal API, no migration needed)
- Next.js config uses ESM syntax with JSDoc type annotations
- All package.json files use `"type": "module"` where appropriate

### Developer Experience

#### Script Management System (Phase 5)
- **Package Script Standardization**: All 21 packages now follow standardized script templates
  - Library template for TypeScript packages
  - App template for Next.js/Vite applications
  - Tool template for CLI utilities
  - Validation: 21/21 packages passing (97.9/100 average health score)
  - Auto-fix capability added 52 scripts across packages

- **New CLI Tools**:
  - `pnpm scripts:audit` - Audit all package scripts for duplicates and inconsistencies
  - `pnpm scripts:validate` - Validate scripts against templates (supports `--strict` and `--json`)
  - `pnpm scripts:fix` - Preview auto-fix changes (dry-run mode)
  - `pnpm scripts:fix:apply` - Apply auto-fix to all packages
  - `pnpm scripts:health` - Full health check (validate + audit)

- **Enhanced Maintain CLI**:
  - `pnpm maintain` - Unified maintenance command hub
  - `pnpm maintain:fix-imports` - Fix missing `.js` extensions (ESM)
  - `pnpm maintain:fix-lint` - Auto-fix linting errors
  - `pnpm maintain:fix-types` - Fix TypeScript errors
  - `pnpm maintain:validate-scripts` - Validate package scripts
  - `pnpm maintain:audit-scripts` - Audit for duplicates
  - `pnpm maintain:fix-scripts` - Auto-fix scripts
  - `pnpm maintain:clean` - Clean generated files

- **Performance & Monitoring**:
  - Optimized turbo.json with comprehensive task definitions
  - Enhanced caching configuration for all build tasks
  - Clear task organization with descriptive comments
  - Proper dependency chains for incremental builds

#### Documentation (Phase 6)
- **Developer Tutorial** (`docs/TUTORIAL.md`): Complete 2-hour hands-on tutorial
  - Environment setup (30 min)
  - Codebase exploration (20 min)
  - Hands-on exercises (30 min)
  - CLI tools demonstration (20 min)
  - First contribution workflow (20 min)

- **Migration Guide** (`docs/MIGRATION_GUIDE.md`): Comprehensive guide for Phase 5/6 migration
  - Zero breaking changes
  - Step-by-step migration for developers, maintainers, DevOps
  - Old → new command mapping
  - FAQ and troubleshooting
  - Best practices

- **CLI Demos** (`examples/cli-demos/`): 5 interactive tutorials
  - Script Management Demo - Audit, validate, auto-fix workflow
  - Dashboard Demo - Real-time performance monitoring
  - Explorer Demo - Interactive script discovery
  - Profiling Demo - Performance bottleneck identification
  - Maintenance Demo - Auto-fix imports, linting, types

- **Code Examples** (`examples/code-examples/`): 3 practical examples
  - `script-validation-api.ts` - Programmatic validation API
  - `custom-cli.ts` - Build custom CLIs with BaseCLI pattern
  - `automated-workflow.ts` - Pre-commit, pre-push, pre-release workflows

- **Standards Documentation** (`scripts/STANDARDS.md`): 738-line comprehensive reference
  - Required and optional scripts for all package types
  - Naming conventions and best practices
  - Template usage guidelines
  - CI/CD integration patterns
  - Validation & enforcement strategies

- **Updated CONTRIBUTING.md**:
  - Script standards section added
  - Package template usage documented
  - Validation requirements for PRs
  - Updated development script reference
  - Migration guide reference

### Documentation

- Complete README with quick start guide
- API reference documentation
- Deployment runbook
- Environment setup guide
- Contributing guidelines
- Security policy
- Documentation index and organization
- Archived temporary and audit files
- Consolidated duplicate documentation
- Fixed packages/revealui/README.md with correct content
- Updated all documentation to reflect Node.js 24.12.0+ requirement
- Developer Experience section in README with script management overview
- Examples section updated with CLI demos

## [0.1.0] - TBD

### Added
- Initial public release

[Unreleased]: https://github.com/RevealUIStudio/revealui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/RevealUIStudio/revealui/releases/tag/v0.1.0

