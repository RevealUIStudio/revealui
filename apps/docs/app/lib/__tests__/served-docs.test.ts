import { describe, expect, it } from 'vitest';
import { isPubliclyServed, NEVER_SERVE, readVisibility } from '../../../scripts/served-docs.mjs';

describe('readVisibility', () => {
  it('reads a public visibility value', () => {
    expect(readVisibility('---\nvisibility: public\ntitle: X\n---\n\nbody')).toBe('public');
  });

  it('reads an internal visibility value', () => {
    expect(readVisibility('---\ntitle: X\nvisibility: internal\n---\n\nbody')).toBe('internal');
  });

  it('unquotes a quoted value', () => {
    expect(readVisibility('---\nvisibility: "public"\n---\n')).toBe('public');
  });

  it('returns null when there is no frontmatter', () => {
    expect(readVisibility('# Just a heading\n\nbody')).toBeNull();
  });

  it('returns null when frontmatter has no visibility key', () => {
    expect(readVisibility('---\ntitle: X\nstatus: verified\n---\n\nbody')).toBeNull();
  });
});

describe('isPubliclyServed (fail-closed)', () => {
  it('serves visibility: public', () => {
    expect(isPubliclyServed('GUIDE.md', '---\nvisibility: public\n---\n')).toBe(true);
  });

  it('withholds visibility: internal', () => {
    expect(isPubliclyServed('AGENT.md', '---\nvisibility: internal\n---\n')).toBe(false);
  });

  it('withholds docs with no visibility field (fail-closed)', () => {
    expect(isPubliclyServed('LEGACY.md', '---\ntitle: X\n---\n')).toBe(false);
    expect(isPubliclyServed('NOFM.md', '# Heading\n')).toBe(false);
  });

  it('never serves a backstop file, even if mis-tagged public', () => {
    expect(NEVER_SERVE.has('SECRETS.md')).toBe(true);
    expect(isPubliclyServed('SECRETS.md', '---\nvisibility: public\n---\n')).toBe(false);
    expect(isPubliclyServed('nested/SECRETS.md', '---\nvisibility: public\n---\n')).toBe(false);
  });
});
