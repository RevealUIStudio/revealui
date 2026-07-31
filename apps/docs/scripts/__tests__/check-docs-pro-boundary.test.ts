import { describe, expect, it } from 'vitest';
import { readVisibility } from '../served-docs.mjs';

describe('docs-pro boundary helpers', () => {
  it('readVisibility still resolves public for docs-pro frontmatter shape', () => {
    expect(readVisibility('---\nvisibility: public\ntitle: X\n---\nbody')).toBe('public');
  });
});
