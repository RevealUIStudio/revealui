# Visual Snapshot Testing Guide

This guide explains how to use Playwright's visual snapshot testing in the RevealUI project to catch visual regressions and ensure UI consistency.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Running Visual Snapshot Tests](#running-visual-snapshot-tests)
- [Creating Visual Snapshots](#creating-visual-snapshots)
- [Updating Snapshots](#updating-snapshots)
- [Best Practices](#best-practices)
- [Configuration](#configuration)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

Visual snapshot testing captures screenshots of your UI and compares them against baseline images. When visual changes occur, tests fail and show a visual diff, making it easy to catch:

- Unintended CSS changes
- Layout shifts
- Color palette changes
- Font rendering issues
- Responsive design breakpoints
- Cross-browser rendering differences

## Quick Start

### 1. Run existing visual tests

```bash
pnpm test:e2e:visual
```

### 2. Generate initial baseline snapshots

```bash
pnpm test:e2e:visual:update
```

### 3. View test results and diffs

```bash
pnpm test:e2e:report
```

## Running Visual Snapshot Tests

### Run all visual tests

```bash
pnpm test:e2e:visual
```

### Run visual tests for specific browser

```bash
pnpm test:e2e:visual:chromium
```

### Run in UI mode (recommended for development)

```bash
pnpm test:e2e:ui
```

Then filter for "visual-snapshots" in the UI.

### Run in debug mode

```bash
pnpm test:e2e:debug visual-snapshots.e2e.ts
```

## Creating Visual Snapshots

### Basic Page Snapshot

```typescript
import { expect, test } from '@playwright/test'

test('my page should match snapshot', async ({ page }) => {
  await page.goto('/my-page')
  await page.waitForLoadState('networkidle')

  // Full page snapshot
  await expect(page).toHaveScreenshot('my-page.png', {
    fullPage: true,
  })
})
```

### Component Snapshot

```typescript
test('button component should match snapshot', async ({ page }) => {
  await page.goto('/components')

  // Snapshot specific element
  const button = page.locator('[data-testid="submit-button"]')
  await expect(button).toHaveScreenshot('submit-button.png')
})
```

### Responsive Snapshots

```typescript
test('mobile view should match snapshot', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/my-page')

  await expect(page).toHaveScreenshot('my-page-mobile.png', {
    fullPage: true,
  })
})
```

### State-Based Snapshots

```typescript
test('hover state should match snapshot', async ({ page }) => {
  await page.goto('/my-page')

  const button = page.locator('button')
  await button.hover()
  await page.waitForTimeout(100) // Wait for hover styles

  await expect(button).toHaveScreenshot('button-hover.png')
})
```

### Masked Snapshots (Hide Dynamic Content)

```typescript
test('page with masked dynamic content', async ({ page }) => {
  await page.goto('/dashboard')

  await expect(page).toHaveScreenshot('dashboard.png', {
    mask: [
      page.locator('[data-testid="timestamp"]'),
      page.locator('[data-testid="user-avatar"]'),
      page.locator('time'),
    ],
  })
})
```

### Dark Mode Snapshots

```typescript
test('dark mode should match snapshot', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/my-page')

  await expect(page).toHaveScreenshot('my-page-dark.png', {
    fullPage: true,
  })
})
```

## Updating Snapshots

### When to Update Snapshots

Update snapshots when you have **intentionally** changed the UI:

- Updated CSS styles
- Changed component layouts
- Modified colors or typography
- Added/removed UI elements

### Update All Snapshots

```bash
pnpm test:e2e:visual:update
```

### Update Snapshots for Specific Browser

```bash
pnpm test:e2e:visual:update:chromium
```

### Update Specific Test Snapshots

```bash
playwright test visual-snapshots.e2e.ts --grep "login page" --update-snapshots
```

### Interactive Update (Recommended)

Use UI mode to review and selectively update snapshots:

```bash
pnpm test:e2e:ui
```

1. Run the failing test
2. Review the diff
3. Click "Update snapshot" if the change is intentional

## Best Practices

### 1. Wait for Content to Load

Always wait for network idle and dynamic content:

```typescript
await page.goto('/my-page')
await page.waitForLoadState('networkidle')
await page.waitForSelector('[data-testid="main-content"]')
```

### 2. Disable Animations

Animations are disabled by default in config, but you can override per-test:

```typescript
await expect(page).toHaveScreenshot('page.png', {
  animations: 'disabled', // or 'allow'
})
```

### 3. Mask Dynamic Content

Always mask timestamps, user-specific data, random IDs:

```typescript
await expect(page).toHaveScreenshot('page.png', {
  mask: [
    page.locator('time'),
    page.locator('[data-testid="random-id"]'),
  ],
})
```

### 4. Use Descriptive Snapshot Names

```typescript
// Good
await expect(page).toHaveScreenshot('login-form-with-errors.png')

// Bad
await expect(page).toHaveScreenshot('test.png')
```

### 5. Test Multiple Viewports

Create separate tests for mobile, tablet, desktop:

```typescript
test.describe('Responsive snapshots', () => {
  test('mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    // ... snapshot
  })

  test('desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    // ... snapshot
  })
})
```

### 6. Organize Snapshots by Feature

Group related snapshots in describe blocks:

```typescript
test.describe('Authentication Pages', () => {
  test('login page', async ({ page }) => { ... })
  test('signup page', async ({ page }) => { ... })
  test('reset password page', async ({ page }) => { ... })
})
```

### 7. Don't Snapshot Everything

Focus on:
- Critical user flows
- Complex UI components
- Responsive breakpoints
- Cross-browser differences

Avoid snapshotting:
- Backend API responses
- Constantly changing data
- Third-party embedded content

## Configuration

### Snapshot Tolerance Settings

Located in `playwright.config.ts`:

```typescript
expect: {
  toHaveScreenshot: {
    // Maximum pixel difference ratio (0-1)
    maxDiffPixelRatio: 0.01, // 1% of pixels can differ

    // Individual pixel color threshold (0-1)
    threshold: 0.2, // 20% color difference per pixel

    // Disable animations for consistent snapshots
    animations: 'disabled',

    // CSS or device scale
    scale: 'css',
  },
}
```

### Adjust Tolerance

If tests are flaky due to minor rendering differences:

```typescript
await expect(page).toHaveScreenshot('page.png', {
  maxDiffPixelRatio: 0.05, // Allow 5% difference
  threshold: 0.3, // Allow 30% color difference
})
```

### Snapshot Directory Structure

```
e2e/
├── __snapshots__/
│   └── visual-snapshots.e2e.ts/
│       ├── login-page-chromium.png
│       ├── login-page-firefox.png
│       ├── login-page-webkit.png
│       ├── login-form-component-chromium.png
│       └── ...
└── visual-snapshots.e2e.ts
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Visual Regression Tests

on: [pull_request]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Run visual tests
        run: pnpm test:e2e:visual

      - name: Upload diff images on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-diffs
          path: e2e/__snapshots__/**/*-diff.png
```

### Cross-Platform Considerations

Snapshots may differ across OS (Linux vs macOS vs Windows) due to font rendering.

**Solution**: Run tests in Docker or use the same OS as CI:

```bash
# Use Docker for consistent rendering
docker run -it --rm -v $(pwd):/work -w /work mcr.microsoft.com/playwright:v1.58.0 pnpm test:e2e:visual
```

## Troubleshooting

### Test Fails with Small Differences

**Problem**: Test fails but visual diff is barely noticeable.

**Solution**: Adjust tolerance settings:

```typescript
await expect(page).toHaveScreenshot('page.png', {
  maxDiffPixelRatio: 0.02,
  threshold: 0.3,
})
```

### Flaky Tests Due to Animations

**Problem**: Snapshots differ because animations haven't completed.

**Solution**: Ensure animations are disabled:

```typescript
await expect(page).toHaveScreenshot('page.png', {
  animations: 'disabled',
})
```

### Font Rendering Differences

**Problem**: Snapshots differ across machines due to font anti-aliasing.

**Solution**:
- Use Docker for consistent rendering
- Increase threshold tolerance
- Run tests on same OS as CI

### Dynamic Content Causes Failures

**Problem**: Timestamps, user avatars, or random IDs cause failures.

**Solution**: Mask dynamic elements:

```typescript
await expect(page).toHaveScreenshot('page.png', {
  mask: [
    page.locator('time'),
    page.locator('[data-testid="avatar"]'),
  ],
})
```

### Snapshot Path Issues

**Problem**: Can't find snapshot files.

**Solution**: Check `snapshotDir` in `playwright.config.ts`:

```typescript
snapshotDir: './e2e/__snapshots__',
```

### View Diffs in HTML Report

```bash
pnpm test:e2e:report
```

This opens an interactive HTML report showing:
- Visual diffs with slider
- Expected vs actual images
- Diff highlighting

## Advanced Usage

### Custom Snapshot Comparison

```typescript
// Compare only specific areas
const header = page.locator('header')
await expect(header).toHaveScreenshot('header.png', {
  clip: { x: 0, y: 0, width: 1920, height: 100 },
})
```

### Multiple Snapshots in One Test

```typescript
test('multi-step flow snapshots', async ({ page }) => {
  await page.goto('/form')
  await expect(page).toHaveScreenshot('form-step-1.png')

  await page.click('[data-testid="next"]')
  await expect(page).toHaveScreenshot('form-step-2.png')

  await page.click('[data-testid="submit"]')
  await expect(page).toHaveScreenshot('form-success.png')
})
```

### Conditional Snapshots

```typescript
test('snapshot with fallback', async ({ page }) => {
  await page.goto('/my-page')

  const element = page.locator('[data-testid="optional-element"]')

  if (await element.count() > 0) {
    await expect(element).toHaveScreenshot('optional-element.png')
  }
})
```

## Resources

- [Playwright Visual Comparisons Docs](https://playwright.dev/docs/test-snapshots)
- [Playwright Configuration](https://playwright.dev/docs/test-configuration)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

## Summary

Visual snapshot testing is a powerful tool for preventing visual regressions. Key takeaways:

1. ✅ Run `pnpm test:e2e:visual` regularly
2. ✅ Update snapshots with `--update-snapshots` when UI changes are intentional
3. ✅ Mask dynamic content (timestamps, avatars, IDs)
4. ✅ Wait for network idle before taking snapshots
5. ✅ Use descriptive snapshot names
6. ✅ Test multiple viewports and states
7. ✅ Review diffs in HTML report
8. ✅ Commit baseline snapshots to Git
9. ❌ Don't commit diff/actual images (they're gitignored)
10. ❌ Don't snapshot everything - focus on critical UI
