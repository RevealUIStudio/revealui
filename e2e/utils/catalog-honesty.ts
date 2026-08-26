/**
 * Public product catalog honesty (RevealUIStudio/revealui only).
 *
 * After #2696 the marketing catalog is licenses only: Free $0 / Pro $49 /
 * Max $299 / Enterprise as a license. Studio SKUs, Done-for-you, kits,
 * Fleet $25k, the rented-stack calculator, and cal.com booking are not sold
 * here. Shared by smoke + accessibility so those jobs cannot drift apart.
 */

import { expect, type Page } from '@playwright/test';

export const HONEST_TIER_HEADINGS = ['Free (OSS)', 'Pro', 'Max', 'Enterprise'] as const;

export const HONEST_TIER_PRICES = ['$0', '$49', '$299'] as const;

export const ENTERPRISE_LICENSE_COPY = 'Enterprise is a license, not a hosted VM.';

/** Dual-ladder leftovers that must not appear on the product catalog. */
export const FORBIDDEN_CATALOG_PHRASES = [
  'Architecture Review',
  'Fleet from',
  'Custom from',
  '$25,000',
  '$50,000',
  'Starter Kit',
  'Agency Founding Kit',
  '$8,499',
  'Buy Agency Perpetual',
  'Agency Perpetual',
  'Slack support',
  '$118/yr',
  '$718/yr',
  '$42,999',
  'Two ways to use RevealUI',
  '$1,499/month',
  'Add up what you would otherwise rent',
  'The rented stack',
  '$300',
  '$3,500',
  '$7,500',
  'No holdback',
  'cal.com/revealuistudio',
  'Done-for-you',
  'Done for you',
] as const;

export async function assertHonestProductCatalog(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('RevealUI pricing', {
    timeout: 10_000,
  });

  for (const name of HONEST_TIER_HEADINGS) {
    await expect(page.getByRole('heading', { name, exact: true }).first()).toBeVisible();
  }

  const text = await page.locator('body').innerText();
  for (const price of HONEST_TIER_PRICES) {
    expect(text.includes(price), `honest catalog must show ${price}`).toBe(true);
  }
  expect(text.includes(ENTERPRISE_LICENSE_COPY), 'Enterprise must be sold as a license').toBe(true);

  const html = await page.content();
  for (const phrase of FORBIDDEN_CATALOG_PHRASES) {
    expect(text.includes(phrase), `catalog must not sell "${phrase}"`).toBe(false);
    expect(html.includes(phrase), `catalog markup must not include "${phrase}"`).toBe(false);
  }
}
