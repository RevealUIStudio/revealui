# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

