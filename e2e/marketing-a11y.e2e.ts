/**
 * Marketing accessibility (frontend-excellence lane acceptance).
 *
 * axe-core WCAG 2.2 AA over the public marketing homepage and pricing page.
 * Companion to apps/marketing/lighthouserc.json (Lighthouse a11y ≥ 0.95).
 *
 * Defaults to the Vite marketing preview port (3000). CI sets
 * MARKETING_BASE_URL explicitly. The older e2e/accessibility.e2e.ts default
 * of :3002 was the docs port.
 *
 *   pnpm --filter marketing... build && pnpm --filter marketing start &
 *   MARKETING_BASE_URL=http://localhost:3000 \
 *     pnpm exec playwright test --project=chromium e2e/marketing-a11y.e2e.ts
 */

import { expect, test } from '@playwright/test';
import { checkAccessibility } from './utils/a11y-helper';
import { assertHonestProductCatalog } from './utils/catalog-honesty';

const MarketingBase = process.env.MARKETING_BASE_URL || 'http://localhost:3000';

test.describe('Marketing accessibility', () => {
  // Full-page axe on the homepage is heavier than a component scan.
  test.setTimeout(90_000);

  test('homepage meets WCAG 2.2 AA', async ({ page }) => {
    await page.goto(MarketingBase, { waitUntil: 'domcontentloaded' });
    await checkAccessibility(page);
  });

  test('pricing page meets WCAG 2.2 AA', async ({ page }) => {
    await page.goto(`${MarketingBase}/pricing`, { waitUntil: 'domcontentloaded' });
    await assertHonestProductCatalog(page);
    await checkAccessibility(page);
  });
});

// Long addresses and technical URLs must remain readable within the shared
// policy shell, including its notice and opened native FAQ answers.
for (const width of [390, 1440]) {
  test.describe(`Policy page reflow at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });

    for (const [path, title] of [
      ['/privacy', 'Privacy Policy'],
      ['/cookies', 'Cookie Policy'],
      ['/terms', 'Terms of Service'],
      ['/security', 'Security'],
      ['/support', 'Support'],
      ['/refund-policy', 'Refund Policy'],
    ] as const) {
      test(`${path} fits the viewport with readable policy text`, async ({ page }) => {
        await page.route('**/*', (route) =>
          ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort(),
        );
        await page.goto(`${MarketingBase}${path}`, { waitUntil: 'load' });
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
        await page.evaluate(() => document.fonts.ready);

        const expectReflow = async () => {
          await expect
            .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
            .toBe(true);
        };

        await expectReflow();
        for (const summary of await page.locator('main details > summary').all()) {
          await summary.focus();
          await summary.press('Enter');
          await expect.poll(() => summary.evaluate((el) => el.closest('details')?.open)).toBe(true);
          await expect(summary.locator('..').locator('p')).toBeVisible();
          await expectReflow();
          await summary.press('Enter');
          await expect
            .poll(() => summary.evaluate((el) => el.closest('details')?.open))
            .toBe(false);
        }
      });
    }
  });
}
