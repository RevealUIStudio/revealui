/**
 * Unit tests for slug derivation + slug-manifest integrity.
 *
 * Phase 1 of CHIP-3 docs URL flatten — proves the slug algorithm is
 * deterministic, collision-free across the current docs corpus, and
 * round-trips cleanly via the manifest.
 */

import { describe, expect, it } from 'vitest';
import { filenameToSlug, pathToSlug } from '../slug.js';
import { PATH_TO_SLUG, pathToSlugLookup, SLUG_TO_PATH, slugToPath } from '../slug-manifest.js';

describe('filenameToSlug', () => {
  it('lowercases and kebab-cases SCREAMING_SNAKE_CASE', () => {
    expect(filenameToSlug('ADMIN_GUIDE.md')).toBe('admin-guide');
    expect(filenameToSlug('QUICK_START.md')).toBe('quick-start');
    expect(filenameToSlug('SCRIPT_MANAGEMENT.md')).toBe('script-management');
  });

  it('preserves already-kebab-case', () => {
    expect(filenameToSlug('runbook-agent-dispatch-flag.md')).toBe('runbook-agent-dispatch-flag');
    expect(filenameToSlug('02-x402-payments.md')).toBe('02-x402-payments');
    expect(filenameToSlug('agent-rules/test-prompts.md')).toBe('agent-rules/test-prompts');
  });

  it('handles mixed-case filenames (camelCase split)', () => {
    expect(filenameToSlug('RevealUIDocs.md')).toBe('reveal-ui-docs');
    expect(filenameToSlug('XmlParser.md')).toBe('xml-parser');
  });

  it('handles ALLCAPS-Title boundary (acronym followed by word)', () => {
    expect(filenameToSlug('ABCdef.md')).toBe('ab-cdef');
    expect(filenameToSlug('HTTPApi.md')).toBe('http-api');
  });

  it('drops .md extension', () => {
    expect(filenameToSlug('AUTH.md')).toBe('auth');
    expect(filenameToSlug('AUTH')).toBe('auth');
  });

  it('preserves numerics and symbols within reason', () => {
    expect(filenameToSlug('ADR-001-agent-first.md')).toBe('adr-001-agent-first');
    expect(filenameToSlug('TYPE-SYSTEM-RULES.md')).toBe('type-system-rules');
  });

  it('collapses consecutive hyphens and trims edges', () => {
    expect(filenameToSlug('FOO__BAR.md')).toBe('foo-bar');
    expect(filenameToSlug('-LEADING.md')).toBe('leading');
    expect(filenameToSlug('TRAILING-.md')).toBe('trailing');
  });
});

describe('pathToSlug', () => {
  it('preserves directory structure', () => {
    expect(pathToSlug('blog/02-x402-payments.md')).toBe('blog/02-x402-payments');
    expect(pathToSlug('ai/PROMPT_CACHING.md')).toBe('ai/prompt-caching');
    expect(pathToSlug('architecture/ADR-001-agent-first.md')).toBe(
      'architecture/adr-001-agent-first',
    );
  });

  it('only normalizes filename component, not directory names', () => {
    // 'agent-rules' stays as-is (already kebab); 'TEST_PROMPTS' would normalize.
    expect(pathToSlug('agent-rules/TEST_PROMPTS.md')).toBe('agent-rules/test-prompts');
  });

  it('handles top-level files (no directory prefix)', () => {
    expect(pathToSlug('AUTH.md')).toBe('auth');
    expect(pathToSlug('ADMIN_GUIDE.md')).toBe('admin-guide');
  });

  it('handles deeply nested paths', () => {
    expect(pathToSlug('api/rest-api/README.md')).toBe('api/rest-api/readme');
  });
});

describe('slug-manifest', () => {
  it('contains the expected number of entries (≥ 100 docs)', () => {
    const count = Object.keys(SLUG_TO_PATH).length;
    expect(count).toBeGreaterThanOrEqual(100);
    expect(count).toBeLessThanOrEqual(200); // Sanity ceiling against runaway generation
  });

  it('has zero slug collisions', () => {
    const slugs = Object.keys(SLUG_TO_PATH);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it('has zero path collisions (each file appears exactly once)', () => {
    const paths = Object.values(SLUG_TO_PATH);
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBe(paths.length);
  });

  it('PATH_TO_SLUG mirrors SLUG_TO_PATH exactly', () => {
    expect(Object.keys(PATH_TO_SLUG).length).toBe(Object.keys(SLUG_TO_PATH).length);
    for (const [slug, path] of Object.entries(SLUG_TO_PATH)) {
      expect(PATH_TO_SLUG[path]).toBe(slug);
    }
  });

  it('every manifest entry round-trips via the slug derivation', () => {
    // Each path's derived slug should match the manifest key.
    // (Cross-check: regenerating the manifest from scratch yields same data.)
    for (const [slug, path] of Object.entries(SLUG_TO_PATH)) {
      expect(pathToSlug(path)).toBe(slug);
    }
  });

  it('slugs use only [a-z0-9/-] characters', () => {
    const allowed = /^[a-z0-9/-]+$/;
    for (const slug of Object.keys(SLUG_TO_PATH)) {
      expect(slug).toMatch(allowed);
    }
  });

  it('all paths end with .md', () => {
    for (const path of Object.values(SLUG_TO_PATH)) {
      expect(path.endsWith('.md')).toBe(true);
    }
  });

  it('expected canonical entries are present (smoke test)', () => {
    // Spot-check a few well-known docs to catch wholesale regressions.
    expect(SLUG_TO_PATH['admin-guide']).toBe('ADMIN_GUIDE.md');
    expect(SLUG_TO_PATH['quick-start']).toBe('QUICK_START.md');
    expect(SLUG_TO_PATH['architecture']).toBe('ARCHITECTURE.md');
    expect(SLUG_TO_PATH['blog/02-http-402-payments']).toBe('blog/02-http-402-payments.md');
    expect(SLUG_TO_PATH['ai/prompt-caching']).toBe('ai/PROMPT_CACHING.md');
  });

  it('Vite plugin INTERNAL_DOC_FILES are NOT in the manifest', () => {
    // These files exist in suite-root docs/ but are excluded from public serving.
    // The manifest must mirror the same exclusion or external links would 404.
    const internal = [
      'MASTER_PLAN.md',
      'GOVERNANCE.md',
      'AI-AGENT-RULES.md',
      'AUTOMATION.md',
      'CI_ENVIRONMENT.md',
      'PRICE_COLLECTION.md',
      'PRODUCT_COLLECTION.md',
      'SECRETS-MANAGEMENT.md',
      'STANDARDS.md',
    ];
    for (const filename of internal) {
      expect(Object.values(SLUG_TO_PATH)).not.toContain(filename);
    }
  });
});

describe('slugToPath / pathToSlugLookup', () => {
  it('returns the file path for a known slug', () => {
    expect(slugToPath('admin-guide')).toBe('ADMIN_GUIDE.md');
  });

  it('returns null for an unknown slug', () => {
    expect(slugToPath('nonexistent-slug')).toBeNull();
    expect(slugToPath('')).toBeNull();
  });

  it('returns the slug for a known file path', () => {
    expect(pathToSlugLookup('ADMIN_GUIDE.md')).toBe('admin-guide');
  });

  it('returns null for an unknown file path', () => {
    expect(pathToSlugLookup('NONEXISTENT.md')).toBeNull();
    expect(pathToSlugLookup('')).toBeNull();
  });
});
