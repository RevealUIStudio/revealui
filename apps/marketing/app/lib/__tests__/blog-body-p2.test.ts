/**
 * GAP-467 P2: lock body prose units for the three newest live posts against
 * the markdown extractor (proof titles referenced from blog-body-claims-p2.ts).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BLOG_BODY_CLAIM_SLUGS,
  blogBodyClaimsP2,
} from '../../content/claims-evidence/blog-body-claims-p2.js';
import { BLOG_POST_METADATA } from '../blog-registry.js';

// Re-implement extract import from scripts — marketing app may not resolve scripts path;
// duplicate call via dynamic path from monorepo root.
import { extractBlogMdProseUnits } from '../../../../../scripts/lib/blog-md-prose.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../../');

function loadBody(slug: string): { units: string[]; claimTexts: string[] } {
  const meta = BLOG_POST_METADATA.find((p) => p.slug === slug);
  if (!meta) throw new Error(`missing registry slug ${slug}`);
  const md = readFileSync(join(repoRoot, 'docs/blog', meta.file), 'utf8');
  const units = extractBlogMdProseUnits(md);
  const claimTexts = blogBodyClaimsP2
    .filter((c) => c.file === `blog/${slug}` && c.exportPath.startsWith('body.'))
    .map((c) => c.text);
  return { units, claimTexts };
}

describe('GAP-467 P2 blog body claims', () => {
  it('covers exactly the three newest phase slugs', () => {
    expect([...BLOG_BODY_CLAIM_SLUGS]).toEqual([
      'open-runtime-for-fde-work',
      'shareable-upside',
      'ui-of-the-future',
    ]);
  });

  it('open-runtime-for-fde-work body prose units match extractor', () => {
    const { units, claimTexts } = loadBody('open-runtime-for-fde-work');
    expect(claimTexts.sort()).toEqual([...units].sort());
  });

  it('shareable-upside body prose units match extractor', () => {
    const { units, claimTexts } = loadBody('shareable-upside');
    expect(claimTexts.sort()).toEqual([...units].sort());
  });

  it('ui-of-the-future body prose units match extractor', () => {
    const { units, claimTexts } = loadBody('ui-of-the-future');
    expect(claimTexts.sort()).toEqual([...units].sort());
  });
});
