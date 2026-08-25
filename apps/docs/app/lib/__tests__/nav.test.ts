import { describe, expect, it } from 'vitest';
import { buildDocNavSections } from '../nav.js';

describe('docs public nav', () => {
  it('labels Enterprise and points at /enterprise, not /forge', () => {
    const sections = buildDocNavSections([]);
    const pro = sections.find((section) => section.title === 'Pro & Enterprise');
    expect(pro).toBeDefined();
    const enterprise = pro?.items.find((item) => item.label === 'Enterprise');
    expect(enterprise?.path).toBe('/enterprise');
    expect(pro?.items.some((item) => item.path === '/forge')).toBe(false);
    expect(pro?.items.some((item) => item.label === 'Forge')).toBe(false);
  });
});
