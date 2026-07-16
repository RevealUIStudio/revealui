---
title: "Visual Snapshot Testing - Quick Reference"
description: "**Updated for CMS Application** - Tests now target actual routes like `/login` instead of fictional routes."
visibility: internal
status: verified
audience: maintainer
---

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

## Component showcase suite (Phase 3 PR-0)

`e2e/showcase-visual.e2e.ts` is a second visual-regression suite targeting
`apps/docs` `/showcase/*` pages instead of the admin app above. It exists
because component re-authorship (the `frontend-excellence` Phase 3 program,
see `docs/specs/2026-07-16-phase-3-component-sovereignty.md` in the `.jv`
repo) must not land a silent visual regression across any
`@revealui/presentation` component. Golden baselines are captured for every
showcase page in both the light and dark theme, chromium only.

**Theme mechanism**: apps/docs has no site-wide dark mode (intentional  -  see
`apps/docs/app/index.css:47-56`). Each showcase page's `Preview` panel
(and the standalone `/showcase/tokens` page) carries its own local Dark/Light
toggle button pair that themes only the component preview area, not the docs
chrome. The suite clicks that toggle rather than touching `document.data-theme`
directly. The `/showcase` overview page has no theme toggle at all and is
captured once.

### Run locally

```
pnpm --filter @revealui/tokens build && pnpm --filter @revealui/presentation build
pnpm --filter docs build
pnpm --filter docs preview --port 3002 &
pnpm test:e2e:showcase-visual
```

Or let Playwright boot the docs dev server for you (no `CI` env set):

```
pnpm test:e2e:showcase-visual
```

### Update goldens after an intentional component change

```
pnpm test:e2e:showcase-visual:update
```

**Golden updates must ship with diff screenshots in the PR** (attach the
`-actual.png` / `-diff.png` from `test-results/` for any snapshot that
changed, or the relevant `playwright-report/` HTML). A golden-only diff with
no screenshots in the PR body should not be approved  -  reviewers cannot judge
"intentional" vs "regression" from a binary PNG diff alone.

### Goldens are CI-rendered, not host-rendered

Font hinting and chromium build differ enough between arbitrary local
machines and the `ubuntu-latest` GitHub Actions runner to produce spurious
diffs. The committed goldens under `e2e/__snapshots__/showcase-visual.e2e.ts/`
were generated inside the `mcr.microsoft.com/playwright:v1.61.1-noble`
container (same Ubuntu 24.04 + pinned Playwright/chromium version CI
installs) and verified byte-identical against a WSL/Ubuntu 24.04 host run. If
your machine's font rendering differs and `test:e2e:showcase-visual` shows
diffs against the committed goldens with no code change, regenerate inside
that same container image rather than trusting a bare local run:

```
docker run --rm --network host -v "$(pwd)":/work -w /work \
  -e CI=true -e DOCS_BASE_URL=http://localhost:3002 -e HOME=/tmp \
  mcr.microsoft.com/playwright:v1.61.1-noble \
  npx playwright test --project=chromium e2e/showcase-visual.e2e.ts --update-snapshots
```

(with `pnpm --filter docs preview --port 3002` already running on the host)
then `sudo chown -R $(whoami) e2e/__snapshots__` to reclaim ownership from the
container's root user before committing.

### CI gate

`.github/workflows/ds.yml` job `visual-regression` runs on every PR touching
`apps/**`, `packages/tokens/**`, or `packages/presentation/**` against `main`
or `test`. It hard-fails on any pixel diff (no `continue-on-error`  -  warn-only
was explicitly rejected per the `ds-catalyst-reskin` lane's Phase 0
owner-decision) and uploads `playwright-report/` + `test-results/` as the
`showcase-visual-results` artifact for inspection on failure.
