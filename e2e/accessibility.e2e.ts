/**
 * Accessibility E2E Tests
 *
 * WCAG 2.1 AA compliance checks for key RevealUI pages using aXe-core.
 * These tests verify that the application meets accessibility standards.
 *
 * Run:
 *   pnpm exec playwright test e2e/accessibility.e2e.ts --project=chromium
 *
 * Note: Tests may fail on actual a11y violations  -  that is expected and correct.
 * Fix violations in the source code rather than suppressing rules.
 */

import { expect, test } from '@playwright/test';
import {
  checkAccessibility,
  checkAccessibilityCritical,
  type FormattedViolation,
  getAccessibilityViolations,
} from './utils/a11y-helper';

// ---------------------------------------------------------------------------
// Admin Pages (apps/admin  -  port 4000)
// ---------------------------------------------------------------------------

test.describe('Accessibility', () => {
  const AdminBase = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000';

  test.describe('Login page', () => {
    test('meets WCAG 2.1 AA standards', async ({ page }) => {
      await page.goto(`${AdminBase}/login`, { waitUntil: 'domcontentloaded' });
      await checkAccessibility(page);
    });

    test('form inputs have accessible labels', async ({ page }) => {
      await page.goto(`${AdminBase}/login`, { waitUntil: 'domcontentloaded' });
      const violations = await getAccessibilityViolations(page, {
        includeSelectors: ['form'],
      });

      const labelViolations = violations.filter(
        (v) => v.id === 'label' || v.id === 'label-title-only',
      );
      expect(
        labelViolations,
        `Found form label violations:\n${labelViolations.map((v) => `  ${v.id}: ${v.description}`).join('\n')}`,
      ).toHaveLength(0);
    });
  });

  test.describe('Dashboard / Admin panel', () => {
    test('admin page meets WCAG 2.1 AA standards', async ({ page }) => {
      await page.goto(`${AdminBase}/admin`, { waitUntil: 'domcontentloaded' });
      // Dashboard may redirect to login if unauthenticated  -  scan whatever renders
      await checkAccessibility(page);
    });

    test('navigation is keyboard accessible', async ({ page }) => {
      await page.goto(`${AdminBase}/admin`, { waitUntil: 'domcontentloaded' });
      const violations = await getAccessibilityViolations(page);

      const keyboardViolations = violations.filter(
        (v) => v.id === 'keyboard' || v.id === 'focus-order-semantics' || v.id === 'tabindex',
      );
      expect(
        keyboardViolations,
        `Found keyboard accessibility violations:\n${keyboardViolations.map((v) => `  ${v.id}: ${v.description}`).join('\n')}`,
      ).toHaveLength(0);
    });
  });

  test.describe('Settings page', () => {
    test('account settings page meets WCAG 2.1 AA standards', async ({ page }) => {
      await page.goto(`${AdminBase}/admin/settings/account`, { waitUntil: 'domcontentloaded' });
      await checkAccessibility(page);
    });
  });

  test.describe('Content editor', () => {
    test('content list page meets WCAG 2.1 AA standards', async ({ page }) => {
      await page.goto(`${AdminBase}/admin/collections/posts`, { waitUntil: 'domcontentloaded' });
      // May redirect to login  -  scan whatever renders
      await checkAccessibility(page);
    });

    test('content editor page meets WCAG 2.1 AA (critical/serious only)', async ({ page }) => {
      // Rich text editors often have minor a11y issues from contenteditable.
      // Check critical/serious only to avoid noise from editor internals.
      await page.goto(`${AdminBase}/admin/collections/posts/create`, {
        waitUntil: 'domcontentloaded',
      });
      await checkAccessibilityCritical(page);
    });
  });

  // ---------------------------------------------------------------------------
  // Marketing Pages (apps/marketing  -  port 3002)
  // ---------------------------------------------------------------------------

  test.describe('Marketing pages', () => {
    const MarketingBase = process.env.MARKETING_BASE_URL || 'http://localhost:3002';

    test('homepage meets WCAG 2.1 AA standards', async ({ page }) => {
      await page.goto(MarketingBase, { waitUntil: 'domcontentloaded' });
      await checkAccessibility(page);
    });

    test('pricing page meets WCAG 2.1 AA standards', async ({ page }) => {
      await page.goto(`${MarketingBase}/pricing`, { waitUntil: 'domcontentloaded' });
      await checkAccessibility(page);
    });
  });

  // ---------------------------------------------------------------------------
  // Cross-cutting checks
  // ---------------------------------------------------------------------------

  test.describe('Cross-cutting', () => {
    test('no critical violations across admin root', async ({ page }) => {
      await page.goto(AdminBase, { waitUntil: 'domcontentloaded' });
      // Admin root may redirect to /login  -  wait for navigation to settle
      await page.waitForLoadState('networkidle');
      const allViolations = await checkAccessibilityCritical(page);

      // Report total minor/moderate violations for visibility (does not fail)
      const minorCount = allViolations.filter(
        (v) => v.impact === 'minor' || v.impact === 'moderate',
      ).length;
      if (minorCount > 0) {
        test.info().annotations.push({
          type: 'a11y-info',
          description: `${minorCount} minor/moderate violation(s) found — review recommended`,
        });
      }
    });

    test('images have alt text', async ({ page }) => {
      await page.goto(AdminBase, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      const violations = await getAccessibilityViolations(page);
      const imageViolations = violations.filter((v) => v.id === 'image-alt');
      expect(imageViolations, formatImageViolations(imageViolations)).toHaveLength(0);
    });

    test('page has proper heading hierarchy', async ({ page }) => {
      await page.goto(AdminBase, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      const violations = await getAccessibilityViolations(page);
      const headingViolations = violations.filter(
        (v) => v.id === 'heading-order' || v.id === 'page-has-heading-one',
      );
      expect(
        headingViolations,
        `Heading hierarchy violations:\n${headingViolations.map((v) => `  ${v.id}: ${v.description}`).join('\n')}`,
      ).toHaveLength(0);
    });

    test('color contrast meets AA minimum', async ({ page }) => {
      await page.goto(AdminBase, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      const violations = await getAccessibilityViolations(page);
      const contrastViolations = violations.filter((v) => v.id === 'color-contrast');
      expect(contrastViolations, formatContrastViolations(contrastViolations)).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Formatting helpers (local to this test file)
// ---------------------------------------------------------------------------

function formatImageViolations(violations: FormattedViolation[]): string {
  if (violations.length === 0) return '';
  const elements = violations.flatMap((v) => v.nodes.map((n) => `  - ${n.selector}`));
  return `Images missing alt text:\n${elements.join('\n')}`;
}

function formatContrastViolations(violations: FormattedViolation[]): string {
  if (violations.length === 0) return '';
  const elements = violations.flatMap((v) =>
    v.nodes.map((n) => `  - ${n.selector}: ${n.failureSummary}`),
  );
  return `Color contrast violations:\n${elements.join('\n')}`;
}
