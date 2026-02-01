# RevealUI Scripts

Comprehensive TypeScript and shell scripts for development, automation, and tooling in the RevealUI monorepo.

## 🚀 Quick Start

### Master CLI (Recommended)

The unified `revealui` CLI provides access to all tools:

```bash
# Show all available CLIs
pnpm revealui --help

# Database operations
pnpm revealui db init
pnpm revealui db status

# Code analysis
pnpm revealui analyze quality --json
pnpm revealui analyze console

# Maintenance
pnpm revealui maintain fix-imports --dry-run
pnpm revealui maintain clean

# Release management
pnpm revealui release preview
pnpm revealui release version patch
```

### Direct CLI Access

Each CLI can also be accessed directly:

```bash
pnpm analyze:quality
pnpm maintain:fix-imports
pnpm release:preview
```

---

## 📁 Directory Structure

```
scripts/
├── cli/                    # 8 Unified CLI entry points ⭐
│   ├── revealui.ts        # Master CLI router
│   ├── analyze.ts         # Code analysis (NEW)
│   ├── maintain.ts        # Maintenance & fixes (NEW)
│   ├── release.ts         # Version management (NEW)
│   ├── db.ts              # Database operations
│   ├── setup.ts           # Environment setup
│   ├── validate.ts        # Validation gates
│   ├── workflow.ts        # Workflow automation
│   └── skills.ts          # Agent skills
│
├── lib/                    # Shared utilities
│   ├── database/          # DB connection & backup
│   ├── state/             # Workflow state management
│   ├── validation/        # Validation utilities
│   └── monitoring/        # Process monitoring
│
├── __tests__/             # Test suite (reorganized) ⭐
│   ├── unit/              # 7 unit tests
│   ├── integration/       # 5 integration tests
│   ├── cli/               # 2 CLI tests
│   └── fixtures/          # Test data
│
├── dev-tools/             # Development utilities (NEW) ⭐
│   ├── test-database.ts
│   ├── teardown-test-database.ts
│   ├── run-integration-tests.ts
│   └── verify-test-setup.ts
│
├── analyze/               # Code analysis scripts (23 scripts)
├── validate/              # Validation gates (22 scripts)
├── setup/                 # Environment setup (22 scripts)
├── generate/              # Code generation (8 scripts)
├── workflows/             # Workflow automation (12 scripts)
├── commands/              # Direct command implementations
│   └── database/          # Database commands
├── gates/                 # Quality gates
│   ├── cohesion/          # Architecture analysis
│   ├── ops/               # Build & deployment
│   ├── performance/       # Performance benchmarks
│   └── security/          # Security testing
├── mcp/                   # MCP protocol adapters
└── agent/                 # Shell scripts (8 scripts)

# Archived scripts moved to /.archive/scripts/
```

---

## 🎯 Available CLIs

### 1. Master CLI - `revealui`

Unified entry point for all tools.

```bash
pnpm revealui <cli> <command> [options]

# Examples
pnpm revealui db init
pnpm revealui analyze quality --json
pnpm revealui maintain fix-imports --dry-run
```

**Available CLIs:**
- `db` - Database operations
- `setup` - Environment setup
- `validate` - Code validation
- `workflow` - Workflow automation
- `skills` - Agent skills
- `maintain` - Codebase maintenance
- `analyze` - Code analysis
- `release` - Version management

---

### 2. Analyze CLI - Code Analysis

Comprehensive code analysis and metrics.

```bash
pnpm analyze <command> [options]

Commands:
  quality         Code quality metrics
  types           TypeScript type analysis
  console         Find console statements
  docs            Documentation analysis
  performance     Performance measurement
  components      React component inventory
  audit-any       Find 'any' type usage
  audit-docs      Audit documentation
```

**Examples:**
```bash
pnpm analyze:quality --json
pnpm analyze:console --path "apps/cms/**"
pnpm analyze:types --verbose
pnpm revealui analyze audit-any --threshold 10
```

**Package.json scripts:**
- `analyze:quality`
- `analyze:types`
- `analyze:console`
- `analyze:docs`
- `analyze:performance`
- `analyze:components`
- `analyze:audit-any`
- `analyze:audit-docs`

---

### 3. Maintain CLI - Codebase Maintenance

Automated fixes and maintenance tasks.

```bash
pnpm maintain <command> [options]

Commands:
  fix-imports      Fix missing .js extensions
  fix-lint         Fix linting errors
  fix-types        Fix TypeScript errors
  fix-supabase     Update Supabase types
  fix-node16       Fix Node16 imports
  fix-validation   Fix validation issues
  fix-test         Fix test errors
  audit-scripts    Audit package.json scripts
  clean            Clean generated files
```

**Examples:**
```bash
pnpm maintain:fix-imports --dry-run
pnpm maintain:fix-lint --path "apps/**"
pnpm maintain:clean
pnpm revealui maintain audit-scripts --json
```

**Package.json scripts:**
- `maintain:fix-imports`
- `maintain:fix-lint`
- `maintain:fix-types`
- `maintain:fix-supabase`
- `maintain:audit-scripts`
- `maintain:clean`

---

### 4. Release CLI - Version Management

Version bumping and package publishing.

```bash
pnpm release <command> [options]

Commands:
  version          Bump version (major|minor|patch)
  preview          Preview release changes
  changelog        Generate changelog
  publish          Publish to npm
  tag              Create git tag
  dry-run          Simulate release
```

**Examples:**
```bash
pnpm release:preview
pnpm release:version patch
pnpm release:changelog --output CHANGELOG.md
pnpm release:publish --tag beta
pnpm release:dry-run
```

**Package.json scripts:**
- `release:preview`
- `release:version`
- `release:changelog`
- `release:publish`
- `release:tag`
- `release:dry-run`

---

### 5. Database CLI - `db`

Database management operations.

```bash
pnpm revealui db <command>

Commands:
  init       Initialize database
  migrate    Run migrations
  reset      Reset database
  seed       Seed sample data
  backup     Create backup
  restore    Restore from backup
  status     Show database status
```

**Examples:**
```bash
pnpm db:init
pnpm db:status
pnpm db:backup --output backup.sql
pnpm revealui db migrate
```

---

### 6. Setup CLI - Environment Setup

Project and environment configuration.

```bash
pnpm setup:env           # Interactive env setup
pnpm setup:node          # Check Node version
pnpm setup:mcp           # Configure MCP servers
```

---

### 7. Validate CLI - Code Validation

Validation gates and checks.

```bash
pnpm validate:env            # Validate environment
pnpm validate:docs           # Validate documentation
pnpm validate:console        # Check for console statements
pnpm validate:pre-launch     # Pre-launch checks
```

---

### 8. Workflow CLI - Workflow Automation

Workflow management and automation.

```bash
pnpm workflow:start <name>   # Start workflow
pnpm workflow:status         # Show workflow status
pnpm workflow:approve        # Approve workflow step
pnpm workflow:list           # List all workflows
```

---

### 9. Skills CLI - Agent Skills

Manage agent skills and capabilities.

```bash
pnpm skills:list             # List available skills
pnpm skills:add <skill>      # Add new skill
pnpm skills:info <skill>     # Show skill info
pnpm skills:search <query>   # Search skills
```

---

## 🔧 Development Tools (`dev-tools/`)

Utilities for testing and development:

### Test Database Management

```bash
# Setup test database
pnpm db:setup-test

# Run integration tests
pnpm test:integration

# Teardown test database
tsx scripts/dev-tools/teardown-test-database.ts

# Verify test setup
tsx scripts/dev-tools/verify-test-setup.ts
```

### Test Database Scripts

- `test-database.ts` - Setup test PostgreSQL database
- `teardown-test-database.ts` - Clean up test databases
- `test-neon-connection.ts` - Test Neon connectivity
- `run-integration-tests.ts` - Run integration test suite
- `run-memory-tests.ts` - Run tests with memory profiling
- `verify-test-setup.ts` - Verify test environment

See [dev-tools/README.md](./dev-tools/README.md) for detailed documentation.

---

## 📝 Common Tasks

### Code Quality & Analysis

```bash
# Analyze code quality
pnpm analyze:quality

# Find console statements
pnpm analyze:console

# Check TypeScript types
pnpm analyze:types

# Audit for 'any' types
pnpm analyze:audit-any
```

### Fixing Issues

```bash
# Fix import extensions
pnpm maintain:fix-imports --dry-run

# Fix linting errors
pnpm maintain:fix-lint

# Fix TypeScript errors
pnpm maintain:fix-types

# Clean generated files
pnpm maintain:clean
```

### Database Operations

```bash
# Initialize database
pnpm db:init

# Run migrations
pnpm db:migrate

# Check status
pnpm db:status

# Setup test database
pnpm db:setup-test
```

### Testing

```bash
# Run all tests
pnpm test

# Run integration tests
pnpm test:integration

# Run tests with coverage
pnpm test:coverage

# Setup test database first
pnpm db:setup-test
```

### Release Management

```bash
# Preview what would be released
pnpm release:preview

# Bump version
pnpm release:version minor

# Dry run (no changes)
pnpm release:dry-run

# Publish packages
pnpm release:publish
```

---

## 🏗️ Architecture

### BaseCLI Pattern

All CLIs extend the `BaseCLI` class from `cli/_base.ts`:

```typescript
class MyCLI extends BaseCLI {
  name = 'mycli'
  description = 'My CLI tool'

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'mycommand',
        description: 'My command',
        handler: async (args) => this.myCommand(args),
      },
    ]
  }

  private async myCommand(args: ParsedArgs) {
    // Implementation
    return ok({ message: 'Success' })
  }
}
```

**Features:**
- Dual-mode output (human-readable + JSON)
- Consistent argument parsing
- Error handling with exit codes
- Confirmation prompts for destructive operations
- Help message generation

### Shared Libraries (`lib/`)

Reusable utilities used across all scripts:

- **logger** - Structured logging
- **exec** - Command execution with monitoring
- **args** - Argument parsing
- **output** - Dual-mode output (human/JSON)
- **errors** - Error handling with exit codes
- **validation** - Environment & database validation
- **database** - Database utilities
- **state** - Workflow state management
- **monitoring** - Process tracking & health

---

## 🧪 Testing

### Test Structure

```
__tests__/
├── unit/              # Library module tests
├── integration/       # Cross-module tests
├── cli/               # CLI command tests
└── fixtures/          # Test data
```

### Running Tests

```bash
# All tests
pnpm test

# Integration tests only
pnpm test:integration

# With coverage
pnpm test:coverage

# Specific test file
pnpm vitest run __tests__/unit/logger.test.ts
```

---

## 📚 Migration Guide

### From Old Commands to New CLIs

**Analysis Commands:**
```bash
# Old
pnpm analysis:quality
pnpm analysis:types

# New (both work!)
pnpm analyze:quality
pnpm analyze:types
pnpm revealui analyze quality
```

**Maintenance Commands:**
```bash
# Old
pnpm fix:import-extensions

# New (both work!)
pnpm maintain:fix-imports
pnpm revealui maintain fix-imports
```

**Unified Access:**
```bash
# Master CLI provides unified access
pnpm revealui db init
pnpm revealui analyze quality
pnpm revealui maintain fix-lint
pnpm revealui release preview
```

### Backward Compatibility

All old commands still work! New CLIs are additive:

- ✅ `analysis:*` scripts still work
- ✅ `fix:*` scripts still work
- ✅ `db:*` scripts still work
- ✅ New `analyze:*` scripts available
- ✅ New `maintain:*` scripts available
- ✅ New `release:*` scripts available
- ✅ Master `revealui` CLI available

---

## 🔍 Finding Scripts

### By Category

```bash
# List all analyze scripts
ls scripts/analyze/

# List all validation scripts
ls scripts/validate/

# List all setup scripts
ls scripts/setup/

# List all CLI entry points
ls scripts/cli/
```

### By Function

- **Database**: `scripts/commands/database/`, `cli/db.ts`
- **Testing**: `scripts/dev-tools/`, `__tests__/`
- **Analysis**: `scripts/analyze/`, `cli/analyze.ts`
- **Validation**: `scripts/validate/`, `cli/validate.ts`
- **Setup**: `scripts/setup/`, `cli/setup.ts`
- **Fixes**: `cli/maintain.ts` (consolidates fix-* scripts)
- **Release**: `cli/release.ts`

---

## 📖 Further Documentation

- **CLI Details**: See individual CLI `--help` for command details
- **Dev Tools**: [dev-tools/README.md](./dev-tools/README.md)
- **Database**: [setup/README.md](./setup/README.md)
- **Testing**: [__tests__/README.md](../__tests__/README.md)
- **Architecture**: [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)

---

## 🤝 Contributing

When adding new scripts:

1. **Use BaseCLI** for new CLIs (see `cli/_base.ts`)
2. **Follow naming conventions**: `<category>-<action>.ts`
3. **Add tests** to `__tests__/`
4. **Update this README** with new commands
5. **Add package.json scripts** for discoverability
6. **Maintain backward compatibility**

### Script Categories

- **cli/** - CLI entry points (extend BaseCLI)
- **lib/** - Shared utilities (no main execution)
- **analyze/** - Analysis & metrics scripts
- **validate/** - Validation & checks
- **setup/** - Environment & database setup
- **dev-tools/** - Development utilities
- **commands/** - Direct command implementations

---

## 📊 Statistics

- **Total Scripts**: 182 TypeScript files
- **Shell Scripts**: 18 files
- **CLIs**: 8 unified CLIs
- **Commands**: 50+ available commands
- **Test Files**: 14 test files
- **Shared Libraries**: 20+ utility modules

---

**Last Updated**: Phase 2 - CLI Unification Complete
