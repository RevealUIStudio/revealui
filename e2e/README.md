# E2E Testing Guide

Comprehensive end-to-end testing for RevealUI with full-stack verification from browser interactions through API calls to database operations.

## 🎯 Overview

Our E2E test suite provides:

- **Full-Stack Testing**: Browser → API → Database verification
- **Visual Inspection**: Screenshots, videos, and traces for every test
- **Payment Testing**: Complete Stripe integration testing
- **MCP Integration**: Database and service verification using MCP servers
- **Real-time Monitoring**: Performance metrics and network activity
- **Automated Workflows**: CI/CD ready with comprehensive reporting

## 📁 Test Structure

```
e2e/
├── README.md                    # This file
├── auth.e2e.ts                  # Authentication flows
├── user-flows.e2e.ts            # General user journeys
├── full-stack-flows.e2e.ts      # Browser → API → Database tests
├── payment-flows.e2e.ts         # Stripe payment processing
├── visual-snapshots.e2e.ts      # Visual regression tests
├── error-scenarios.e2e.ts       # Error handling
├── global-setup.ts              # Test initialization
├── global-teardown.ts           # Test cleanup
└── utils/
    ├── test-helpers.ts          # Common test utilities
    ├── db-helpers.ts            # Database testing utilities
    └── visual-helpers.ts        # Visual inspection utilities
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install Playwright browsers
pnpm playwright:install

# Or with system dependencies
playwright install --with-deps
```

### 2. Set Up Environment

```bash
# Copy environment template
cp .env.template .env

# Configure test database
export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/revealui_test"

# Configure Stripe test keys
export STRIPE_SECRET_KEY="sk_test_..."
export STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

### 3. Run Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run with visual UI (recommended for development)
pnpm test:e2e:ui

# Run in headed mode (see browser)
pnpm test:e2e:headed

# Run in debug mode
pnpm test:e2e:debug

# Run specific test file
pnpm playwright test e2e/full-stack-flows.e2e.ts

# Run with specific browser
pnpm test:e2e:chromium
pnpm test:e2e:firefox
pnpm test:e2e:webkit
```

## 🎭 Test Categories

### Authentication Tests (`auth.e2e.ts`)

Tests user authentication flows:

```bash
# Run auth tests
pnpm test:e2e auth.e2e.ts

# Tests include:
# - Login/logout
# - Registration
# - Password reset
# - Session management
# - Security checks
```

### Full-Stack Tests (`full-stack-flows.e2e.ts`)

Complete integration tests verifying browser → API → database:

```bash
# Run full-stack tests
pnpm playwright test full-stack-flows.e2e.ts

# Test flows:
# - User registration with DB verification
# - Content creation and storage
# - Data updates and synchronization
# - Deletion with cascade effects
# - Search/filter matching database queries
# - Pagination consistency
# - Real-time updates
# - Transaction rollbacks
```

**Example Test:**
```typescript
test('should create user in database when signing up', async ({ page }) => {
  // 1. Fill signup form in browser
  await page.goto('/signup')
  await fillField(page, 'input[name="email"]', testEmail)

  // 2. Submit and wait for API
  await page.click('button[type="submit"]')

  // 3. Verify database record created
  const user = await waitForDbRecord(db, 'users', {
    column: 'email',
    value: testEmail
  })

  expect(user).toBeTruthy()

  // 4. Visual verification
  await page.screenshot({ path: 'test-results/signup-success.png' })
})
```

### Payment Tests (`payment-flows.e2e.ts`)

Complete Stripe payment integration tests:

```bash
# Run payment tests
pnpm playwright test payment-flows.e2e.ts

# Test scenarios:
# - Checkout flow with Stripe Elements
# - Successful payment processing
# - Payment failures and errors
# - Subscription management
# - Refunds
# - Webhook processing
# - Saved payment methods
```

**Visual Output:**
Each payment test generates screenshots at every step:
- `01-add-to-cart.png`
- `02-checkout-form-filled.png`
- `03-stripe-payment-form.png`
- `04-payment-details-filled.png`
- `05-payment-success.png`

### Visual Snapshot Tests (`visual-snapshots.e2e.ts`)

Visual regression testing across:

```bash
# Run visual tests
pnpm test:e2e:visual

# Update snapshots when intentional changes made
pnpm test:e2e:visual:update

# Test coverage:
# - Multiple viewports (mobile, tablet, desktop)
# - Dark/light themes
# - Cross-browser consistency
# - High contrast mode
# - Component-level snapshots
```

## 🗄️ Database Testing

### Using Database Helpers

```typescript
import { createTestDb, waitForDbRecord } from './utils/db-helpers'

// Initialize database connection
const db = createTestDb()
await db.connect()

// Query data
const users = await db.getAll('users')

// Insert test data
const user = await db.insert('users', {
  email: 'test@example.com',
  name: 'Test User'
})

// Wait for async operations
const record = await waitForDbRecord(db, 'posts', {
  column: 'user_id',
  value: user.id
})

// Clean up
await cleanupTestData(db, 'users', { column: 'email', value: testEmail })
await db.disconnect()
```

### Database Verification Patterns

**1. Wait for Record Creation:**
```typescript
// User action in browser
await page.click('button[type="submit"]')

// Verify database update
const newRecord = await waitForDbRecord(db, 'table_name', {
  column: 'field',
  value: expectedValue
}, 5000) // 5 second timeout

expect(newRecord).toBeTruthy()
```

**2. Verify Data Updates:**
```typescript
// Update action
await page.fill('input[name="title"]', 'New Title')
await page.click('button:has-text("Save")')

// Verify database reflects change
const updated = await waitForDbUpdate(db, 'posts', postId, {
  title: 'New Title'
})

expect(updated).toBeTruthy()
```

**3. Transaction Testing:**
```typescript
// Begin transaction
await db.beginTransaction()

try {
  // Perform operations
  await db.insert('users', userData)
  await db.insert('profiles', profileData)

  // Commit if successful
  await db.commit()
} catch (error) {
  // Rollback on error
  await db.rollback()
}
```

## 📸 Visual Inspection

### Capturing Screenshots

```typescript
import { captureScreenshot, captureElement } from './utils/visual-helpers'

// Full page screenshot
await captureScreenshot(page, 'checkout-page', {
  fullPage: true,
  description: 'User at checkout',
  category: 'payments'
})

// Element screenshot
await captureElement(page, '.payment-form', 'stripe-form')

// Annotated screenshot
await captureAnnotated(page, 'form-validation', [
  { selector: '#email-error', label: 'Email validation error' },
  { selector: '#password-error', label: 'Password too short' }
])
```

### Recording User Flows

```typescript
import { recordUserFlow } from './utils/visual-helpers'

await recordUserFlow(page, 'complete-purchase', async () => {
  await page.goto('/products/test-product')
  await page.click('button:has-text("Add to Cart")')
  await page.click('a[href="/checkout"]')
  // ... complete checkout
})
```

### Performance Monitoring

```typescript
import { collectPerformanceMetrics } from './utils/visual-helpers'

await page.goto('/')
const metrics = await collectPerformanceMetrics(page)

console.log('Performance Metrics:', {
  domContentLoaded: metrics.domContentLoaded,
  loadComplete: metrics.loadComplete,
  firstPaint: metrics.firstPaint,
  firstContentfulPaint: metrics.firstContentfulPaint
})

// Assert performance budget
expect(metrics.domContentLoaded).toBeLessThan(3000)
```

## 🔧 MCP Server Integration

MCP (Model Context Protocol) servers enable AI-powered testing and verification.

### Available MCP Servers

1. **Neon Database MCP** - Database operations and verification
2. **Stripe MCP** - Payment testing and webhook simulation
3. **Playwright MCP** - Enhanced browser automation
4. **Supabase MCP** - Backend service testing
5. **Next.js DevTools MCP** - Framework-specific testing

### Starting MCP Servers

```bash
# Start individual servers
pnpm mcp:neon
pnpm mcp:stripe
pnpm mcp:playwright

# Start all MCP servers
pnpm mcp:all
```

### Using MCP Servers in Tests

MCP servers run in the background and can be called via API:

```typescript
// Example: Verify Stripe payment using MCP
const stripeResponse = await page.request.post('http://localhost:3000/mcp/stripe/verify', {
  data: { paymentIntentId: 'pi_xxx' }
})

// Example: Query database via MCP
const dbResponse = await page.request.post('http://localhost:3000/mcp/neon/query', {
  data: {
    sql: 'SELECT * FROM orders WHERE id = $1',
    params: [orderId]
  }
})
```

## 📊 Test Results and Reports

### Generated Artifacts

After running tests, find results in:

```
test-results/
├── full-stack/           # Full-stack test screenshots
│   ├── user-registration-success.png
│   ├── post-creation-success.png
│   └── search-results.png
├── payments/             # Payment flow screenshots
│   ├── 01-add-to-cart.png
│   ├── 02-checkout-form-filled.png
│   └── 05-payment-success.png
├── screenshots/          # General screenshots
├── videos/               # Test recordings
├── traces/               # Playwright traces
├── errors/               # Error captures
└── reports/              # JSON reports

playwright-report/        # HTML report
├── index.html           # View in browser
└── results.json         # Machine-readable results
```

### Viewing Reports

```bash
# Open HTML report
pnpm test:e2e:report

# View trace files (for debugging failures)
npx playwright show-trace test-results/traces/trace.zip
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run E2E Tests
  run: pnpm test:e2e
  env:
    TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}

- name: Upload Test Results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/

- name: Upload Screenshots
  uses: actions/upload-artifact@v3
  if: failure()
  with:
    name: test-screenshots
    path: test-results/
```

## 🐛 Debugging Tests

### Debug Mode

```bash
# Run with Playwright Inspector
pnpm test:e2e:debug

# Debug specific test
npx playwright test --debug full-stack-flows.e2e.ts

# Set breakpoints in test code
await page.pause() // Pauses test execution
```

### Headed Mode

```bash
# See browser while tests run
pnpm test:e2e:headed

# Slow down execution
npx playwright test --headed --slow-mo=1000
```

### UI Mode (Recommended)

```bash
# Interactive test runner with time travel debugging
pnpm test:e2e:ui

# Features:
# - Watch mode
# - Time travel debugging
# - Source code view
# - Network inspector
# - Console logs
```

### Inspecting Failures

When a test fails:

1. **Check Screenshots**: `test-results/[test-name]-failed.png`
2. **Watch Video**: Videos are saved for failed tests
3. **View Trace**: `npx playwright show-trace trace.zip`
4. **Check Console**: Console logs are captured in reports

## 🎨 Visual Testing Tips

### Best Practices

1. **Use Stable Selectors**
   ```typescript
   // Good
   page.locator('[data-testid="submit-button"]')
   page.locator('button[type="submit"]')

   // Avoid
   page.locator('.btn-primary.btn-lg')
   ```

2. **Mask Dynamic Content**
   ```typescript
   await compareSnapshot(page, 'dashboard', {
     mask: ['[data-testid="timestamp"]', 'time', '.live-counter']
   })
   ```

3. **Wait for Stability**
   ```typescript
   await page.waitForLoadState('networkidle')
   await page.waitForSelector('.content', { state: 'visible' })
   ```

4. **Capture at Key Moments**
   ```typescript
   // Before action
   await captureScreenshot(page, 'before-submit')

   // After action
   await page.click('button')
   await captureScreenshot(page, 'after-submit')
   ```

## 🔐 Security Testing

### Authentication Tests

```typescript
// Test session persistence
test('should maintain session across page reloads', async ({ page }) => {
  await login(page, 'user@example.com', 'password')
  await page.reload()
  await expect(page).not.toHaveURL(/\/login/)
})

// Test protected routes
test('should redirect to login when not authenticated', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})
```

### CSRF Protection

```typescript
test('should include CSRF token in forms', async ({ page }) => {
  await page.goto('/form')
  const csrf = await page.locator('input[name="_csrf"]')
  await expect(csrf).toHaveValue(/.+/)
})
```

## 📈 Performance Testing

### Setting Performance Budgets

```typescript
import { checkPerformance } from './utils/test-helpers'

test('should meet performance budget', async ({ page }) => {
  await page.goto('/')

  await checkPerformance(page, {
    domContentLoaded: 3000,  // 3 seconds max
    loadComplete: 5000,       // 5 seconds max
    firstPaint: 2000,         // 2 seconds max
  })
})
```

### Core Web Vitals

```typescript
import { captureCoreWebVitals } from './utils/visual-helpers'

const vitals = await captureCoreWebVitals(page)

expect(vitals.LCP).toBeLessThan(2500)  // Good LCP
expect(vitals.FID).toBeLessThan(100)   // Good FID
expect(vitals.CLS).toBeLessThan(0.1)   // Good CLS
```

## 🤝 Contributing

### Adding New Tests

1. Create test file in `e2e/` directory
2. Use existing helpers from `utils/`
3. Follow naming convention: `feature-name.e2e.ts`
4. Add visual captures at key points
5. Update this README with new test documentation

### Test Template

```typescript
import { expect, test } from '@playwright/test'
import { createTestDb } from './utils/db-helpers'
import { captureScreenshot } from './utils/visual-helpers'

test.describe('Feature Name', () => {
  let db: DbTestHelper

  test.beforeAll(async () => {
    db = createTestDb()
    await db.connect()
  })

  test.afterAll(async () => {
    await db.disconnect()
  })

  test('should do something', async ({ page }) => {
    // 1. Navigate
    await page.goto('/page')

    // 2. Take initial screenshot
    await captureScreenshot(page, 'initial-state')

    // 3. Perform action
    await page.click('button')

    // 4. Verify UI
    await expect(page.locator('.success')).toBeVisible()

    // 5. Verify database
    const record = await db.getById('table', id)
    expect(record).toBeTruthy()

    // 6. Capture final state
    await captureScreenshot(page, 'final-state')
  })
})
```

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Visual Testing Guide](https://playwright.dev/docs/test-snapshots)
- [Debugging Tests](https://playwright.dev/docs/debug)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [MCP Protocol](https://modelcontextprotocol.io)

## 🆘 Troubleshooting

### Common Issues

**Tests timing out:**
```typescript
// Increase timeout for slow operations
test.setTimeout(60000) // 60 seconds
await page.goto('/', { timeout: 30000 })
```

**Database connection errors:**
```bash
# Verify DATABASE_URL is set
echo $TEST_DATABASE_URL

# Check database is running
psql $TEST_DATABASE_URL -c "SELECT 1"
```

**Stripe tests failing:**
```bash
# Use Stripe test mode keys
export STRIPE_SECRET_KEY="sk_test_..."

# Verify test cards work
# 4242424242424242 - Success
# 4000000000000002 - Decline
```

**Screenshots not captured:**
```bash
# Ensure directories exist
mkdir -p test-results/{full-stack,payments,screenshots}

# Check Playwright config
# screenshot: 'only-on-failure' or 'on'
```

## 📧 Support

For issues or questions:
- Create an issue in the repository
- Check existing test examples
- Review Playwright documentation
- Ask in team chat

---

**Happy Testing! 🎉**

Remember: Good tests are visual, comprehensive, and easy to debug!
