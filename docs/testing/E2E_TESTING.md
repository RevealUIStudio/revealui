# E2E Testing Guide

Comprehensive guide to end-to-end testing with Playwright for the RevealUI project.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Organization](#test-organization)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Debugging](#debugging)
- [CI Integration](#ci-integration)
- [Performance Testing](#performance-testing)

## Overview

E2E (End-to-End) tests verify complete user workflows from the browser perspective, testing the entire application stack including:

- Frontend UI and interactions
- API endpoints and responses
- Database operations
- Authentication flows
- Third-party integrations

### Why Playwright?

- **Cross-browser testing** - Chromium, Firefox, WebKit
- **Auto-wait** - Intelligent waiting for elements
- **Screenshots & videos** - Debug failures easily
- **Network interception** - Test error scenarios
- **Mobile emulation** - Test responsive designs
- **Fast & reliable** - Parallel execution, retry logic

## Setup

### Installation

Playwright is already installed. If setting up fresh:

```bash
pnpm add -D @playwright/test playwright
```

### Configuration

Configuration is in `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
```

### Browser Installation

Install browsers for testing:

```bash
pnpm exec playwright install
```

Install with system dependencies:

```bash
pnpm exec playwright install --with-deps
```

## Running Tests

### Run All Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI mode (visual debugger)
pnpm exec playwright test --ui

# Run in headed mode (see browser)
pnpm exec playwright test --headed
```

### Run Specific Tests

```bash
# Run single test file
pnpm exec playwright test e2e/auth.e2e.ts

# Run tests matching pattern
pnpm exec playwright test auth

# Run specific test by name
pnpm exec playwright test -g "should login with valid credentials"
```

### Run on Specific Browser

```bash
# Run on Chromium only
pnpm exec playwright test --project=chromium

# Run on Firefox
pnpm exec playwright test --project=firefox

# Run on mobile
pnpm exec playwright test --project=mobile-chrome
```

### Debug Mode

```bash
# Run in debug mode with inspector
pnpm exec playwright test --debug

# Debug specific test
pnpm exec playwright test auth.e2e.ts --debug
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/')
  })

  test('should perform action', async ({ page }) => {
    // Arrange
    await page.goto('/login')

    // Act
    await page.fill('input[name="email"]', 'test@example.com')
    await page.click('button[type="submit"]')

    // Assert
    await expect(page).toHaveURL(/dashboard/)
  })
})
```

### Using Test Helpers

```typescript
import { fillField, waitForNetworkIdle } from './utils/test-helpers'

test('should login', async ({ page }) => {
  await page.goto('/login')

  await fillField(page, 'input[name="email"]', 'test@example.com')
  await fillField(page, 'input[name="password"]', 'password123')
  await page.click('button[type="submit"]')

  await waitForNetworkIdle(page)

  await expect(page).toHaveURL(/dashboard/)
})
```

## Test Organization

### File Structure

```
e2e/
├── auth.e2e.ts                 # Authentication tests
├── user-flows.e2e.ts           # Critical user journeys
├── error-scenarios.e2e.ts      # Error handling tests
├── performance.e2e.ts          # Performance tests
├── utils/
│   └── test-helpers.ts         # Shared utilities
├── fixtures/
│   └── test-data.ts            # Test data
├── global-setup.ts             # Global setup
└── global-teardown.ts          # Global cleanup
```

### Test Categories

Organize tests by:

1. **Feature** - Group by application feature
2. **User Flow** - Group by complete user journey
3. **Error Scenario** - Group by error type
4. **Browser** - Separate mobile/desktop if needed

### Naming Conventions

```typescript
// File names: feature.e2e.ts
auth.e2e.ts
checkout.e2e.ts
search.e2e.ts

// Test names: should + action + expected result
test('should login with valid credentials', ...)
test('should show error for invalid email', ...)
test('should redirect to dashboard after signup', ...)
```

## Best Practices

### 1. Use Semantic Selectors

```typescript
// ✅ GOOD - Semantic, resilient
await page.click('button[type="submit"]')
await page.click('[aria-label="Close"]')
await page.click('text="Login"')

// ❌ BAD - Fragile, implementation-specific
await page.click('.btn-primary-xyz123')
await page.click('#submit-button-wrapper > button')
```

### 2. Auto-Waiting

Playwright auto-waits for elements. Don't add unnecessary waits:

```typescript
// ✅ GOOD - Playwright waits automatically
await page.click('button')

// ❌ BAD - Unnecessary timeout
await page.waitForTimeout(1000)
await page.click('button')
```

### 3. Assertions

Use explicit expectations:

```typescript
// ✅ GOOD - Clear expectations
await expect(page.locator('h1')).toHaveText('Dashboard')
await expect(page).toHaveURL(/dashboard/)
await expect(page.locator('.error')).toBeVisible()

// ❌ BAD - Vague checks
expect(await page.textContent('h1')).toBeTruthy()
```

### 4. Isolation

Keep tests independent:

```typescript
test.beforeEach(async ({ page }) => {
  // Clear state before each test
  await page.goto('/')
  await clearStorage(page)
})

test.afterEach(async ({ page }) => {
  // Clean up after each test
  await page.close()
})
```

### 5. Page Object Model (Optional)

For complex pages, use page objects:

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.fill('input[name="email"]', email)
    await this.page.fill('input[name="password"]', password)
    await this.page.click('button[type="submit"]')
  }

  async expectLoginSuccess() {
    await expect(this.page).toHaveURL(/dashboard/)
  }
}

// In test
const loginPage = new LoginPage(page)
await loginPage.login('test@example.com', 'password123')
await loginPage.expectLoginSuccess()
```

## Common Patterns

### Navigation

```typescript
// Navigate to page
await page.goto('/dashboard')

// Click and navigate
await Promise.all([
  page.waitForNavigation(),
  page.click('a[href="/settings"]'),
])

// Wait for URL
await page.waitForURL('**/dashboard')
```

### Form Handling

```typescript
// Fill form
await page.fill('input[name="email"]', 'test@example.com')
await page.fill('input[name="password"]', 'password123')

// Select dropdown
await page.selectOption('select[name="country"]', 'US')

// Check checkbox
await page.check('input[type="checkbox"]')

// Upload file
await page.setInputFiles('input[type="file"]', 'path/to/file.pdf')

// Submit form
await page.click('button[type="submit"]')
```

### Waiting Strategies

```typescript
// Wait for selector
await page.waitForSelector('.results')

// Wait for network idle
await page.waitForLoadState('networkidle')

// Wait for specific response
await page.waitForResponse((resp) =>
  resp.url().includes('/api/data')
)

// Wait for function
await page.waitForFunction(() =>
  document.querySelectorAll('.item').length > 5
)
```

### Network Interception

```typescript
// Mock API response
await page.route('**/api/users', (route) => {
  route.fulfill({
    status: 200,
    body: JSON.stringify([{ id: 1, name: 'Test User' }]),
  })
})

// Block resources
await page.route('**/*.{png,jpg,jpeg}', (route) => route.abort())

// Modify requests
await page.route('**/api/**', (route) => {
  const headers = { ...route.request().headers(), 'X-Custom': 'value' }
  route.continue({ headers })
})
```

### Screenshots & Videos

```typescript
// Take screenshot
await page.screenshot({ path: 'screenshot.png' })

// Screenshot specific element
await page.locator('.header').screenshot({ path: 'header.png' })

// Full page screenshot
await page.screenshot({ path: 'fullpage.png', fullPage: true })

// Video is automatic (configured in playwright.config.ts)
// Videos saved to test-results/ on failure
```

### Mobile Testing

```typescript
// Use mobile viewport
test.use({ viewport: { width: 375, height: 667 } })

test('should work on mobile', async ({ page }) => {
  await page.goto('/')

  // Test mobile-specific features
  const mobileMenu = page.locator('.mobile-menu')
  await expect(mobileMenu).toBeVisible()
})

// Or use device emulation
test.use({ ...devices['iPhone 12'] })
```

### Authentication State

```typescript
// Save authentication state
await page.context().storageState({ path: 'auth.json' })

// Reuse authentication state
test.use({ storageState: 'auth.json' })

test('should access protected route', async ({ page }) => {
  await page.goto('/dashboard')
  // Already authenticated
})
```

## Debugging

### Debug Tools

```bash
# Run with Playwright Inspector
pnpm exec playwright test --debug

# Run specific test in debug mode
pnpm exec playwright test auth --debug -g "should login"

# Open last HTML report
pnpm exec playwright show-report
```

### Console Logging

```typescript
// Log page console
page.on('console', (msg) => console.log('PAGE LOG:', msg.text()))

// Log network requests
page.on('request', (request) =>
  console.log('>>', request.method(), request.url())
)
page.on('response', (response) =>
  console.log('<<', response.status(), response.url())
)

// Log page errors
page.on('pageerror', (error) =>
  console.log('PAGE ERROR:', error.message)
)
```

### Trace Viewer

```typescript
// Traces are automatically captured on first retry
// View trace:
pnpm exec playwright show-trace trace.zip

// Or configure to always trace:
// playwright.config.ts
use: {
  trace: 'on', // Always capture trace
}
```

### Slow Motion

```typescript
// Slow down test execution
test.use({ launchOptions: { slowMo: 1000 } }) // 1 second delay

test('slow test', async ({ page }) => {
  await page.goto('/')
  // Each action delayed by 1 second
})
```

## CI Integration

### GitHub Actions

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - uses: pnpm/action-setup@v2

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Start application
        run: pnpm dev &
        env:
          PORT: 3000

      - name: Wait for server
        run: npx wait-on http://localhost:3000

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

      - name: Upload videos
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-videos
          path: test-results/
```

### Docker

```dockerfile
# Dockerfile.e2e
FROM mcr.microsoft.com/playwright:v1.58.0-jammy

WORKDIR /app

COPY package*.json ./
RUN pnpm install

COPY . .

CMD ["pnpm", "test:e2e"]
```

```bash
# Run in Docker
docker build -f Dockerfile.e2e -t revealui-e2e .
docker run revealui-e2e
```

## Performance Testing

### Performance Metrics

```typescript
import { checkPerformance } from './utils/test-helpers'

test('should meet performance budget', async ({ page }) => {
  await page.goto('/')

  const metrics = await checkPerformance(page, {
    domContentLoaded: 3000, // 3s max
    loadComplete: 5000, // 5s max
    firstPaint: 2000, // 2s max
  })

  console.log('Performance metrics:', metrics)
})
```

### Lighthouse Integration

```typescript
import { playAudit } from 'playwright-lighthouse'

test('should pass Lighthouse audit', async ({ page, context }) => {
  await page.goto('/')

  await playAudit({
    page,
    port: 9222,
    thresholds: {
      performance: 90,
      accessibility: 95,
      'best-practices': 90,
      seo: 90,
    },
  })
})
```

### Network Simulation

```typescript
import { simulateSlowNetwork } from './utils/test-helpers'

test('should work on slow network', async ({ page }) => {
  await simulateSlowNetwork(page)

  await page.goto('/')

  // Should still load within acceptable time
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })
})
```

## Troubleshooting

### Common Issues

**Tests timing out:**
```typescript
// Increase timeout
test.setTimeout(60000) // 60 seconds

// Or per-action timeout
await page.click('button', { timeout: 30000 })
```

**Flaky tests:**
```typescript
// Use built-in retry
test.describe.configure({ retries: 2 })

// Or wait for stable state
await page.waitForLoadState('networkidle')
await page.waitForLoadState('domcontentloaded')
```

**Element not found:**
```typescript
// Use more specific selectors
await page.locator('button:has-text("Submit")').click()

// Wait for element
await page.waitForSelector('button')

// Check if element exists
const count = await page.locator('button').count()
```

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Examples](https://github.com/microsoft/playwright/tree/main/examples)
- [Discord Community](https://aka.ms/playwright/discord)

## Test Examples

See example E2E tests in:

- `e2e/auth.e2e.ts` - Authentication flows (43 tests)
- `e2e/user-flows.e2e.ts` - Critical user journeys (25+ tests)
- `e2e/error-scenarios.e2e.ts` - Error handling (40+ tests)
- `e2e/utils/test-helpers.ts` - Reusable test utilities

---

**Last Updated**: February 2026
**Version**: 1.0.0
