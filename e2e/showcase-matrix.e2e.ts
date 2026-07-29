/**
 * Showcase coverage matrix — Gate 5, medium finding 11.
 * ─────────────────────────────────────────────────────────────────────────
 * The existing visual gate is Chromium-only at one desktop viewport, and that is
 * the right call for pixel goldens — cross-browser font hinting makes
 * multi-renderer goldens flaky. But it leaves four things with no evidence at all:
 *
 *   · WebKit and Firefox rendering
 *   · mobile viewports
 *   · forced-colors mode — several components already ship `forced-colors:`
 *     handling (dropdown, listbox, alert) with nothing verifying it works
 *   · 200% zoom (WCAG 1.4.4 Resize Text)
 *
 * So this suite deliberately does NOT take pixel screenshots. It asserts
 * STRUCTURAL invariants that hold in any renderer: nothing overflows, nothing
 * collapses to zero, text stays visible, focus indicators still draw. Those
 * survive font-hinting differences, which is exactly why they can run everywhere
 * the goldens can't.
 *
 * Run:
 *   npx playwright test e2e/showcase-matrix.e2e.ts
 *   npx playwright test --project=webkit e2e/showcase-matrix.e2e.ts
 *
 * Scoped to a REPRESENTATIVE SUBSET, not all 58. One component per structural
 * archetype: overlay, form control, data table, layout shell, inline chip. Running
 * the full set across 3 browsers × 3 conditions is 500+ tests for very little
 * marginal signal — the failures cluster by archetype, not by component.
 */

import { expect, type Page, test } from '@playwright/test';

const DOCS_BASE_URL = process.env.DOCS_BASE_URL || 'http://localhost:3002';
const PREVIEW = '[data-showcase-preview]';

/** One per structural archetype. Add a slug only when it fails in a NEW way. */
const ARCHETYPES = [
  { slug: 'dialog', kind: 'overlay' },
  { slug: 'drawer', kind: 'overlay' },
  { slug: 'dropdown', kind: 'floating' },
  { slug: 'input', kind: 'form control' },
  { slug: 'select', kind: 'form control' },
  { slug: 'table', kind: 'data' },
  { slug: 'sidebar', kind: 'layout shell' },
  { slug: 'badge', kind: 'inline chip' },
  { slug: 'tabs', kind: 'navigation' },
  { slug: 'pricing-table', kind: 'composite' },
];

async function goto(page: Page, slug: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/showcase/${slug}`);
  await page.waitForSelector('h1', { state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
}

/** Structural invariants that must hold in every renderer and condition. */
async function assertStructure(page: Page, label: string) {
  const preview = page.locator(PREVIEW).first();
  await expect(preview, `${label}: preview panel not found`).toBeVisible();

  const report = await preview.evaluate((root) => {
    const overflowing: string[] = [];
    const collapsed: string[] = [];
    const invisibleText: string[] = [];

    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;

      const desc = `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(' ')[0]}` : ''}`;

      // Horizontal overflow past the viewport is a layout break in any renderer.
      if (r.right > window.innerWidth + 1) overflowing.push(desc);

      // A box with text that has collapsed to zero in one axis is broken, not styled.
      if ((el.textContent ?? '').trim().length > 0 && (r.width < 1 || r.height < 1))
        collapsed.push(desc);

      // Text the same colour as what it sits on. Catches forced-colors overrides
      // that only replace one side of a pair.
      if (el.children.length === 0 && (el.textContent ?? '').trim().length > 0) {
        if (s.color === s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)')
          invisibleText.push(desc);
      }
    }
    return {
      overflowing,
      collapsed,
      invisibleText,
      scrollW: root.scrollWidth,
      clientW: root.clientWidth,
    };
  });

  expect(
    report.overflowing,
    `${label}: ${report.overflowing.length} element(s) overflow the viewport\n  ${report.overflowing.slice(0, 8).join('\n  ')}`,
  ).toEqual([]);
  expect(
    report.collapsed,
    `${label}: text-bearing element(s) collapsed to zero size\n  ${report.collapsed.slice(0, 8).join('\n  ')}`,
  ).toEqual([]);
  expect(
    report.invisibleText,
    `${label}: text is the same colour as its background\n  ${report.invisibleText.slice(0, 8).join('\n  ')}`,
  ).toEqual([]);
}

test.describe('coverage matrix — cross-browser structure', () => {
  test.use({ baseURL: DOCS_BASE_URL });

  for (const { slug, kind } of ARCHETYPES) {
    test(`${slug} (${kind}) — desktop`, async ({ page, browserName }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await goto(page, slug);
      await assertStructure(page, `${slug} @ ${browserName} desktop`);
    });

    test(`${slug} (${kind}) — mobile`, async ({ page, browserName }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await goto(page, slug);
      await assertStructure(page, `${slug} @ ${browserName} 390px`);
    });
  }
});

test.describe('coverage matrix — forced colors', () => {
  test.use({ baseURL: DOCS_BASE_URL, forcedColors: 'active' });

  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'forcedColors emulation is Chromium-only in Playwright');
  });

  for (const { slug, kind } of ARCHETYPES) {
    test(`${slug} (${kind}) — forced-colors: active`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await goto(page, slug);
      await assertStructure(page, `${slug} @ forced-colors`);

      // Focus must remain visible when the OS replaces every colour. This is the
      // case `forced-colors:` handling exists for, and nothing checked it.
      const focusable = page
        .locator(PREVIEW)
        .first()
        .locator('button, [href], input, select, [tabindex]:not([tabindex="-1"])');
      if ((await focusable.count()) > 0) {
        await focusable.first().focus();
        const visible = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) return false;
          const s = getComputedStyle(el);
          return s.outlineStyle !== 'none' && Number.parseFloat(s.outlineWidth) > 0;
        });
        expect(
          visible,
          `${slug}: no visible focus outline under forced-colors. A box-shadow ring is discarded in forced-colors mode — the indicator must be an outline.`,
        ).toBe(true);
      }
    });
  }
});

test.describe('coverage matrix — 200% zoom (WCAG 1.4.4)', () => {
  test.use({ baseURL: DOCS_BASE_URL });

  for (const { slug, kind } of ARCHETYPES) {
    test(`${slug} (${kind}) — 200% zoom`, async ({ page, browserName }) => {
      // 1.4.4 is about text scaling, so halve the viewport rather than using a
      // device pixel ratio: the reflow requirement is what a magnified user hits.
      await page.setViewportSize({ width: 640, height: 512 });
      await goto(page, slug);
      await assertStructure(page, `${slug} @ ${browserName} 200% zoom`);
    });
  }
});
