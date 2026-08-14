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

import { test } from '@playwright/test';
import { checkAccessibility } from './utils/a11y-helper';

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
    await checkAccessibility(page);
  });
});
