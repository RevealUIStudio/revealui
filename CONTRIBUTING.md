# Contributing to RevealUI

First off, thank you for considering contributing to RevealUI! It's people like you that make RevealUI such a great framework.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🔒 Critical Rules (MUST READ FIRST)

Before contributing, please review these mandatory policies:

### Type System Rules
**ALL types MUST come from `@revealui/contracts`. Inline types are prohibited.**

```typescript
// ❌ NEVER do this
const user: { id: string; email: string } = {...}

// ✅ ALWAYS do this
import type { User } from '@revealui/contracts'
const user: User = {...}
```

### Error Code Standardization
**NEVER use hardcoded `process.exit()` codes. Use the `ErrorCode` enum.**

```typescript
// ❌ NEVER do this
process.exit(1)

// ✅ ALWAYS do this
import { ErrorCode } from '@/lib/errors'
process.exit(ErrorCode.EXECUTION_ERROR)
```

### Linting Enforcement
**All code must pass Biome linting before commit.**

Pre-commit hooks will automatically run:
```bash
pnpm biome check --write
```

Violations of `noUnusedVariables` and `noExplicitAny` will block commits.

---

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (code snippets, test cases)
- **Describe the behavior you observed** and what you expected
- **Include screenshots** if relevant
- **Include your environment details** (OS, Node version, pnpm version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Provide specific examples** to demonstrate the enhancement
- **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. If you've added/modified packages, validate scripts (`pnpm scripts:validate`)
5. Ensure the test suite passes (`pnpm test`)
6. Make sure your code lints (`pnpm lint`)
7. Run type checking (`pnpm typecheck:all`)
8. Issue that pull request!

**For first-time contributors:** See the [Development Setup](#development-setup) section below to get started.

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/revealui.git
cd revealui

# Install dependencies
pnpm install

# Set up environment variables
cp .env.template .env.development.local
# Edit .env.development.local with your credentials
# See docs/ENVIRONMENT_VARIABLES_GUIDE.md for details

# Start development
pnpm dev
```

## Project Structure

```
revealui/
├── apps/
│   ├── api/            # Hono REST API (OpenAPI + Swagger)
│   ├── cms/            # Next.js 16 headless CMS with admin dashboard
│   ├── docs/           # Documentation site (Vite + React)
│   ├── mainframe/      # Hono SSR + React demo/showcase app
│   ├── marketing/      # Marketing + waitlist (Next.js)
│   └── studio/         # Desktop companion app (Tauri 2 + React 19)
├── packages/
│   ├── auth/           # Session auth, rate limiting
│   ├── cli/            # create-revealui scaffolding
│   ├── config/         # Type-safe env config (Zod)
│   ├── contracts/      # Zod schemas + TypeScript types
│   ├── core/           # CMS engine, REST API, plugins
│   ├── db/             # Drizzle ORM schema (76 tables, dual-DB)
│   ├── dev/            # Shared configs (Biome, TS, Tailwind)
│   ├── presentation/   # 52 UI components (Tailwind v4)
│   ├── router/         # File-based router with SSR
│   ├── setup/          # Environment setup utilities
│   ├── sync/           # ElectricSQL real-time sync
│   ├── test/           # Testing infra (fixtures, mocks)
│   └── utils/          # Logger, DB helpers, validation
└── docs/               # Documentation (60+ guides)
```

## Coding Guidelines

### TypeScript

- Use TypeScript for all code
- Avoid `any` types - use `unknown` if truly needed
- Use strict equality (`===` and `!==`)
- Prefer type inference over explicit types when obvious
- Define interfaces in `types/interfaces/` and types in `types/`

### React

- Use React 19 features (server components, server actions)
- Avoid unnecessary `useCallback`, `useMemo` (React Compiler handles this)
- Prefer server components over client components
- Use the `"use client"` directive only when necessary

### Code Style

- Run `pnpm lint:fix` before committing (formats code and fixes linting issues)
- Use meaningful variable and function names
- Add comments for complex logic only
- Keep functions small and focused
- Follow the existing code structure
- Run `pnpm lint` to check for issues, `pnpm lint:fix` to auto-fix

### Commits

- Use clear and meaningful commit messages
- Follow conventional commits format:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `refactor:` for code refactoring
  - `test:` for adding tests
  - `chore:` for maintenance tasks

Examples:
```
feat: add ISR support for RevealUI pages
fix: resolve memory leak in usePageContext
docs: update QUICK_START guide
```

### Testing

- Write tests for new features
- Update tests when modifying existing features
- Aim for 95%+ test coverage
- Use Vitest for unit and integration tests
- Run `pnpm test` before submitting PR

### Documentation

- Update README.md if adding features
- Add JSDoc comments for public APIs
- Update relevant guides in `/docs`
- Include code examples for new features

### Script Standards

When creating or modifying packages:

- **Use package templates** for new packages:
  ```bash
  # Library (most packages)
  cp .revealui/templates/library.json packages/mynewlib/package.json

  # App (Next.js/Vite)
  cp .revealui/templates/app.json apps/mynewapp/package.json

  # Tool (CLI)
  cp .revealui/templates/tool.json packages/mytool/package.json
  ```

- **Validate scripts** before committing:
  ```bash
  pnpm scripts:validate --package @revealui/mypackage
  ```

- **Required scripts** for all packages:
  - `build` - Compile/bundle for production
  - `dev` - Watch mode for development
  - `lint` - Run Biome linter
  - `typecheck` - TypeScript type checking
  - `test` - Run tests
  - `clean` - Remove build artifacts

- **Follow naming conventions**:
  - Use prefixes: `test:*`, `lint:*`, `db:*`
  - Use kebab-case: `test:watch` not `testWatch`
  - Be descriptive: `test:coverage` not `test:cov`

- **Auto-fix missing scripts**:
  ```bash
  # Preview changes
  pnpm maintain:fix-scripts --package @revealui/mypackage --dry-run

  # Apply fixes
  pnpm maintain:fix-scripts --package @revealui/mypackage
  ```

See [Script Standards](scripts/STANDARDS.md) for complete guidelines.

### Script Dependencies Documentation

All TypeScript files in `scripts/` must include standardized JSDoc headers documenting their dependencies and requirements. This enables automated dependency validation, graph generation, and helps developers understand script relationships.

#### Format

```typescript
/**
 * Script Name/Description
 *
 * @dependencies
 * - path/to/file.ts - Description of what this dependency provides
 * - @revealui/package-name - External package description
 * - relative/path.ts - Another file dependency
 *
 * @requires
 * - Environment: VARIABLE_NAME - Description of what this variable is for
 * - External: command-name - System tool or CLI required
 * - Scripts: other-script.ts (must run first) - Execution order dependency
 */
```

#### Components

**@dependencies** - File and package imports:
- **Internal files**: `scripts/lib/errors.ts - Error handling utilities`
- **Packages**: `@revealui/db - Database operations and queries`
- **Relative paths**: `../lib/utils.ts - Shared utility functions`
- Include description of what the dependency provides

**@requires** - External requirements:
- **Environment**: Environment variables needed (e.g., `DATABASE_URL`, `GITHUB_TOKEN`)
- **External**: System tools or CLIs (e.g., `psql`, `gh`, `docker`)
- **Scripts**: Other scripts that must run first (execution order)

#### Examples

**CLI Implementation**:
```typescript
/**
 * Operations CLI
 *
 * Consolidates maintenance, migration, database, and setup commands.
 *
 * @dependencies
 * - scripts/cli/_base.ts - Base CLI classes (DispatcherCLI)
 * - scripts/lib/audit/execution-logger.ts - Execution tracking
 * - scripts/lib/dispatch.ts - Command dispatching utilities
 *
 * @requires
 * - Scripts: Individual command scripts in scripts/commands/
 */
```

**Database Script**:
```typescript
/**
 * Database Migration Script
 *
 * @dependencies
 * - @revealui/db - Database connection and schema
 * - drizzle-orm - ORM for migrations
 * - scripts/lib/errors.ts - Error handling
 *
 * @requires
 * - Environment: DATABASE_URL - PostgreSQL connection string
 * - External: psql - PostgreSQL CLI for verification
 * - Scripts: db-backup.ts (must run first) - Creates backup before migration
 */
```

**Generator Script**:
```typescript
/**
 * Type Generator
 *
 * @dependencies
 * - scripts/lib/generators/types/table-discovery.ts - Table mapping
 * - scripts/lib/generators/types/type-transformer.ts - File transformation
 * - @revealui/db/types/discover - Dynamic schema discovery
 * - fast-glob - File pattern matching
 *
 * @requires
 * - Scripts: generate-db-types.ts (must run first) - Generates source types
 */
```

**Utility Module**:
```typescript
/**
 * File Scanner Utilities
 *
 * @dependencies
 * - fast-glob - Efficient file pattern matching
 * - node:fs - File system operations
 * - node:path - Path manipulation
 */
```

#### Guidelines

**What to include**:
- ✅ Direct imports from other script files
- ✅ Package dependencies used in the script
- ✅ Environment variables read from `process.env`
- ✅ External CLI tools executed via `child_process`
- ✅ Scripts that must run before this one

**What to omit**:
- ❌ Node.js built-ins don't need descriptions (just list them)
- ❌ Type-only imports (unless they're complex custom types)
- ❌ Standard npm packages everyone knows (e.g., `chalk` for colors)
- ❌ Development dependencies not used at runtime

**Descriptions**:
- Keep descriptions concise (5-10 words)
- Focus on **why** this dependency is needed
- Use active voice: "Handles error codes" not "Error handling"
- Group related dependencies together

#### Validation

Use the dependency validator to check your documentation:

```bash
# Validate all scripts
pnpm check validate:dependencies

# Check specific file
pnpm check validate:dependencies --file scripts/cli/ops.ts

# Generate dependency graph
pnpm info deps:graph --output docs/DEPENDENCY_GRAPH.md
```

The validator will check:
- ✅ All `@dependencies` files exist
- ✅ No circular dependencies
- ✅ Required environment variables are documented
- ✅ Execution order is valid
- ⚠️ Warnings for missing documentation

#### Adding to New Scripts

When creating a new script:

1. **Start with the template** from above
2. **List your imports** in @dependencies
3. **Document requirements** in @requires
4. **Run validation**: `pnpm check validate:dependencies --file your-script.ts`
5. **Update if needed** based on validation results

#### Tooling

The dependency system provides:
- **Validator**: Detects circular dependencies, missing files, undocumented dependencies
- **Graph Generator**: Creates visual diagrams (Mermaid, DOT, JSON)
- **CI Integration**: Automatically validates on PRs
- **Pre-commit Hook**: Checks modified scripts before commit

See [Script Standards](scripts/STANDARDS.md) for complete details.

## Branch Strategy

- `main` - Production branch (protected)
- `feat/*` - Feature branches
- `fix/*` - Bug fix branches
- `chore/*` - Maintenance branches

**Important**: Do NOT push directly to `main`. Always create a PR from your feature branch.

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the CHANGELOG.md following Keep a Changelog format
3. The PR will be merged once you have sign-off from maintainers
4. PRs require at least one approval before merging

## Development Scripts

```bash
# Development
pnpm dev                    # Start all apps
pnpm dev:packages           # Start package development

# Building
pnpm build                  # Build all packages
pnpm build:packages         # Build publishable packages

# Testing
pnpm test                   # Run all tests
pnpm test:coverage          # Run tests with coverage
pnpm test:integration       # Run integration tests

# Quality
pnpm lint                   # Lint all packages
pnpm lint:fix               # Fix linting issues
pnpm format                 # Format code
pnpm typecheck:all          # Type check everything

# Script Management (New!)
pnpm scripts:validate       # Validate package scripts
pnpm scripts:audit          # Audit for duplicates
pnpm scripts:fix            # Preview auto-fix (dry-run)
pnpm scripts:fix:apply      # Apply auto-fix
pnpm scripts:health         # Full health check

# Maintenance (New!)
pnpm maintain:fix-imports   # Fix import extensions
pnpm maintain:fix-lint      # Auto-fix linting errors
pnpm maintain:validate-scripts  # Validate scripts
pnpm maintain:clean         # Clean generated files

# Analysis
pnpm analyze:quality        # Code quality metrics
pnpm analyze:types          # TypeScript type analysis
pnpm analyze:console        # Find console statements

# Database
pnpm db:init                # Initialize database
pnpm db:migrate             # Run migrations
pnpm db:seed                # Seed sample data

# Interactive Tools
pnpm explore                # Interactive script browser
pnpm dashboard              # Performance dashboard
```

**See also:**
- [CI/CD Guide](docs/CI_CD_GUIDE.md) - Pipelines, deployment, and script reference
- [Script Standards](scripts/STANDARDS.md) - Package.json script guidelines

## Financial Contributions

We also welcome financial contributions through [GitHub Sponsors](https://github.com/sponsors/RevealUIStudio).

## Questions?

Feel free to open a GitHub Discussion or reach out to the maintainers.

## Recognition

Contributors will be recognized in:
- Our README.md contributors section
- Release notes for significant contributions
- Our [documentation site](https://docs.revealui.com)

Thank you for contributing to RevealUI! 🎉

