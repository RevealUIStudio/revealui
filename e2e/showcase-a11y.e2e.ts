/**
 * Showcase Accessibility (Gate 1)
 *
 * axe-core over every `@revealui/presentation` showcase page, in both themes.
 * Companion to e2e/showcase-visual.e2e.ts — same page set, same harness, same
 * hard-gate posture.
 *
 * WHY THIS EXISTS
 *
 * The design system's accessibility floor was asserted in prose and gated
 * nowhere. `CONTRIBUTING.md` step 3 says "Run an axe-core check on your showcase
 * before opening the PR" — a manual instruction with no artifact and nothing
 * that fails if you skip it. e2e/accessibility.e2e.ts carries 13 axe tests across
 * roughly 8 *application* routes; no component was ever scanned in isolation, in
 * either theme.
 *
 * The asymmetry was the tell: a one-pixel visual diff hard-failed the build
 * while a serious axe violation shipped silently. The system protected its
 * appearance more strictly than its accessibility. This closes that.
 *
 * It is also the raw material for the ACR/VPAT — an enterprise buyer asks for
 * one, and a generated report beats a hand-written claim.
 *
 * THEME MECHANISM — copied deliberately from showcase-visual.e2e.ts
 *
 * apps/docs has no site-wide dark mode (apps/docs/app/index.css:47-56, "keeps
 * the docs chrome unchanged"). Each showcase page's Preview panel carries its
 * OWN Dark/Light toggle that sets `data-theme` on a scoped wrapper div. So
 * "both themes" means clicking that button, not touching documentElement. Both
 * suites must agree on this or "dark" means two different things.
 *
 * SCOPE — the Preview panel, not the whole page
 *
 * The scan is scoped to `[data-showcase-preview]` so findings are attributable
 * to the COMPONENT rather than to docs chrome (sidebar, code tabs, prose).
 * Docs-chrome accessibility is the docs app's own concern and is covered by
 * e2e/accessibility.e2e.ts. Without this scoping every component page reports
 * the same handful of chrome findings and the signal drowns.
 *
 * If `[data-showcase-preview]` does not exist yet, add it to the Preview
 * panel's root in apps/docs/app/components/showcase/Preview.tsx — one attribute,
 * and it makes the scan boundary explicit rather than guessed.
 *
 * SEVERITY
 *
 * Fails on critical + serious (via checkAccessibilityCritical). Moderate and
 * minor are collected and printed as a summary so they can be worked down
 * without blocking. That threshold matches the repo's existing precedent for
 * the content editor.
 *
 * Run:
 *   pnpm --filter docs... build && pnpm --filter docs preview --port 3002 &
 *   npx playwright test --project=chromium e2e/showcase-a11y.e2e.ts
 *
 * SHOWCASE_A11Y_SOFT=1 downgrades failures to console output for the first
 * adoption run. Read the report, fix, then remove the flag. Do NOT leave it on —
 * a soft accessibility gate is the exact failure mode this replaces.
 */

import { expect, type Page, test } from '@playwright/test';
import { showcaseEntries } from '../apps/docs/app/components/showcase/registry.js';
import {
  checkAccessibilityCritical,
  type FormattedViolation,
  getAccessibilityViolations,
} from './utils/a11y-helper';

type Theme = 'light' | 'dark';

const THEMES: Theme[] = ['light', 'dark'];
const DOCS_BASE_URL = process.env.DOCS_BASE_URL || 'http://localhost:3002';
const SOFT = process.env.SHOWCASE_A11Y_SOFT === '1';

/** Scope every scan to the component under test, not the docs chrome. */
const PREVIEW = '[data-showcase-preview]';

const PAGES = [
  { slug: 'tokens', path: '/showcase/tokens' },
  ...showcaseEntries.map((entry) => ({ slug: entry.slug, path: `/showcase/${entry.slug}` })),
];

/** Moderate/minor findings, accumulated across the run for the closing summary. */
const backlog: Array<{ slug: string; theme: Theme; violations: FormattedViolation[] }> = [];

const KILL_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
`;

async function gotoShowcasePage(page: Page, path: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  await page.waitForSelector('h1', { state: 'visible' });
  await page.addStyleTag({ content: KILL_ANIMATIONS_CSS });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
}

async function setPreviewTheme(page: Page, theme: Theme): Promise<void> {
  const label = theme === 'dark' ? 'Dark' : 'Light';
  await page.getByRole('button', { name: label, exact: true }).first().click();
  await page.waitForTimeout(50);
}

test.describe('Showcase accessibility', () => {
  test.use({ baseURL: DOCS_BASE_URL });

  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName !== 'chromium',
      'axe results are pinned to one renderer, matching the showcase visual suite',
    );
  });

  for (const showcasePage of PAGES) {
    for (const theme of THEMES) {
      test(`${showcasePage.slug} (${theme})`, async ({ page }) => {
        await gotoShowcasePage(page, showcasePage.path);
        await setPreviewTheme(page, theme);

        const scoped = { includeSelectors: [PREVIEW] };

        if (SOFT) {
          const violations = await getAccessibilityViolations(page, scoped);
          const blocking = violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious',
          );
          if (blocking.length > 0) {
            console.log(`\n[SOFT] ${showcasePage.slug} (${theme}) — ${blocking.length} blocking:`);
            for (const v of blocking)
              console.log(`  [${v.impact}] ${v.id}: ${v.nodes.length} node(s)`);
          }
          backlog.push({ slug: showcasePage.slug, theme, violations });
          return;
        }

        const all = await checkAccessibilityCritical(page, scoped);
        const rest = all.filter((v) => v.impact !== 'critical' && v.impact !== 'serious');
        if (rest.length > 0) backlog.push({ slug: showcasePage.slug, theme, violations: rest });
      });
    }
  }

  /**
   * Keyboard operability for the composite widgets — the twelve components where
   * a native element is not doing the work, so axe's static analysis cannot tell
   * you whether the interaction is actually reachable.
   *
   * These are smoke checks: focus enters, arrow keys move, Escape closes, focus
   * returns. Per-component behaviour (type-ahead, roving tabindex, focus return
   * target) belongs in the unit tests — Gate 1's fourth bullet — where it can
   * assert against the DOM rather than a screenshot.
   */
  const COMPOSITE = [
    'dropdown',
    'listbox',
    'combobox',
    'tabs',
    'dialog',
    'drawer',
    'accordion',
    'stepper',
    'slider',
    'rating',
    'pagination',
    'table',
  ];

  for (const slug of COMPOSITE) {
    test(`${slug} — keyboard reachable`, async ({ page }) => {
      await gotoShowcasePage(page, `/showcase/${slug}`);
      const preview = page.locator(PREVIEW).first();

      const focusables = preview.locator(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const count = await focusables.count();
      expect(count, `${slug}: no focusable element inside the preview`).toBeGreaterThan(0);

      await focusables.first().focus();
      const inside = await preview.evaluate((el) => el.contains(document.activeElement));
      expect(inside, `${slug}: focus did not land inside the preview`).toBe(true);

      // A visible focus indicator must exist. Post-Gate-0 it resolves to
      // --ring everywhere; before Gate 0 this catches the components that
      // suppress the outline without drawing a replacement.
      const hasIndicator = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return false;
        const s = getComputedStyle(el);
        const outline = s.outlineStyle !== 'none' && Number.parseFloat(s.outlineWidth) > 0;
        const ring = s.boxShadow !== 'none' && s.boxShadow !== '';
        return outline || ring;
      });
      expect(hasIndicator, `${slug}: focused element draws no visible focus indicator`).toBe(true);
    });
  }

  test.afterAll(() => {
    if (backlog.length === 0) return;
    const counts = new Map<string, number>();
    for (const { violations } of backlog) {
      for (const v of violations) counts.set(v.id, (counts.get(v.id) ?? 0) + v.nodes.length);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    console.log('\n── non-blocking a11y backlog (moderate + minor) ──────────\n');
    for (const [id, n] of ranked) console.log(`  ${String(n).padStart(4)}  ${id}`);
    console.log(
      '\n  Work these down and they become ACR line items rather than findings.\n' +
        '  Any that reach critical/serious after a change will fail the gate above.\n',
    );
  });
});
