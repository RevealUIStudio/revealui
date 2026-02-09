# E2E Testing Quick Start Guide

Get started with visual E2E testing in 5 minutes!

## 🚀 Quick Start

### 1. Install & Setup (1 minute)

```bash
# Install Playwright browsers
pnpm playwright:install

# Set up environment variables
export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/revealui_test"
export STRIPE_SECRET_KEY="sk_test_your_key_here"
```

### 2. Run Your First Test (1 minute)

```bash
# Run with visual UI (RECOMMENDED - easiest way to see what's happening)
pnpm test:e2e:ui

# Or run the complete flow example in headed mode
pnpm test:e2e:complete-flow
```

This will:
- ✅ Open Playwright's visual test runner
- ✅ Show you all available tests
- ✅ Let you watch tests run in real browser
- ✅ Provide time-travel debugging

### 3. View Results (1 minute)

After running tests, check the `test-results/` directory:

```bash
# View screenshots
open test-results/complete-flow/
open test-results/payments/

# View HTML report
pnpm test:e2e:report
```

## 🎯 What You Can Test

### Full-Stack Flows (Browser → API → Database)

```bash
# Test complete user journeys with database verification
pnpm test:e2e:fullstack

# Run in headed mode to watch
pnpm test:e2e:db:headed
```

**What it tests:**
- ✓ User signs up in browser
- ✓ API creates user record
- ✓ Verify user in database
- ✓ Screenshot at each step

### Payment Flows (Stripe Integration)

```bash
# Test Stripe payment processing
pnpm test:e2e:payments:headed
```

**What it tests:**
- ✓ Add items to cart
- ✓ Fill checkout form
- ✓ Enter Stripe test card
- ✓ Process payment
- ✓ Verify payment in database
- ✓ 11+ screenshots of entire flow

### Visual Regression Tests

```bash
# Test UI hasn't changed unexpectedly
pnpm test:e2e:visual

# Update snapshots when changes are intentional
pnpm test:e2e:visual:update
```

## 📸 Visual Inspection

Every test automatically captures:

1. **Screenshots** at every important step
2. **Videos** of the entire test (on failure)
3. **Traces** for debugging (use Playwright Inspector)
4. **Performance metrics** (load times, Core Web Vitals)
5. **Network activity** (all API calls logged)

### Where to Find Results

```
test-results/
├── complete-flow/          # Complete user journey screenshots
│   ├── step-01-homepage.png
│   ├── step-02-products-list.png
│   ├── step-08-payment-form.png
│   └── step-11-order-confirmation.png
├── payments/               # Payment flow screenshots
│   ├── 01-add-to-cart.png
│   ├── 05-payment-success.png
│   └── 11-order-refunded.png
└── full-stack/            # Full-stack test screenshots
    ├── user-registration-success.png
    └── post-creation-success.png
```

## 🎭 Interactive Testing (Best for Development)

### Playwright UI Mode (HIGHLY RECOMMENDED)

```bash
pnpm test:e2e:ui
```

**Features:**
- 👁️ Watch tests run in real browser
- ⏮️ Time-travel debugging (step backward/forward)
- 🔍 Inspect DOM at any point in test
- 📊 See network requests
- 🐛 Set breakpoints
- 📝 View console logs

### Debug Mode

```bash
pnpm test:e2e:debug
```

Opens Playwright Inspector where you can:
- Step through test line by line
- Pause at any point
- Inspect page state
- Try selectors in console

## 🔧 Running with MCP Servers

For AI-powered testing and verification:

```bash
# Start MCP servers and run tests
pnpm test:e2e:with-mcp

# With UI
pnpm test:e2e:with-mcp:ui

# In headed mode
pnpm test:e2e:with-mcp:headed
```

MCP servers provide:
- 🗄️ Database query verification
- 💳 Stripe payment verification
- 🤖 AI-powered test assistance

## 📝 Example: Complete E-commerce Flow

Watch a complete purchase from start to finish:

```bash
# Run the example flow (shows browser)
pnpm test:e2e:complete-flow
```

This test will:
1. ✅ Browse products
2. ✅ Add to cart
3. ✅ Fill checkout form
4. ✅ Enter payment details
5. ✅ Complete purchase
6. ✅ Verify in database
7. ✅ Capture 11+ screenshots
8. ✅ Check performance
9. ✅ Monitor network

**Duration:** ~60 seconds
**Screenshots:** 11
**Database verifications:** 3
**API calls monitored:** All

## 🐛 Debugging Failed Tests

When a test fails:

### 1. Check Screenshots

```bash
# Failed tests automatically capture screenshots
open test-results/[test-name]-failed.png
```

### 2. Watch Video

```bash
# Videos saved for failed tests
open test-results/videos/[test-name].webm
```

### 3. View Trace

```bash
# Most powerful debugging tool
npx playwright show-trace test-results/traces/trace.zip
```

The trace shows:
- Every action taken
- DOM snapshots at each step
- Network requests
- Console logs
- Screenshots timeline

### 4. Run in Debug Mode

```bash
# Step through test line by line
npx playwright test --debug [test-file].e2e.ts
```

## 📚 Next Steps

### Learn More

- Read full documentation: [e2e/README.md](./README.md)
- Check test examples: [e2e/example-complete-flow.e2e.ts](./example-complete-flow.e2e.ts)
- Explore test helpers: [e2e/utils/](./utils/)

### Write Your Own Tests

1. Copy example test: `e2e/example-complete-flow.e2e.ts`
2. Modify for your flow
3. Use helpers from `e2e/utils/`
4. Run with: `pnpm test:e2e:ui`

### Common Test Patterns

```typescript
// ✅ Full-stack test pattern
test('user action creates database record', async ({ page }) => {
  // 1. Browser action
  await page.fill('input', 'value')
  await page.click('button')

  // 2. Verify database
  const record = await waitForDbRecord(db, 'table', { column: 'field', value: 'expected' })
  expect(record).toBeTruthy()

  // 3. Visual verification
  await captureScreenshot(page, 'success-state')
})

// ✅ Payment test pattern
test('payment processes successfully', async ({ page }) => {
  // Fill Stripe Elements
  const stripe = page.frameLocator('iframe[name^="__privateStripeFrame"]')
  await stripe.locator('input[name="cardnumber"]').fill('4242424242424242')

  // Submit and verify
  await page.click('button[type="submit"]')
  await page.waitForURL(/success/)

  // Check database
  const payment = await db.getById('payments', paymentId)
  expect(payment.status).toBe('succeeded')
})
```

## 🆘 Getting Help

### Common Issues

**Tests timeout:**
```typescript
// Increase timeout
test.setTimeout(60000) // 60 seconds
```

**Can't find element:**
```bash
# Use UI mode to try selectors interactively
pnpm test:e2e:ui
```

**Database connection fails:**
```bash
# Check connection string
echo $TEST_DATABASE_URL

# Verify database is running
psql $TEST_DATABASE_URL -c "SELECT 1"
```

**Stripe tests fail:**
```bash
# Use test mode keys
export STRIPE_SECRET_KEY="sk_test_..."

# Verify test card works: 4242424242424242
```

### Resources

- 📖 [Full Documentation](./README.md)
- 🎭 [Playwright Docs](https://playwright.dev)
- 💬 Ask in team chat
- 🐛 Create issue in repo

## 🎯 Quick Command Reference

```bash
# Development
pnpm test:e2e:ui              # Visual UI (best for dev)
pnpm test:e2e:headed          # Watch browser
pnpm test:e2e:debug           # Step-by-step debugging

# Specific Tests
pnpm test:e2e:complete-flow   # Example flow
pnpm test:e2e:fullstack       # Database tests
pnpm test:e2e:payments        # Payment tests
pnpm test:e2e:visual          # Snapshot tests

# CI/CD
pnpm test:e2e                 # All tests (headless)
pnpm test:e2e:chromium        # Chrome only
pnpm test:e2e:firefox         # Firefox only

# Results
pnpm test:e2e:report          # View HTML report
```

## ✨ Pro Tips

1. **Always use UI mode during development** - you can see exactly what's happening
2. **Capture screenshots liberally** - they're invaluable for debugging
3. **Test database state** - don't just test the UI
4. **Use test cards for Stripe** - 4242424242424242 for success
5. **Check traces for failures** - they show everything that happened
6. **Run in headed mode** to understand test flow
7. **Use MCP servers** for enhanced verification

---

**Ready to test?** Start with: `pnpm test:e2e:ui` 🚀

Happy Testing! 🎉
