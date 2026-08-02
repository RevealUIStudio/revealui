/**
 * GAP-467: lock body prose units for every live static blog post against
 * the markdown extractor (proof titles referenced from blog-body-claims.ts).
 *
 * Capability-claims require the exact test title substring to appear as
 * source text in this file (not only as a runtime template). Keep the
 * shared title literal below in sync with evidence refs.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractBlogMdProseUnits } from '../../../../../scripts/lib/blog-md-prose.js';
import { describe, expect, it } from 'vitest';
import {
  BLOG_BODY_CLAIM_SLUGS,
  blogBodyClaims,
} from '../../content/claims-evidence/blog-body-claims.js';
import { BLOG_POST_METADATA } from '../blog-registry.js';

/** Exact substring referenced by every body claim's kind:test evidence. */
const BODY_PROOF_TITLE = 'body prose units match extractor';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../../');

function loadBody(slug: string): { units: string[]; claimTexts: string[] } {
  const meta = BLOG_POST_METADATA.find((p) => p.slug === slug);
  if (!meta) throw new Error(`missing registry slug ${slug}`);
  const md = readFileSync(join(repoRoot, 'docs/blog', meta.file), 'utf8');
  const units = extractBlogMdProseUnits(md);
  const claimTexts = blogBodyClaims
    .filter((c) => c.file === `blog/${slug}` && c.exportPath.startsWith('body.'))
    .map((c) => c.text);
  return { units, claimTexts };
}

describe('GAP-467 blog body claims', () => {
  it('covers every live registry slug', () => {
    expect([...BLOG_BODY_CLAIM_SLUGS].sort()).toEqual(
      [...BLOG_POST_METADATA.map((p) => p.slug)].sort(),
    );
  });

  // Title must appear literally for capability-claims proof parsing.
  it('body prose units match extractor', () => {
    for (const meta of BLOG_POST_METADATA) {
      const { units, claimTexts } = loadBody(meta.slug);
      expect(claimTexts.sort(), meta.slug).toEqual([...units].sort());
    }
    // Keep the shared proof title stable for evidence refs.
    expect(BODY_PROOF_TITLE).toBe('body prose units match extractor');
  });
});
