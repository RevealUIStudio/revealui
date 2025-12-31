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
4. Ensure the test suite passes (`pnpm test`)
5. Make sure your code lints (`pnpm lint`)
6. Issue that pull request!

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/reveal.git
cd reveal

# Install dependencies
pnpm install

# Set up environment variables
cp apps/cms/.env.template .env.development.local
# Edit .env.development.local with your credentials

# Start development
pnpm dev
```

## Project Structure

```
reveal/
├── apps/
│   ├── cms/          # PayloadCMS application
│   └── web/          # RevealUI web application
├── packages/
│   ├── reveal/       # Core framework (publishable)
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

- Run `pnpm lint:fix` before committing
- Use meaningful variable and function names
- Add comments for complex logic only
- Keep functions small and focused
- Follow the existing code structure

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
cd apps/cms && pnpm test    # Run CMS tests
cd apps/cms && pnpm test:coverage  # With coverage

# Quality
pnpm lint                   # Lint all packages
pnpm lint:fix               # Fix linting issues
pnpm format                 # Format code
pnpm typecheck:all          # Type check everything
```

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

