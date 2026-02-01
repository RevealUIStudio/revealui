# Development Guide

Welcome to the RevealUI development guide. This section provides comprehensive documentation on development tools, configurations, and workflows.

**Last Updated:** 2026-01-31

---

## Quick Navigation

### Core Development Topics

| Document | Description | When to Use |
|----------|-------------|-------------|
| **[CI Environment](./CI_ENVIRONMENT.md)** | CI/CD environment specifications and best practices | Setting up CI/CD, debugging CI failures, understanding environment differences |
| **[Database Management](./DATABASE_MANAGEMENT.md)** | Database scripts, workflows, and troubleshooting | Managing databases, running migrations, seeding data, backups |
| **[Module Resolution](./MODULE_RESOLUTION.md)** | Path aliases and module resolution strategies | Configuring imports, resolving module errors, organizing code |
| **[TypeScript Migration](./TYPESCRIPT_MIGRATION.md)** | TypeScript strict mode migration guide | Improving type safety, migrating to strict mode |

---

## Common Tasks

### Setting Up Your Development Environment

1. **Choose your environment:**
   - Pure Nix → See environment comparison
   - Dev Containers → Docker-based setup
   - Manual → Traditional setup

2. **Setup database:**
   - Read [Database Management](./DATABASE_MANAGEMENT.md#first-time-setup)
   - Run `pnpm db:init`, `pnpm db:migrate`, `pnpm db:seed`

3. **Configure path aliases:**
   - Review [Module Resolution](./MODULE_RESOLUTION.md)
   - Understand TypeScript and Vitest configuration

### Working with CI/CD

- **Understanding CI environment:** [CI Environment](./CI_ENVIRONMENT.md#overview)
- **Debugging CI failures:** [Common CI Issues](./CI_ENVIRONMENT.md#common-ci-issues)
- **Testing against CI locally:** [Testing Against CI](./CI_ENVIRONMENT.md#testing-against-ci-locally)

### Database Operations

- **Initialize database:** `pnpm db:init`
- **Run migrations:** `pnpm db:migrate`
- **Reset database:** `pnpm db:reset --confirm`
- **Seed sample data:** `pnpm db:seed`
- **Create backup:** `pnpm db:backup`
- **Check status:** `pnpm db:status`

**Full guide:** [Database Management](./DATABASE_MANAGEMENT.md#available-commands)

### Module Imports and Path Aliases

- **Application imports:** Use `@/` alias for apps
- **Package imports:** Use workspace protocol (`@revealui/package`)
- **Test imports:** Configure in both `tsconfig.json` and `vitest.config.ts`

**Full guide:** [Module Resolution](./MODULE_RESOLUTION.md)

### TypeScript Configuration

- **Current state:** Most packages use strict mode
- **Migration plan:** `packages/ai` planned for Q2 2026
- **Best practices:** Type safety, explicit return types, null checks

**Full guide:** [TypeScript Migration](./TYPESCRIPT_MIGRATION.md)

---

## By Development Environment

### Pure Nix Environment

**Database:**
- Server control: `db-start`, `db-stop`, `db-status`
- Application: Use pnpm scripts (`pnpm db:init`, etc.)

**CI Compatibility:**
- Node.js 22 (local) vs 24.12.0 (CI)
- High compatibility, CI catches version-specific issues

**Reference:** [CI Environment](./CI_ENVIRONMENT.md#local-vs-ci-comparison)

### Dev Containers

**Database:**
- Automatic PostgreSQL startup
- Connection: `postgresql://postgres@db:5432/revealui`

**CI Compatibility:**
- Node.js 24.12.0 (matches CI exactly)
- Docker-based workflow

**Reference:** [Database Management](./DATABASE_MANAGEMENT.md#dev-containers)

### Manual Setup

**Database:**
- OS-specific PostgreSQL management
- macOS: Homebrew services
- Linux: systemd
- Windows: pg_ctl

**Reference:** [Database Management](./DATABASE_MANAGEMENT.md#manual-setup)

---

## Quick Reference

### Database Commands

```bash
# First-time setup
pnpm db:init              # Initialize connection
pnpm db:migrate           # Run migrations
pnpm db:seed              # Seed sample data

# Daily operations
pnpm db:status            # Check status
pnpm db:backup            # Create backup
pnpm db:reset --confirm   # Reset database

# Troubleshooting
pnpm db:reset --confirm --no-backup  # Quick reset
```

### CI/CD Commands

```bash
# Local validation (before push)
NODE_ENV=test pnpm build
NODE_ENV=test pnpm test
pnpm lint
pnpm typecheck

# Test against CI locally
act push                  # Using act
act -j test              # Specific job
```

### Module Resolution

```typescript
// App imports
import { Button } from '@/components/Button'

// Package imports
import { Contract } from '@revealui/contracts'

// Relative imports (avoid for deep paths)
import { helper } from '../utils/helper'
```

---

## Troubleshooting

### Common Issues

| Issue | Solution | Reference |
|-------|----------|-----------|
| CI tests fail locally pass | Check Node version, environment variables | [CI Issues](./CI_ENVIRONMENT.md#common-ci-issues) |
| Database connection refused | Check if PostgreSQL is running | [DB Troubleshooting](./DATABASE_MANAGEMENT.md#troubleshooting) |
| Cannot find module with alias | Sync tsconfig.json and vitest.config.ts | [Module Troubleshooting](./MODULE_RESOLUTION.md#troubleshooting) |
| TypeScript strict mode errors | Review migration guide | [TypeScript Guide](./TYPESCRIPT_MIGRATION.md) |

---

## Best Practices

### General Development

1. **Write CI-agnostic code** - Use environment variables, avoid hardcoded paths
2. **Test early** - Run CI-like checks locally before pushing
3. **Document changes** - Update relevant guides when changing configurations
4. **Use pnpm scripts** - Ensure consistency across environments

### Database Management

1. **Always back up** - Before destructive operations
2. **Test migrations** - In development before production
3. **Use pnpm scripts** - Not environment-specific commands
4. **Clean up test data** - After tests complete

### Module Organization

1. **Keep aliases simple** - Prefer `@/` over complex nested aliases
2. **Sync configs** - TypeScript and Vitest must match
3. **Prefer workspace protocol** - For inter-package imports
4. **Document exceptions** - Comment why non-standard aliases exist

---

## Related Documentation

### Main Documentation

- **[Master Index](../INDEX.md)** - Complete documentation index
- **[Architecture](../architecture/ARCHITECTURE.md)** - System architecture overview
- **[Testing Guide](../testing/TESTING.md)** - Comprehensive testing documentation
- **[CI/CD Guide](../infrastructure/CI_CD_GUIDE.md)** - Complete CI/CD setup

### Specific Topics

- **[Database Guide](../database/DATABASE.md)** - Complete database documentation
- **[Standards](../standards/STANDARDS.md)** - Code standards and best practices
- **[Quick Start](../onboarding/QUICK_START.md)** - 5-minute setup guide

---

## Historical Context

This development guide was consolidated from a single large file (DEVELOPMENT.md) into focused documents on 2026-01-31:

- **Original:** `DEVELOPMENT.md` (1,847 lines)
- **Split into:** 5 focused documents
- **Archived:** `docs/archive/development/development-monolith-2026-01.md`

**Benefits:**
- Better navigation and discoverability
- Focused documentation per topic
- Easier maintenance and updates
- Reduced cognitive load

---

## Contributing

When adding or updating development documentation:

1. **Identify the right document** - Use this README as a guide
2. **Update relevant section** - Keep focused on the topic
3. **Update this README** - If adding new sections or documents
4. **Test examples** - Ensure all code examples work
5. **Cross-reference** - Link to related documentation

---

**Last Updated:** 2026-01-31
**Consolidated:** 2026-01-31 (1 file → 5 focused documents)
**Maintainer:** RevealUI Framework Team
