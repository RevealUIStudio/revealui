# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Breaking Changes

- **Node.js Requirement**: Now requires Node.js 24.13.0+ (previously 18.20.2+ or 20.9.0+)
  - Update your Node.js version before upgrading
  - Verify with: `node --version` (should be v24.13.0 or higher)

- **ESM Only**: All CommonJS (`require`/`module.exports`) removed — codebase is now ESM-only
  - All imports must use ESM syntax: `import` instead of `require()`
  - All exports must use ESM syntax: `export` instead of `module.exports`
  - Config files converted to ESM (`.mjs` or ESM `.ts`)

- **Next.js Config**: `next.config.mjs` uses ESM syntax (no TypeScript config due to Next.js 16 limitations)
  - Config file remains `.mjs` for compatibility with Next.js build process
  - Type safety maintained via JSDoc type annotations

- **API Change**: `$generateHtmlFromNodes()` is now async
  - Returns `Promise<string>` instead of `string`
  - **Before**: `const html = $generateHtmlFromNodes(data)`
  - **After**: `const html = await $generateHtmlFromNodes(data)`
  - Exported from `@revealui/core/richtext-lexical/rsc`
  - Most code uses `serializeLexicalState()` instead, which remains synchronous

### Added

- Initial release of RevealUI Framework
- React 19 support with Server Components
- Next.js 16 integration
- Native content engine with collections, fields, access control, and rich text (Lexical)
- Drizzle ORM with NeonDB (PostgreSQL) database adapter
- Session-based authentication with sign in/up, password reset, and rate limiting
- 50+ pre-wired UI components with Tailwind CSS v4
- ElectricSQL real-time sync (basic)
- REST API with automatic CRUD for all collections
- Zod schemas and TypeScript contracts across the entire stack
- File-based router
- Vercel Blob storage adapter
- Multi-tenant architecture support
- Stripe payment integration
- JWT-based license validation system with tier support (free/pro/enterprise)
- Feature flag system for premium feature gating
- `create-revealui` CLI scaffolding tool
- Full ESM support throughout codebase
- Comprehensive test suite with Vitest
- End-to-end testing with Playwright
- Biome linting and formatting
- Turborepo build orchestration
- GitHub Actions CI/CD workflows
- GitHub community files (issue templates, PR template, security policy, funding)

### Developer Experience

- **Package Script Standardization**: All packages follow standardized script templates
  - Library, app, and tool templates
  - Validation and auto-fix capability
- **Maintenance CLI**: `pnpm maintain` for common maintenance tasks
  - Fix imports, linting, types, and scripts
  - Audit and validate package scripts
- **Documentation**: Comprehensive guides, API reference, and tutorials in `docs/`
- **Examples**: CLI demos and code examples in `examples/`

### Documentation

- Quick start guide
- Architecture overview
- API reference
- Database guide (schema, migrations, queries)
- Authentication guide
- CMS guide
- Component catalog
- Deployment guide
- Testing strategy
- Contributing guidelines
- Security policy

## [0.1.0] - TBD

### Added
- Initial public release

[Unreleased]: https://github.com/RevealUIStudio/revealui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/RevealUIStudio/revealui/releases/tag/v0.1.0
