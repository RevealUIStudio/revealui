/**
 * Accessibility Testing Helper
 *
 * Reusable aXe-core integration for Playwright E2E tests.
 * Runs WCAG 2.1 AA compliance checks with structured violation reporting.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Configuration options for accessibility checks */
export interface A11yCheckOptions {
  /** aXe rules to disable (e.g., ['color-contrast'] for pages with known issues) */
  disableRules?: string[];
  /** CSS selectors to exclude from scanning (e.g., third-party widgets) */
  excludeSelectors?: string[];
  /** CSS selectors to include (scopes the scan; default: entire page) */
  includeSelectors?: string[];
  /** WCAG tags to test against (default: WCAG 2.1 AA) */
  tags?: string[];
}

/** A single formatted violation for reporting */
export interface FormattedViolation {
  /** aXe rule ID (e.g., 'color-contrast') */
  id: string;
  /** Violation severity: critical, serious, moderate, minor */
  impact: string;
  /** Human-readable description of the issue */
  description: string;
  /** WCAG criteria violated (e.g., 'wcag2a', 'wcag21aa') */
  tags: string[];
  /** Affected elements with CSS selectors and failure summaries */
  nodes: Array<{
    selector: string;
    failureSummary: string;
  }>;
}

const DEFAULT_WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Build an AxeBuilder instance with the given options.
 * Extracted for reuse across checkAccessibility and getAccessibilityViolations.
 */
function buildAxeScanner(page: Page, options: A11yCheckOptions = {}): AxeBuilder {
  const { disableRules = [], excludeSelectors = [], includeSelectors = [], tags } = options;

  let builder = new AxeBuilder({ page }).withTags(tags ?? DEFAULT_WCAG_TAGS);

  if (disableRules.length > 0) {
    builder = builder.disableRules(disableRules);
  }

  for (const selector of includeSelectors) {
    builder = builder.include(selector);
  }

  for (const selector of excludeSelectors) {
    builder = builder.exclude(selector);
  }

  return builder;
}

/**
 * Format raw aXe violations into a readable structure for test output.
 */
function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
): FormattedViolation[] {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact ?? 'unknown',
    description: violation.description,
    tags: violation.tags.filter((tag) => tag.startsWith('wcag')),
    nodes: violation.nodes.map((node) => ({
      selector: node.target.join(' > '),
      failureSummary: node.failureSummary ?? '',
    })),
  }));
}

/**
 * Build a human-readable violation report string for test failure messages.
 */
function buildViolationReport(formatted: FormattedViolation[]): string {
  const lines: string[] = [`Found ${formatted.length} accessibility violation(s):`, ''];

  for (const violation of formatted) {
    lines.push(`  [${violation.impact.toUpperCase()}] ${violation.id}: ${violation.description}`);
    for (const node of violation.nodes) {
      lines.push(`    - ${node.selector}`);
      lines.push(`      ${node.failureSummary}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Run aXe accessibility checks on a page and assert zero violations.
 *
 * This is the primary function for use in tests. It fails the test with
 * a detailed violation report if any WCAG 2.1 AA issues are found.
 *
 * @example
 * ```ts
 * import { checkAccessibility } from './utils/a11y-helper'
 *
 * test('login page is accessible', async ({ page }) => {
 *   await page.goto('/login')
 *   await checkAccessibility(page)
 * })
 *
 * // With exclusions for known issues:
 * test('dashboard is accessible', async ({ page }) => {
 *   await page.goto('/admin')
 *   await checkAccessibility(page, {
 *     disableRules: ['color-contrast'],
 *     excludeSelectors: ['.third-party-widget'],
 *   })
 * })
 * ```
 */
export async function checkAccessibility(
  page: Page,
  options: A11yCheckOptions = {},
): Promise<void> {
  const results = await buildAxeScanner(page, options).analyze();
  const formatted = formatViolations(results.violations);

  expect(formatted, buildViolationReport(formatted)).toHaveLength(0);
}

/**
 * Run aXe accessibility checks and return violations without asserting.
 *
 * Useful when you want to inspect violations programmatically or implement
 * custom assertion logic (e.g., allow minor violations, fail only on critical).
 */
export async function getAccessibilityViolations(
  page: Page,
  options: A11yCheckOptions = {},
): Promise<FormattedViolation[]> {
  const results = await buildAxeScanner(page, options).analyze();
  return formatViolations(results.violations);
}

/**
 * Run aXe checks and fail only on critical/serious violations.
 *
 * Moderate and minor violations are returned but do not cause test failure.
 * Useful for incremental adoption where fixing all issues at once is not feasible.
 */
export async function checkAccessibilityCritical(
  page: Page,
  options: A11yCheckOptions = {},
): Promise<FormattedViolation[]> {
  const all = await getAccessibilityViolations(page, options);
  const critical = all.filter((v) => v.impact === 'critical');

  expect(critical, buildViolationReport(critical)).toHaveLength(0);

  return all;
}
