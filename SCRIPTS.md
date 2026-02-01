# Package.json Scripts Reference

Quick reference for all npm/pnpm scripts in the monorepo root.

## 📋 Script Organization

Scripts are organized by prefix for easy discovery:

### Installation & Cleanup
```bash
pnpm install:clean      # Clean install with deprecation warnings suppressed
pnpm clean              # Remove all node_modules, dist, .next, .turbo
pnpm clean:install      # Clean + install
```

### Build & Development
```bash
pnpm build              # Build all packages (parallel)
pnpm build:auth         # Build @revealui/auth
pnpm build:cms          # Build CMS (with auth dependency)
pnpm dev                # Start dev mode (with pre-hook)
pnpm dev:cms            # Start CMS in dev mode
```

### Code Quality
```bash
pnpm format             # Format code with Biome
pnpm lint               # Run all linters (Biome + ESLint)
pnpm lint:biome         # Run Biome checks
pnpm lint:eslint        # Run ESLint
pnpm lint:fix           # Auto-fix linting issues
pnpm typecheck:all      # Type-check all packages
```

### Testing
```bash
pnpm test               # Run all tests (parallel, concurrency=15)
pnpm test:coverage      # Run tests with coverage
pnpm test:integration   # Run integration tests
```

### Analysis (New CLIs) ⭐
```bash
pnpm analyze                # Show analyze CLI help
pnpm analyze:quality        # Code quality metrics
pnpm analyze:types          # TypeScript type analysis
pnpm analyze:console        # Find console statements
pnpm analyze:docs           # Documentation analysis
pnpm analyze:performance    # Performance measurement
pnpm analyze:components     # React component inventory
pnpm analyze:audit-any      # Find 'any' type usage
pnpm analyze:audit-docs     # Audit documentation
pnpm analyze:dependencies   # Analyze package dependencies
```

### Analysis (Legacy - Still Supported)
```bash
pnpm analysis:quality       # Legacy code quality
pnpm analysis:types         # Legacy type analysis
pnpm analysis:console       # Legacy console finder
```

### Database Operations
```bash
pnpm db:init            # Initialize database
pnpm db:migrate         # Run migrations
pnpm db:reset           # Reset database
pnpm db:seed            # Seed sample data
pnpm db:setup-test      # Setup test database (Docker)
pnpm db:backup          # Create backup
pnpm db:restore         # Restore from backup
pnpm db:status          # Show database status
```

### Documentation
```bash
pnpm docs:manage        # Manage documentation
pnpm docs:generate      # Generate documentation
pnpm docs:test          # Run documentation tests
```

### MCP Servers
```bash
pnpm mcp:all            # Start all MCP servers
pnpm mcp:vercel         # Vercel MCP server
pnpm mcp:stripe         # Stripe MCP server
pnpm mcp:neon           # Neon database MCP server
pnpm mcp:supabase       # Supabase MCP server
pnpm mcp:playwright     # Playwright MCP server
pnpm mcp:next-devtools  # Next.js devtools MCP server
```

### Environment & Setup
```bash
pnpm setup:env          # Interactive environment setup
pnpm setup:node         # Check Node.js version
```

### Validation
```bash
pnpm validate:env               # Validate environment variables
pnpm validate:docs              # Validate documentation
pnpm validate:docs:json         # Validate docs (JSON output)
pnpm validate:package-scripts   # Validate package.json scripts
pnpm validate:pre-launch        # Pre-launch validation
pnpm validate:console           # Check for console statements
```

### Maintenance & Fixes ⭐
```bash
pnpm maintain                   # Show maintain CLI help
pnpm maintain:fix-imports       # Fix missing .js extensions
pnpm maintain:fix-lint          # Fix linting errors
pnpm maintain:fix-types         # Fix TypeScript errors
pnpm maintain:fix-supabase      # Update Supabase types
pnpm maintain:audit-scripts     # Audit package.json scripts
pnpm maintain:clean             # Clean generated files

# Legacy fix commands (still supported)
pnpm fix:import-extensions      # Fix import extensions
pnpm fix:import-extensions:dry  # Dry run
```

### Release Management ⭐
```bash
pnpm release                # Show release CLI help
pnpm release:preview        # Preview release changes
pnpm release:version        # Bump version
pnpm release:changelog      # Generate changelog
pnpm release:publish        # Publish to npm
pnpm release:tag            # Create git tag
pnpm release:dry-run        # Simulate release
```

### Build Cache ⭐
```bash
pnpm build-cache            # Show cache CLI help
pnpm build-cache:stats      # Show cache statistics
pnpm build-cache:list       # List all cache entries
pnpm build-cache:clear      # Clear all cache entries
pnpm build-cache:cleanup    # Clean up old cache entries
pnpm build-cache:info       # Show cache configuration
```

### Metrics & Analytics ⭐
```bash
pnpm metrics                # Show metrics CLI help
pnpm metrics:summary        # Show metrics summary
pnpm metrics:dashboard      # Show full dashboard
pnpm metrics:scripts        # Script execution stats
pnpm metrics:cache          # Cache performance metrics
pnpm metrics:errors         # Error analytics
pnpm metrics:clear          # Clear all metrics
```

### Script Explorer ⭐
```bash
pnpm explore                # Interactive script browser
pnpm explore:list           # List all scripts
pnpm explore:search         # Search for scripts
```

### Workflow & Automation
```bash
pnpm automation:engine      # Run automation engine
pnpm workflow:start         # Start workflow
pnpm workflow:status        # Show workflow status
pnpm workflow:approve       # Approve workflow step
pnpm workflow:resume        # Resume workflow
pnpm workflow:cancel        # Cancel workflow
pnpm workflow:list          # List all workflows
```

### Skills Management
```bash
pnpm skills                 # Show skills CLI help
pnpm skills:add             # Add new skill
pnpm skills:list            # List available skills
pnpm skills:info            # Show skill info
pnpm skills:remove          # Remove skill
pnpm skills:search          # Search skills
pnpm skills:create          # Create new skill
```

### Operations & Monitoring
```bash
pnpm monitor                # Start monitoring
pnpm monitor:watch          # Monitor with watch mode
pnpm deploy                 # Deploy application
```

### Master CLI ⭐
```bash
pnpm revealui               # Master CLI entry point
pnpm revealui --help        # Show all available CLIs
pnpm revealui <cli> <cmd>   # Route to specific CLI

# Examples:
pnpm revealui analyze quality --json
pnpm revealui maintain fix-imports --dry-run
pnpm revealui release preview
pnpm revealui db status
```

---

## 🎯 Quick Reference by Task

**Start Development:**
```bash
pnpm install:clean
pnpm dev
```

**Build for Production:**
```bash
pnpm lint
pnpm typecheck:all
pnpm test
pnpm build
```

**Code Quality Check:**
```bash
pnpm lint
pnpm typecheck:all
pnpm analyze:quality
pnpm validate:console
```

**Fix Common Issues:**
```bash
pnpm maintain:fix-imports --dry-run
pnpm maintain:fix-lint
pnpm lint:fix
```

**Database Setup:**
```bash
pnpm db:init
pnpm db:migrate
pnpm db:seed
```

**Release Process:**
```bash
pnpm release:preview
pnpm release:version patch
pnpm release:publish
```

---

## 📊 Statistics

- **Total Scripts**: 100+
- **CLI Categories**: 12 (analyze, maintain, release, build-cache, metrics, explore, db, setup, validate, workflow, skills, revealui)
- **New CLIs (Phase 1-4)**: maintain, analyze, release, build-cache, metrics, explore, revealui
- **Legacy Scripts**: Still supported for backward compatibility

---

## 🔍 Finding Scripts

**By Prefix:**
- `analyze:*` - Code analysis (NEW)
- `analysis:*` - Code analysis (legacy)
- `maintain:*` - Maintenance tasks (NEW)
- `fix:*` - Quick fixes (legacy)
- `release:*` - Release management (NEW)
- `build-cache:*` - Build cache (NEW)
- `metrics:*` - Metrics & analytics (NEW)
- `explore:*` - Script explorer (NEW)
- `db:*` - Database operations
- `test:*` - Testing
- `validate:*` - Validation
- `workflow:*` - Workflows
- `skills:*` - Skills
- `mcp:*` - MCP servers
- `docs:*` - Documentation
- `setup:*` - Setup tasks

**Master CLI:**
```bash
pnpm revealui --help        # List all CLIs
pnpm revealui <cli> --help  # Help for specific CLI
```

---

## 📚 Documentation

See [scripts/README.md](./scripts/README.md) for complete CLI documentation.

---

**Last Updated**: Phase 3 - Organizational Restructure
