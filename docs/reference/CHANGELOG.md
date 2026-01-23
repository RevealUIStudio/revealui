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

## [0.1.0] - TBD

### Added
- Initial public release

[Unreleased]: https://github.com/RevealUIStudio/revealui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/RevealUIStudio/revealui/releases/tag/v0.1.0

