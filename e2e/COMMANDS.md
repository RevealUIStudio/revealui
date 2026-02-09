# E2E Testing Commands Quick Reference

## 🚀 Quick Start

```bash
# Best way to start - visual UI
pnpm test:e2e:ui

# Watch complete flow example
pnpm test:e2e:complete-flow

# Run all tests
pnpm test:e2e
```

## 🧪 Test Suites

```bash
# Full-stack tests (Browser → API → Database)
pnpm test:e2e:fullstack
pnpm test:e2e:db
pnpm test:e2e:db:headed

# Payment flows (Stripe integration)
pnpm test:e2e:payments
pnpm test:e2e:payments:headed

# Visual regression
pnpm test:e2e:visual
pnpm test:e2e:visual:update

# Authentication
pnpm playwright test auth.e2e.ts

# User flows
pnpm playwright test user-flows.e2e.ts
```

## 🎭 Test Modes

```bash
# Visual UI (time-travel debugging)
pnpm test:e2e:ui

# Headed (watch browser)
pnpm test:e2e:headed

# Debug (step by step)
pnpm test:e2e:debug

# Headless (CI mode)
pnpm test:e2e
```

## 🌐 Browser-Specific

```bash
# Chrome
pnpm test:e2e:chromium

# Firefox
pnpm test:e2e:firefox

# Safari
pnpm test:e2e:webkit

# Mobile Chrome
pnpm test:e2e:mobile
```

## 📡 With MCP Servers

```bash
# All MCP servers
pnpm test:e2e:with-mcp
pnpm test:e2e:with-mcp:ui
pnpm test:e2e:with-mcp:headed

# Start MCP servers separately
pnpm mcp:all
pnpm mcp:neon
pnpm mcp:stripe
pnpm mcp:playwright
```

## 📊 Reports & Results

```bash
# View HTML report
pnpm test:e2e:report

# View trace (for debugging)
npx playwright show-trace test-results/traces/trace.zip

# View screenshots
open test-results/complete-flow/
open test-results/payments/
```

## 🔧 Specific Tests

```bash
# Run specific file
pnpm playwright test full-stack-flows.e2e.ts
pnpm playwright test payment-flows.e2e.ts

# Run specific test
pnpm playwright test -g "should create user in database"

# Run in specific browser
pnpm playwright test --project=chromium full-stack-flows.e2e.ts
```

## 🐛 Debugging

```bash
# Debug mode (Playwright Inspector)
pnpm test:e2e:debug

# Headed + slow motion
pnpm playwright test --headed --slow-mo=1000

# Update snapshots
pnpm test:e2e:visual:update

# Show trace from failed test
npx playwright show-trace test-results/traces/[test-name].zip
```

## 🔥 Advanced

```bash
# Specific test with grep
pnpm playwright test -g "payment.*success"

# Run only failed tests
pnpm playwright test --last-failed

# Maximum workers
pnpm playwright test --workers=4

# Timeout override
pnpm playwright test --timeout=60000

# Retry failed tests
pnpm playwright test --retries=2
```

## 📝 Common Patterns

### Run and watch specific test
```bash
pnpm test:e2e:ui
# Then select the test in UI
```

### Debug failing test
```bash
# 1. Run with debug
pnpm playwright test --debug failing-test.e2e.ts

# 2. Or view trace
npx playwright show-trace test-results/traces/trace.zip
```

### Update visual snapshots
```bash
pnpm test:e2e:visual:update
```

### Run in Docker (CI)
```bash
docker run -v $(pwd):/work -w /work mcr.microsoft.com/playwright:latest pnpm test:e2e
```

## 🎯 Recommended Workflow

### Development
```bash
# 1. Start with UI mode
pnpm test:e2e:ui

# 2. Write/debug tests interactively
# 3. Run specific tests as needed
```

### Before Commit
```bash
# Run all E2E tests
pnpm test:e2e

# Or run full-stack + payments
pnpm test:e2e:fullstack
```

### CI/CD
```bash
# Headless mode with retries
pnpm playwright test --retries=2
```

## 💡 Tips

- Use `test:e2e:ui` for development (best experience)
- Use `test:e2e:headed` to watch browser
- Use `test:e2e:debug` to step through tests
- Check `test-results/` for screenshots
- Use traces for debugging failures
- Run with MCP for enhanced verification

## 📚 Documentation

- Quick Start: [QUICKSTART.md](./QUICKSTART.md)
- Full Docs: [README.md](./README.md)
- Setup Info: [E2E_SETUP_COMPLETE.md](./E2E_SETUP_COMPLETE.md)
- Examples: [example-complete-flow.e2e.ts](./example-complete-flow.e2e.ts)
