# CLI Demos

Hands-on tutorials for RevealUI's developer tools and CLIs.

## Available Demos

### 🎯 [Script Management Demo](./script-management-demo.md)
**What you'll learn:**
- Audit package.json scripts for duplicates and inconsistencies
- Validate scripts against standardized templates
- Auto-fix missing scripts across all packages
- Maintain script standards in a monorepo

**Time:** 10 minutes
**Use when:** Setting up new packages, ensuring consistency, cleaning up scripts

**Key commands:**
```bash
pnpm scripts:audit          # Find duplicates
pnpm scripts:validate       # Check compliance
pnpm scripts:fix:apply      # Auto-fix issues
pnpm scripts:health         # Full health check
```

---

### 📊 [Dashboard Demo](./dashboard-demo.md)
**What you'll learn:**
- Monitor system performance in real-time
- View telemetry data and script analytics
- Track cache performance and hit rates
- Generate HTML performance reports

**Time:** 5 minutes
**Use when:** Checking system health, debugging performance, monitoring builds

**Key commands:**
```bash
pnpm dashboard              # Interactive dashboard
pnpm dashboard:watch        # Auto-refresh mode
pnpm dashboard:summary      # Quick overview
pnpm dashboard:report       # HTML report
```

---

### 🔍 [Explorer Demo](./explorer-demo.md)
**What you'll learn:**
- Discover available scripts interactively
- Search for commands by name or purpose
- Execute scripts directly from the menu
- Organize scripts into favorites

**Time:** 5 minutes
**Use when:** Learning the codebase, finding the right command, onboarding new developers

**Key commands:**
```bash
pnpm explore                # Interactive menu
pnpm explore:list           # List all scripts
pnpm explore:search test    # Search for scripts
```

---

### ⚡ [Profiling Demo](./profiling-demo.md)
**What you'll learn:**
- Identify build and test performance bottlenecks
- Compare different approaches (e.g., tsc vs swc)
- Run benchmarks and track performance over time
- Detect performance regressions

**Time:** 15 minutes
**Use when:** Optimizing builds, debugging slow tests, evaluating tool changes

**Key commands:**
```bash
pnpm profile:build          # Profile build performance
pnpm profile:test           # Profile test execution
pnpm profile:compare        # Compare two commands
pnpm profile:benchmark      # Run benchmarks
```

---

### 🛠️ [Maintenance Demo](./maintenance-demo.md)
**What you'll learn:**
- Auto-fix import extensions for ESM compatibility
- Fix linting and TypeScript errors automatically
- Validate and fix package.json scripts
- Clean generated files and caches

**Time:** 10 minutes
**Use when:** After pulling changes, before releases, fixing CI failures

**Key commands:**
```bash
pnpm maintain:fix-imports   # Fix import extensions
pnpm maintain:fix-lint      # Auto-fix linting
pnpm maintain:validate-scripts  # Check scripts
pnpm maintain:clean         # Remove build artifacts
```

---

## Demo Workflows

### For New Developers

**Day 1: Getting Oriented**
1. [Explorer Demo](./explorer-demo.md) - Discover available commands
2. [Dashboard Demo](./dashboard-demo.md) - Understand system health
3. [Script Management Demo](./script-management-demo.md) - Learn script standards

**Time:** 20 minutes
**Outcome:** Understand the development environment and available tools

### For Performance Optimization

**Finding and Fixing Bottlenecks**
1. [Dashboard Demo](./dashboard-demo.md) - Identify slow areas
2. [Profiling Demo](./profiling-demo.md) - Deep-dive into bottlenecks
3. [Maintenance Demo](./maintenance-demo.md) - Apply fixes

**Time:** 30 minutes
**Outcome:** Faster builds and tests

### For Release Preparation

**Pre-Release Checklist**
1. [Maintenance Demo](./maintenance-demo.md) - Fix all issues
2. [Script Management Demo](./script-management-demo.md) - Validate standards
3. [Profiling Demo](./profiling-demo.md) - Benchmark performance

**Time:** 25 minutes
**Outcome:** Clean, validated, performant release

### For CI/CD Setup

**Setting Up Quality Gates**
1. [Script Management Demo](./script-management-demo.md) - Script validation
2. [Maintenance Demo](./maintenance-demo.md) - Auto-fix in CI
3. [Profiling Demo](./profiling-demo.md) - Performance regression detection

**Time:** 20 minutes
**Outcome:** Automated quality checks in CI

---

## Quick Reference

### Most Useful Commands by Task

**Need to find a command?**
→ `pnpm explore` - [Explorer Demo](./explorer-demo.md)

**Build too slow?**
→ `pnpm profile:build` - [Profiling Demo](./profiling-demo.md)

**Tests too slow?**
→ `pnpm profile:test` - [Profiling Demo](./profiling-demo.md)

**Package scripts inconsistent?**
→ `pnpm scripts:validate` - [Script Management Demo](./script-management-demo.md)

**Linting errors?**
→ `pnpm maintain:fix-lint` - [Maintenance Demo](./maintenance-demo.md)

**Import errors?**
→ `pnpm maintain:fix-imports` - [Maintenance Demo](./maintenance-demo.md)

**System health check?**
→ `pnpm dashboard:summary` - [Dashboard Demo](./dashboard-demo.md)

**Performance regression?**
→ `pnpm profile:compare` - [Profiling Demo](./profiling-demo.md)

---

## Learning Path

### Beginner (Day 1)
1. ✅ [Explorer Demo](./explorer-demo.md) - Learn to navigate
2. ✅ [Dashboard Demo](./dashboard-demo.md) - Monitor basics
3. ✅ [Script Management Demo](./script-management-demo.md) - Understand standards

### Intermediate (Week 1)
1. ✅ [Maintenance Demo](./maintenance-demo.md) - Fix common issues
2. ✅ [Profiling Demo](./profiling-demo.md) - Basic optimization

### Advanced (Month 1)
1. ✅ Deep profiling workflows
2. ✅ Custom script templates
3. ✅ CI/CD integration

---

## Tips for Using Demos

### Try It Yourself
All demos include runnable examples. Open your terminal and follow along:
```bash
cd /path/to/revealui
# Then run commands from any demo
```

### Expected Outputs
Each demo shows expected outputs so you know what success looks like.

### Real-World Scenarios
Demos include practical scenarios you'll encounter in daily development.

### Troubleshooting
Each demo has a troubleshooting section for common issues.

---

## Additional Resources

- **[Script Standards](../../scripts/STANDARDS.md)** - Complete reference for package.json standards
- **[Scripts Reference](../../SCRIPTS.md)** - All 100+ available commands
- **[Contributing Guide](../../CONTRIBUTING.md)** - How to contribute
- **[Quick Start Guide](../../docs/QUICK_START.md)** - Get started with RevealUI

---

## Feedback

Found an issue with a demo? Have suggestions for improvements?

- 🐛 [Report an issue](https://github.com/RevealUIStudio/revealui/issues)
- 💬 [Discuss in community](https://github.com/RevealUIStudio/revealui/discussions)
- 📧 [Email the team](mailto:support@revealui.com)

---

**Last Updated:** Phase 6 - Documentation & Polish
**Maintained By:** RevealUI Team
