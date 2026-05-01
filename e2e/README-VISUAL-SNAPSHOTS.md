# Visual Snapshot Testing - Quick Reference

**Updated for CMS Application** - Tests now target actual routes like `/login` instead of fictional routes.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm test:e2e:visual` | Run all visual snapshot tests |
| `pnpm test:e2e:visual:update` | Update all snapshots (after intentional UI changes) |
| `pnpm test:e2e:visual:chromium` | Run visual tests in Chromium only |
| `pnpm test:e2e:visual:update:chromium` | Update Chromium snapshots only |
| `pnpm test:e2e:ui` | Run tests in interactive UI mode |
| `pnpm test:e2e:report` | View HTML report with visual diffs |
| `pnpm test:e2e:debug visual-snapshots.e2e.ts` | Debug visual tests |

## Quick Examples

### Full Page Snapshot

```typescript
// Admin panel
await page.goto('/login')
await page.waitForLoadState('networkidle')
await expect(page).toHaveScreenshot('admin-login.png', {
  fullPage: true,
})

// Frontend page
await page.goto('/')
await page.waitForLoadState('networkidle')
await expect(page).toHaveScreenshot('home-page.png', {
  fullPage: true,
})
```

### Component Snapshot

```typescript
const button = page.locator('[data-testid="submit"]')
await expect(button).toHaveScreenshot('submit-button.png')
```

### Responsive Snapshot

```typescript
await page.setViewportSize({ width: 375, height: 667 })
await page.goto('/my-page')
await expect(page).toHaveScreenshot('my-page-mobile.png')
```

### Mask Dynamic Content

```typescript
await expect(page).toHaveScreenshot('dashboard.png', {
  mask: [
    page.locator('time'),
    page.locator('[data-testid="avatar"]'),
  ],
})
```

### Dark Mode

```typescript
await page.emulateMedia({ colorScheme: 'dark' })
await page.goto('/my-page')
await expect(page).toHaveScreenshot('my-page-dark.png')
```

### State Snapshot (Hover, Focus, etc.)

```typescript
const button = page.locator('button')
await button.hover()
await page.waitForTimeout(100)
await expect(button).toHaveScreenshot('button-hover.png')
```

## Workflow

1. **Write test** with visual snapshot assertion
2. **Generate baseline**: `pnpm test:e2e:visual:update`
3. **Commit snapshots** to Git
4. **Run tests**: `pnpm test:e2e:visual`
5. **When UI changes intentionally**: Update snapshots again
6. **Review diffs**: `pnpm test:e2e:report`

## File Structure

```
e2e/
├── __snapshots__/                    # Baseline snapshots (committed to Git)
│   └── visual-snapshots.e2e.ts/
│       ├── login-page-chromium.png
│       ├── login-page-firefox.png
│       └── *-actual.png              # Generated on failure (gitignored)
│       └── *-diff.png                # Visual diff (gitignored)
├── visual-snapshots.e2e.ts           # Visual snapshot test suite
└── README-VISUAL-SNAPSHOTS.md        # This file
```

## Configuration (playwright.config.ts)

```typescript
expect: {
  toHaveScreenshot: {
    maxDiffPixelRatio: 0.01,    // 1% pixels can differ
    threshold: 0.2,              // 20% color difference per pixel
    animations: 'disabled',      // Disable animations
    scale: 'css',                // CSS or device scale
  },
}
```

## Best Practices

✅ **DO**
- Wait for `networkidle` before snapshots
- Mask dynamic content (timestamps, avatars, IDs)
- Use descriptive snapshot names
- Test critical user flows and complex components
- Commit baseline snapshots to Git
- Update snapshots only when UI changes are intentional

❌ **DON'T**
- Snapshot everything (focus on important UI)
- Commit `-actual.png` or `-diff.png` files
- Update snapshots without reviewing diffs
- Snapshot constantly changing data

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Small differences fail tests | Increase `maxDiffPixelRatio` or `threshold` |
| Flaky due to animations | Ensure `animations: 'disabled'` |
| Font rendering differs | Use Docker or same OS as CI |
| Dynamic content fails | Mask elements with `mask: [...]` |
| Can't find snapshots | Check `snapshotDir` in config |

## Resources

- Full guide: `/docs/VISUAL-SNAPSHOTS-GUIDE.md`
- Playwright docs: https://playwright.dev/docs/test-snapshots
- Example tests: `e2e/visual-snapshots.e2e.ts`
