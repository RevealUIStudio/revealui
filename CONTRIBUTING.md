# Contributing to RevealUI

First off, thank you for considering contributing to RevealUI! It's people like you that make RevealUI such a great framework.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

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

1. Fork the repo and create your branch from `cursor`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. If you've added/modified packages, validate scripts (`pnpm scripts:validate`)
5. Ensure the test suite passes (`pnpm test`)
6. Make sure your code lints (`pnpm lint`)
7. Run type checking (`pnpm typecheck:all`)
8. Issue that pull request!

**For first-time contributors:** See our [Migration Guide](docs/MIGRATION_GUIDE.md) to learn about recent improvements to script management.

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/reveal.git
cd reveal

# Install dependencies
pnpm install

# Set up environment variables
cp .env.template .env.development.local
# Edit .env.development.local with your credentials
# See docs/development/ENV_FILE_STRATEGY.md for details

# Start development
pnpm dev
```

## Project Structure

```
revealui/
├── apps/
│   ├── cms/          # Next.js CMS application
│   └── web/          # RevealUI web application
├── packages/
│   ├── revealui/       # Core framework (publishable)
│   ├── cdn/          # Static assets
│   ├── services/     # Third-party integrations
│   ├── dev/          # Development tools
│   └── test/         # Testing utilities
└── docs/             # Documentation
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
- See [Linting Guide](../docs/LINTING.md) for detailed linting and formatting setup

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
  cp package-templates/library.json packages/mynewlib/package.json

  # App (Next.js/Vite)
  cp package-templates/app.json apps/mynewapp/package.json

  # Tool (CLI)
  cp package-templates/tool.json packages/mytool/package.json
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

## Branch Strategy

- `main` - Production branch (protected)
- `cursor` - Staging branch for agent work
- `feature/*` - Feature branches
- `fix/*` - Bug fix branches

**Important**: Do NOT push directly to `main`. Always create PRs to `cursor` branch.

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
- [Complete Scripts Reference](SCRIPTS.md) - All 100+ available commands
- [Script Standards](scripts/STANDARDS.md) - Package.json script guidelines
- [CLI Demos](examples/cli-demos/README.md) - Interactive tutorials

## Financial Contributions

We also welcome financial contributions through [GitHub Sponsors](https://github.com/sponsors/revealui).

## Questions?

Feel free to open a GitHub Discussion or reach out to the maintainers.

## Recognition

Contributors will be recognized in:
- Our README.md contributors section
- Release notes for significant contributions
- Our documentation site (coming soon)

Thank you for contributing to RevealUI! 🎉

