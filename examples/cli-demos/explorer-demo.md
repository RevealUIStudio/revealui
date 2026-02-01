# Script Explorer Demo

Interactive script discovery and execution tool.

## What is the Explorer?

The script explorer helps you discover and run scripts across the monorepo:
- **Interactive menu**: Browse scripts by category
- **Search**: Find scripts by name or description
- **Quick execution**: Run scripts directly from the menu
- **Documentation**: See what each script does

## Quick Start

```bash
# Launch interactive explorer
pnpm explore

# List all available scripts
pnpm explore:list

# Search for specific scripts
pnpm explore:search build
```

## Demo Walkthrough

### Step 1: Launch Explorer

```bash
pnpm explore
```

**Expected Output:**
```
📦 RevealUI Script Explorer
===========================

Categories:
  1. Build & Development
  2. Code Quality
  3. Testing
  4. Database Operations
  5. Analysis & Metrics
  6. Maintenance & Fixes
  7. Release Management
  8. Validation
  9. Documentation

Select a category (1-9) or 'q' to quit:
```

### Step 2: Browse Build Scripts

**User input:** `1` (select Build & Development)

**Expected Output:**
```
📦 Build & Development Scripts
================================

Available scripts:
  1. build              - Build all packages (parallel)
  2. build:auth         - Build @revealui/auth
  3. build:cms          - Build CMS (with auth dependency)
  4. dev                - Start dev mode (with pre-hook)
  5. dev:cms            - Start CMS in dev mode
  6. clean              - Remove all build artifacts
  7. clean:install      - Clean + fresh install

Select a script (1-7), 'b' for back, or 'q' to quit:
```

### Step 3: Execute a Script

**User input:** `1` (select build)

**Expected Output:**
```
Running: pnpm build

⚡ Executing script...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@revealui/core:build: cache hit, replaying logs [1 cached, 1 total]
@revealui/auth:build: cache hit, replaying logs [2 cached, 2 total]
...
✅ Build completed in 12.3s

Press Enter to continue...
```

### Step 4: Search for Scripts

```bash
pnpm explore:search test
```

**Expected Output:**
```
🔍 Search Results for "test"
============================

Found 8 matching scripts:

  test                - Run all tests (parallel)
  test:coverage       - Run tests with coverage
  test:integration    - Run integration tests
  test:watch          - Run tests in watch mode
  db:setup-test       - Setup test database (Docker)
  validate:docs:test  - Run documentation tests

Run a script? Enter number (1-8) or 'q' to quit:
```

### Step 5: List All Scripts

```bash
pnpm explore:list
```

**Expected Output:**
```
📋 All Available Scripts
========================

Build & Development (7 scripts):
  • build, build:auth, build:cms
  • dev, dev:cms
  • clean, clean:install

Code Quality (5 scripts):
  • format, lint, lint:biome
  • lint:eslint, lint:fix

Testing (3 scripts):
  • test, test:coverage, test:integration

Database Operations (8 scripts):
  • db:init, db:migrate, db:reset
  • db:seed, db:backup, db:restore
  • db:status, db:setup-test

Analysis & Metrics (10 scripts):
  • analyze:quality, analyze:types
  • analyze:console, analyze:docs
  • metrics:summary, metrics:dashboard
  • dashboard, dashboard:watch
  • profile:build, profile:test

Maintenance & Fixes (8 scripts):
  • maintain:fix-imports, maintain:fix-lint
  • maintain:fix-types, maintain:clean
  • scripts:audit, scripts:validate
  • scripts:fix, scripts:health

Release Management (5 scripts):
  • release:preview, release:version
  • release:changelog, release:publish
  • release:tag

Validation (7 scripts):
  • validate:env, validate:docs
  • validate:pre-launch, validate:console
  • typecheck:all

Documentation (3 scripts):
  • docs:manage, docs:generate
  • docs:test

Total: 100+ scripts across 9 categories
```

## Advanced Usage

### Filter by Workspace

```bash
# Show only CMS scripts
pnpm explore --workspace apps/cms

# Show only package scripts
pnpm explore --workspace packages
```

### Recent Scripts

```bash
# Show recently used scripts
pnpm explore --recent

# Output:
# Recently Used:
#   1. test (2 minutes ago)
#   2. build (5 minutes ago)
#   3. lint (10 minutes ago)
```

### Favorite Scripts

```bash
# Mark scripts as favorites
pnpm explore:favorite add test
pnpm explore:favorite add build

# Show favorites
pnpm explore --favorites

# Output:
# ⭐ Favorite Scripts:
#   • test
#   • build
#   • lint
```

### JSON Output

```bash
# Get script list as JSON
pnpm explore:list --json

# Output:
{
  "categories": [
    {
      "name": "Build & Development",
      "scripts": [
        {
          "name": "build",
          "description": "Build all packages (parallel)",
          "command": "turbo run build --parallel"
        }
      ]
    }
  ]
}
```

## Use Cases

### New Developer Onboarding

A new developer joins the team:

```bash
# Day 1: Discover available commands
pnpm explore

# Browse through categories to learn what's available
# See descriptions and understand the workflow
```

**Benefits:**
- No need to read through package.json
- Organized by purpose
- Quick overview of capabilities

### Finding the Right Command

You need to run tests but can't remember the exact command:

```bash
pnpm explore:search test

# Results:
# test                - Run all tests
# test:coverage       - Run with coverage
# test:integration    - Integration tests only
```

**Faster than:**
- Searching through README
- Looking in package.json
- Asking teammates

### Daily Workflow

Common development workflow:

```bash
# Morning: Check what you need to run
pnpm explore --recent

# During dev: Quick access to common commands
pnpm explore --favorites

# Before commit: Run quality checks
# (explorer shows: lint, typecheck:all, test)
```

### Team Collaboration

Share common workflows:

```bash
# Export your favorites
pnpm explore:favorite export > my-workflow.json

# Share with team
# They import:
pnpm explore:favorite import my-workflow.json
```

## Keyboard Shortcuts

**In interactive mode:**
- `↑/↓` or `j/k` - Navigate up/down
- `Enter` - Select/execute
- `b` - Go back
- `q` - Quit
- `/` - Search
- `?` - Show help
- `f` - Toggle favorites view
- `r` - Show recent

## Tips & Tricks

### Quick Launch

```bash
# Set up shell alias
alias e='pnpm explore'

# Now just type:
e
```

### Command History

The explorer tracks execution history:
- Frequency of use
- Last execution time
- Success/failure rate
- Average duration

**View analytics:**
```bash
pnpm explore:stats

# Output:
# Most Used Scripts:
#   1. test (45 times, 98% success)
#   2. build (38 times, 100% success)
#   3. lint (32 times, 95% success)
```

### Integration with IDEs

**VS Code**: Add task to `.vscode/tasks.json`:
```json
{
  "label": "Open Script Explorer",
  "type": "shell",
  "command": "pnpm explore",
  "problemMatcher": []
}
```

**Keyboard shortcut**: Cmd/Ctrl+Shift+E

## Customization

### Custom Categories

Create `.explorer.config.json`:
```json
{
  "categories": [
    {
      "name": "My Workflow",
      "scripts": ["lint", "typecheck:all", "test", "build"]
    },
    {
      "name": "Database Tasks",
      "scripts": ["db:*"]
    }
  ],
  "theme": "dark",
  "defaultView": "favorites"
}
```

### Script Descriptions

Add descriptions in package.json:
```json
{
  "scripts": {
    "custom:task": "tsx scripts/custom.ts"
  },
  "script-descriptions": {
    "custom:task": "Does something amazing"
  }
}
```

## Troubleshooting

### Script Not Found

**Problem**: Explorer doesn't show a script you just added.

**Solution**: Refresh the script cache:
```bash
pnpm explore:refresh
```

### Interactive Mode Not Working

**Problem**: Menu doesn't respond to keyboard input.

**Solution**: Check terminal compatibility:
```bash
# Try non-interactive mode
pnpm explore:list

# Or use search
pnpm explore:search <term>
```

### Slow Performance

**Problem**: Explorer takes time to load.

**Solution**: Build script index:
```bash
pnpm explore:index

# Creates cached index for faster loading
```

## Best Practices

✅ **DO:**
- Use explorer for discovery
- Search when you know partial name
- Mark frequent scripts as favorites
- Share favorite lists with team
- Check recent before re-running

❌ **DON'T:**
- Memorize all 100+ commands
- Search README for script names
- Run wrong script by guessing
- Forget to refresh after adding scripts

## Next Steps

- [Dashboard Demo](./dashboard-demo.md) - Monitor performance
- [Profiling Demo](./profiling-demo.md) - Optimize slow scripts
- [Script Management](./script-management-demo.md) - Maintain scripts

---

**See also**: [Scripts Reference](../../SCRIPTS.md#script-explorer-)
