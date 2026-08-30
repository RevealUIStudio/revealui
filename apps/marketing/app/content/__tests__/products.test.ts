import { describe, expect, it } from 'vitest';
import * as products from '../products';
import { PRODUCTS_CTA_SECTION, PRODUCTS_FLAGSHIP, PRODUCTS_PAGE_HERO } from '../products';

const LIFECYCLE_STATUSES = ['Beta', 'Alpha', 'GA', 'Planned'] as const;

describe('products roster honesty', () => {
  it('does not claim five products are ready to use today', () => {
    expect(PRODUCTS_PAGE_HERO.subtitle.toLowerCase().includes('five are ready to use today')).toBe(
      false,
    );
    expect(PRODUCTS_PAGE_HERO.subtitle.toLowerCase().includes('zero paying')).toBe(true);
    expect(PRODUCTS_PAGE_HERO.subtitle.toLowerCase().includes('not a launched')).toBe(true);
  });

  it('presents licenses, not a RevFleet product family', () => {
    expect(PRODUCTS_PAGE_HERO.h1.toLowerCase().includes('revfleet')).toBe(false);
    expect(PRODUCTS_PAGE_HERO.h1.toLowerCase().includes('product family')).toBe(false);
    expect(PRODUCTS_PAGE_HERO.h1.toLowerCase().includes('license')).toBe(true);
    expect(PRODUCTS_PAGE_HERO.subtitle.toLowerCase().includes('revealuistudio.com')).toBe(true);
    expect(PRODUCTS_FLAGSHIP.body.toLowerCase().includes('revfleet')).toBe(false);
    expect(PRODUCTS_CTA_SECTION.body.toLowerCase().includes('revfleet')).toBe(false);
  });

  it('names RevealFleet and lists the honest public catalog', () => {
    expect(PRODUCTS_PAGE_HERO.subtitle.includes('RevealFleet')).toBe(true);
    expect(PRODUCTS_PAGE_HERO.subtitle.includes('pull-and-run Fleet')).toBe(false);
    expect(PRODUCTS_PAGE_HERO.subtitle.includes('Pro Perpetual')).toBe(true);
    expect(PRODUCTS_PAGE_HERO.subtitle.toLowerCase().includes('inquire')).toBe(true);
    expect(PRODUCTS_PAGE_HERO.subtitle.includes('Contact sales')).toBe(false);
  });

  it('does not export a public sister roster', () => {
    expect(Object.hasOwn(products, 'PRODUCTS_SISTERS')).toBe(false);
    expect(Object.hasOwn(products, 'PRODUCTS_SISTERS_SECTION')).toBe(false);
  });

  it('does not present RevForge, RevDev, RevKit, or Fleet as for sale', () => {
    const blob = JSON.stringify(products);
    expect(blob.includes('RevForge')).toBe(false);
    expect(blob.includes('RevDev')).toBe(false);
    expect(blob.includes('RevKit')).toBe(false);
    expect(blob.includes('RevFleet')).toBe(false);
  });

  it('uses a lifecycle-only status pill with no license in the status string', () => {
    const status = PRODUCTS_FLAGSHIP.status;
    expect(status.includes('('), `${status} must not encode a license`).toBe(false);
    expect(status.includes('MIT'), `${status} must not name a license`).toBe(false);
    expect(LIFECYCLE_STATUSES.includes(status), `${status} is not a lifecycle pill`).toBe(true);
  });

  it('does not add checkout doors on the products page', () => {
    const hrefs = [
      ...Object.values(PRODUCTS_FLAGSHIP.ctas).map((cta) => cta.href),
      PRODUCTS_CTA_SECTION.cta.docs.href,
      PRODUCTS_CTA_SECTION.cta.pricing.href,
    ];
    for (const href of hrefs) {
      expect(href.includes('stripe.com')).toBe(false);
      expect(href.includes('/buy')).toBe(false);
    }
    const labels = [
      PRODUCTS_FLAGSHIP.ctas.docs.label,
      PRODUCTS_FLAGSHIP.ctas.pricing.label,
      PRODUCTS_FLAGSHIP.ctas.repo.label,
      PRODUCTS_CTA_SECTION.cta.docs.label,
      PRODUCTS_CTA_SECTION.cta.pricing.label,
    ];
    for (const label of labels) {
      expect(label.toLowerCase().includes('buy')).toBe(false);
      expect(label.toLowerCase().includes('trial')).toBe(false);
    }
  });
});
