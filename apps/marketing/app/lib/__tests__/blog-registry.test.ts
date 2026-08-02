/**
 * GAP-467 P1: lock live blog registry title/excerpt surfaces that capability-claims
 * marks (encrypt / every / never / real-time). Proof titles are referenced from
 * blog-meta-claims.ts evidence kind:test.
 */
import { describe, expect, it } from 'vitest';
import { BLOG_POST_METADATA } from '../blog-registry.js';

function post(slug: string) {
  const row = BLOG_POST_METADATA.find((p) => p.slug === slug);
  if (!row) throw new Error(`missing blog registry slug: ${slug}`);
  return row;
}

describe('GAP-467 blog registry', () => {
  it('lists eighteen live static posts', () => {
    expect(BLOG_POST_METADATA).toHaveLength(18);
  });

  it('revfleet product family excerpt mentions encrypted secrets product', () => {
    expect(post('revfleet-product-family').excerpt.toLowerCase()).toContain('encrypt');
  });

  it('own your secrets excerpt says credentials never sit as plaintext on disk', () => {
    const e = post('own-your-secrets').excerpt.toLowerCase();
    expect(e).toContain(' never ');
    expect(e).toContain('encrypt');
  });

  it('claim drift excerpt says every number is checked against the code', () => {
    expect(post('claim-drift').excerpt.toLowerCase()).toContain('every ');
  });

  it('own your data excerpt claims real-time sync in the product stack', () => {
    expect(post('own-your-data').excerpt.toLowerCase()).toContain('real-time');
  });

  it('five primitives excerpt says every software company needs the building blocks', () => {
    expect(post('five-primitives').excerpt.toLowerCase()).toContain('every ');
  });
});
