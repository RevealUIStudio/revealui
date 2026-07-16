---
title: "Contributing to RevealUI"
description: "First off, thank you for considering contributing to RevealUI! It's people like you that make RevealUI such a great agentic business runtime."
visibility: public
status: verified
audience: contributor
---

# Contributing to RevealUI

First off, thank you for considering contributing to RevealUI! It's people like you that make RevealUI such a great agentic business runtime.

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

1. Fork the repo and create your branch from `test` (the default branch)
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes (`pnpm test`)
5. Make sure your code lints (`pnpm lint`)
6. Run type checking (`pnpm typecheck:all`)
7. Open your pull request against `test`

**For first-time contributors:** See the [Development Setup](#development-setup) section below to get started.

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/revealui.git
cd revealui

# Install dependencies
pnpm install

# Set up environment variables (revvault is the source of truth — see docs/SECRETS.md)
revvault export-env
# If revvault is not yet configured, see docs/SECRETS.md for setup instructions

# Start development
pnpm dev
```

## Project Structure

```
revealui/
├── apps/
│   ├── server/         # Hono REST API (port 3004, OpenAPI + Swagger)
│   ├── admin/          # Next.js 16 admin dashboard + content management (port 4000)
│   ├── docs/           # Documentation site (Vite + React, port 3002)
│   └── marketing/      # Marketing site (Vite + React, port 3000)
├── packages/
│   ├── auth/           # Session auth, rate limiting
│   ├── cli/            # create-revealui scaffolding
│   ├── config/         # Type-safe env config (Zod)
│   ├── contracts/      # Zod schemas + TypeScript types
│   ├── core/           # Runtime engine, REST API, plugins
│   ├── db/             # Drizzle ORM schema (92 tables, NeonDB)
│   ├── dev/            # Shared configs (Biome, TS, Tailwind)
│   ├── presentation/   # 61 UI components (Tailwind v4)
│   ├── router/         # File-based router with SSR
│   ├── setup/          # Environment setup utilities
│   ├── sync/           # ElectricSQL real-time sync
│   ├── test/           # Testing infra (fixtures, mocks)
│   └── utils/          # Logger, DB helpers, validation
└── docs/               # Documentation (25+ guides)
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

#### Future-tense claims

Every future-tense claim in docs — "coming soon", "(planned)", "will ship", "roadmap", "TBD" — **must cite a GitHub issue or milestone** so a reader can track the actual delivery state. The rule applies to prose, table cells, tier descriptions, blog drafts, feature comparisons, and README status lines alike.

Acceptable forms:

```markdown
- **Multi-tenant SSO** (planned — [#449](https://github.com/RevealUIStudio/revealui/issues/449))
- **RevealUI Fleet self-hosted kit** (roadmap — tracked in [#123](https://github.com/RevealUIStudio/revealui/issues/123))
```

Not acceptable:

```markdown
- **Multi-tenant SSO** (coming soon)              ← no issue link, no date
- RevealUI Fleet self-hosted kit (planned)         ← no tracking reference
```

Why: every unlinked "coming soon" either ages into a broken promise or becomes load-bearing for a reader making a purchase / adoption decision. The pattern already hit us once — the CR-8 and CR-9 audits (tracked internally) surfaced it. If the feature is real, it has a tracked issue; if it doesn't, it shouldn't be surfaced as "coming soon" in the first place.

File a GitHub issue before writing the claim. Link it in the prose. If the feature is abandoned later, close the issue and remove the claim in the same PR.

#### Source citations (Works Cited)

Code-asserting docs — READMEs, `docs/ARCHITECTURE.md`, `docs/STANDARDS.md`, technical guides under `docs/guides` / `docs/api` / `docs/architecture`, and specs — must ground each code-behaviour claim in the source that validates it. When you assert how the code behaves, cite the file with a **required line anchor**, on the same line or in a `## Sources` block.

Acceptable forms:

```markdown
Access reads enforce `access.read` in `packages/core/src/collections/operations/find.ts:42-88`.
Payment verification lives in [verifyPayment](apps/server/src/middleware/x402.ts:120).
```

Not acceptable:

```markdown
Access is enforced in core.                         ← no source
Payment verification lives in `apps/server/...`.    ← bare path, no line anchor
```

The `:line` / `:start-end` anchor is what separates a deliberate citation from an incidental path mention (an HTTP route, a partial component path). Citations point at code, never at another `.md` (doc-to-doc links are checked separately).

The `pnpm validate:citations` gate enforces this: it hard-fails on a citation that no longer resolves — a renamed file or a deleted line range ("citation rot") — and reports uncited code-behaviour claims in the gated docs against a grandfathered baseline. It runs in `pnpm gate` (Phase 1). Run it before opening a docs PR; regenerate the baseline only after a sweep that reduces debt.

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

- **Browse and inspect scripts** with the script explorer:
  ```bash
  pnpm scripts list           # list scripts across the monorepo
  pnpm scripts info <name>    # show a script's commands and metadata
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

- **Keep cross-package versions and scripts consistent** with syncpack:
  ```bash
  pnpm deps:check   # report mismatches
  pnpm deps:fix     # fix mismatches
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

Use the script explorer to inspect the metadata you documented:

```bash
# Inspect a script's dependencies and metadata
pnpm scripts info <name>

# Show a script's dependency tree
pnpm scripts tree <name>
```

The explorer reads the `@dependencies` and `@requires` headers to build its
registry, so keeping the headers accurate keeps `info` and `tree` accurate.

#### Adding to New Scripts

When creating a new script:

1. **Start with the template** from above
2. **List your imports** in @dependencies
3. **Document requirements** in @requires
4. **Inspect the result**: `pnpm scripts info <name>`

#### Tooling

The `pnpm scripts` explorer reads the `@dependencies` / `@requires` headers and
provides `list`, `search`, `info`, `tree`, `run`, and `history` subcommands over
the registered scripts.

See [Script Standards](scripts/STANDARDS.md) for complete details.

## Branch Strategy

The flow is `feature/* → test → main`:

- `test` - Default branch (protected). Base your work here and target your PRs here.
- `main` - Production branch (protected). It only ever receives promotion PRs whose head is `test`.
- `feat/*` - Feature branches
- `fix/*` - Bug fix branches
- `chore/*` - Maintenance branches

**Important**: Do NOT push directly to `test` or `main`, and do NOT open a feature PR against `main`. Base your branch on `test`, open the PR against `test`, and let a maintainer promote `test` to `main`. The promotion gate rejects any PR to `main` whose head is not `test`.

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the CHANGELOG.md following Keep a Changelog format
3. The PR will be merged once you have sign-off from maintainers
4. PRs require at least one approval before merging

## Development Scripts

```bash
# Development
pnpm dev                    # Start all apps
pnpm --filter <pkg> dev     # Watch-build a single package

# Building
pnpm build                  # Build all (turbo, dependency order)
pnpm --filter './packages/*' build   # Build only the packages

# Testing
pnpm test                   # Run all tests
pnpm test:coverage          # Run tests with coverage
pnpm test:integration       # Run integration tests

# Quality
pnpm lint                   # Lint all packages
pnpm lint:fix               # Auto-fix and format
pnpm format                 # Format code
pnpm typecheck:all          # Type check everything
pnpm gate                   # Full CI gate (quality, typecheck, test, build)
pnpm gate:quick             # Quick gate (phase 1 only)

# Auditing
pnpm audit:any              # Find avoidable `any` types
pnpm audit:console          # Find production console statements
pnpm audit:emdash           # Find em dashes in copy

# Dependencies
pnpm deps:check             # Report cross-package version mismatches
pnpm deps:fix               # Fix mismatches

# Script explorer
pnpm scripts list           # Browse scripts across the monorepo
pnpm scripts search <query> # Full-text search across scripts
pnpm scripts tree <name>    # Show a script's dependency tree

# Database
pnpm db:init                # Initialize database
pnpm db:migrate             # Run migrations
pnpm db:seed                # Seed sample data
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

