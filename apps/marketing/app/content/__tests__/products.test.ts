import { describe, expect, it } from 'vitest';
import {
  PRODUCTS_CTA_SECTION,
  PRODUCTS_FLAGSHIP,
  PRODUCTS_PAGE_HERO,
  PRODUCTS_SISTERS,
  PRODUCTS_SISTERS_SECTION,
  type ProductStatus,
} from '../products';

const LIFECYCLE_STATUSES: readonly ProductStatus[] = ['Beta', 'Alpha', 'GA', 'Planned'];

function revforge(): (typeof PRODUCTS_SISTERS)[number] {
  const product = PRODUCTS_SISTERS.find((item) => item.slug === 'revforge');
  if (!product) {
    throw new Error('RevForge is missing from PRODUCTS_SISTERS');
  }
  return product;
}

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

  it('keeps RevForge as Alpha operator preview with Contact, not Buy', () => {
    const product = revforge();
    expect(product.status).toBe('Alpha');
    expect(product.priceLabel).toBe('Operator tool · private preview');
    expect(product.primaryCta.label).toBe('Contact us');
    expect(product.primaryCta.href).toBe('/contact');
    expect(product.primaryCta.href.includes('mailto:')).toBe(false);
  });

  it('does not sell RevForge as an unattended stamp or Fleet kit', () => {
    const product = revforge();
    const blob = [product.tagline, ...product.highlights].join(' ').toLowerCase();
    expect(blob.includes('operator preview')).toBe(true);
    expect(blob.includes('studio-run') || blob.includes('studio runs')).toBe(true);
    expect(blob.includes('unattended')).toBe(true);
    expect(blob.includes('private preview') || blob.includes('operator preview')).toBe(true);
    expect(blob.includes('trial kit')).toBe(false);
    expect(blob.includes('stamp branded')).toBe(false);
  });

  it('uses lifecycle-only status pills with no license in the status string', () => {
    const statuses = [PRODUCTS_FLAGSHIP.status, ...PRODUCTS_SISTERS.map((item) => item.status)];
    for (const status of statuses) {
      expect(status.includes('('), `${status} must not encode a license`).toBe(false);
      expect(status.includes('MIT'), `${status} must not name a license`).toBe(false);
      expect(LIFECYCLE_STATUSES.includes(status), `${status} is not a lifecycle pill`).toBe(true);
    }
    expect(PRODUCTS_SISTERS.find((item) => item.slug === 'revcon')?.status).toBe('GA');
    expect(PRODUCTS_SISTERS.find((item) => item.slug === 'revskills')?.status).toBe('GA');
  });

  it('keeps license language on price labels, not status', () => {
    const mitSisters = PRODUCTS_SISTERS.filter((item) => item.priceLabel.includes('MIT'));
    expect(mitSisters.length).toBeGreaterThan(0);
    for (const product of mitSisters) {
      expect(product.status.includes('MIT')).toBe(false);
    }
  });

  it('does not add checkout doors on the products roster', () => {
    const hrefs = [
      ...Object.values(PRODUCTS_FLAGSHIP.ctas).map((cta) => cta.href),
      ...PRODUCTS_SISTERS.map((item) => item.primaryCta.href),
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
      ...PRODUCTS_SISTERS.map((item) => item.primaryCta.label),
      PRODUCTS_CTA_SECTION.cta.docs.label,
      PRODUCTS_CTA_SECTION.cta.pricing.label,
    ];
    for (const label of labels) {
      expect(label.toLowerCase().includes('buy')).toBe(false);
      expect(label.toLowerCase().includes('trial')).toBe(false);
    }
  });

  it('indexes the sister section description without white-labeling as shipped', () => {
    expect(PRODUCTS_SISTERS_SECTION.description.toLowerCase().includes('white-label')).toBe(false);
    expect(PRODUCTS_SISTERS_SECTION.description.length).toBeGreaterThan(25);
  });
});
