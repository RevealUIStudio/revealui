/**
 * Showcase Visual Regression (Phase 3 PR-0)
 *
 * Golden-baseline snapshots for every `@revealui/presentation` component
 * showcase page, captured in both the light and dark theme, at a single
 * stable desktop viewport. This is the non-negotiable prerequisite the
 * ds-catalyst-reskin lane (Phase 0) and the Phase 3 component-sovereignty
 * spec (PR-0) both call for: baselines must exist BEFORE any re-authorship
 * PR touches a component, so silent visual regressions are caught in CI
 * instead of shipped.
 *
 * Theme mechanism (verified in code, NOT what the docs `data-theme` on
 * `document.documentElement` would suggest): apps/docs has no site-wide dark
 * mode. apps/docs/app/index.css:47-56 documents this as intentional  -  "keeps
 * the docs chrome unchanged." Each showcase page's `Preview` panel
 * (apps/docs/app/components/showcase/Preview.tsx) and the standalone
 * `TokensPage` (.../TokensPage.tsx) instead carry their OWN local Dark/Light
 * toggle (`useState<'dark'|'light'>('dark')`) that sets `data-theme` on a
 * scoped wrapper div. That local toggle is what actually re-themes the
 * `@revealui/presentation` component under test. So "both themes" here means:
 * click that page's Dark/Light toggle button, not touch the document element.
 * The "Overview" page (`/showcase`) is a plain link list with no themed
 * content at all  -  captured once, no theme dimension.
 *
 * The "Examples" panel underneath the Preview (story.examples, e.g. Button's
 * "With Icon"/"Glow"/"Shine" rows) is hardcoded `data-theme="dark"` in
 * ShowcaseShell.tsx with no toggle  -  it does not vary and is captured as-is
 * in both the light and dark test runs (that's correct: it reflects actual
 * page behavior, not a harness bug).
 *
 * Scope: apps/docs `/showcase/*` pages only. Chromium only  -  cross-browser
 * font hinting / compositing differences make multi-browser goldens flaky,
 * matching the precedent already established by the existing admin visual
 * suite (e2e/visual-snapshots.e2e.ts).
 *
 * Run against a local dev/preview docs server:
 *   pnpm test:e2e:showcase-visual
 *
 * Update goldens after an intentional visual change. Prefer CI so the PNGs
 * match Ubuntu + pinned Chromium (Actions → "Regenerate Visual Snapshots",
 * suite `showcase`). Local-only:
 *   pnpm test:e2e:showcase-visual:update
 *
 * See e2e/README-VISUAL-SNAPSHOTS.md for the full contribution guide.
 */

import { expect, type Page, test } from '@playwright/test';
import { showcaseEntries } from '../apps/docs/app/components/showcase/registry.js';

interface ThemedShowcasePage {
  slug: string;
  path: string;
}

type Theme = 'light' | 'dark';

const THEMES: Theme[] = ['light', 'dark'];

// The design-tokens page renders through its own component (TokensPage), not
// the registry loader, but shares the same Dark/Light toggle pattern.
const THEMED_PAGES: ThemedShowcasePage[] = [
  { slug: 'tokens', path: '/showcase/tokens' },
  ...showcaseEntries.map((entry) => ({ slug: entry.slug, path: `/showcase/${entry.slug}` })),
];

// The overview page is a static link list  -  no Preview toggle, no theme
// dimension. Captured once, separately from the themed loop below.
const OVERVIEW_PAGE: ThemedShowcasePage = { slug: 'overview', path: '/showcase' };

const DOCS_BASE_URL = process.env.DOCS_BASE_URL || 'http://localhost:3002';

const KILL_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
    caret-color: transparent !important;
  }
`;

/**
 * Navigate to a showcase page and harden it for deterministic capture:
 * reduced motion, a CSS animation/transition kill (belts-and-braces on top
 * of Playwright's own `animations: 'disabled'`), and a wait for web fonts to
 * finish loading before any screenshot is taken.
 */
async function gotoShowcasePage(page: Page, path: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  await page.waitForSelector('h1', { state: 'visible' });
  await page.addStyleTag({ content: KILL_ANIMATIONS_CSS });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
}

/**
 * Click the page's Dark/Light Preview toggle to the requested theme and let
 * the (now-instant, animations killed) re-render settle before capture.
 */
async function setPreviewTheme(page: Page, theme: Theme): Promise<void> {
  const label = theme === 'dark' ? 'Dark' : 'Light';
  await page.getByRole('button', { name: label, exact: true }).first().click();
  await page.waitForTimeout(50);
}

test.describe('Showcase visual regression', () => {
  test.use({ baseURL: DOCS_BASE_URL });
  // Pixel mismatches do not pass on retry. CI retries:2 * 127 pages previously
  // burned the 20-minute job budget and reported "cancelled" instead of failed.
  test.describe.configure({ retries: 0 });

  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName !== 'chromium',
      'Showcase goldens are captured chromium-only (cross-browser rendering ' +
        'differences make multi-browser goldens flaky) — see e2e/README-VISUAL-SNAPSHOTS.md',
    );
  });

  test(`${OVERVIEW_PAGE.slug}`, async ({ page }) => {
    await gotoShowcasePage(page, OVERVIEW_PAGE.path);
    await expect(page).toHaveScreenshot(`${OVERVIEW_PAGE.slug}.png`, {
      fullPage: true,
      mask: [page.locator('[data-visual-mask]')],
    });
  });

  for (const showcasePage of THEMED_PAGES) {
    for (const theme of THEMES) {
      test(`${showcasePage.slug} (${theme})`, async ({ page }) => {
        await gotoShowcasePage(page, showcasePage.path);
        await setPreviewTheme(page, theme);

        await expect(page).toHaveScreenshot(`${showcasePage.slug}-${theme}.png`, {
          fullPage: true,
          mask: [page.locator('[data-visual-mask]')],
        });
      });
    }
  }
});
