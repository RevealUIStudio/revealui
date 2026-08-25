import { describe, expect, it } from 'vitest';
import { FOOTER_COLUMNS, FOOTER_SERVICE_LINKS } from '../nav';

function footerBlob(): string {
  const columns = FOOTER_COLUMNS.flatMap((column) =>
    column.links.map((link) => `${link.label} ${link.href}`),
  );
  const services = FOOTER_SERVICE_LINKS.map((link) => `${link.prefix} ${link.label} ${link.href}`);
  return [...columns, ...services].join('\n').toLowerCase();
}

describe('public product footer paths', () => {
  it('does not publish agency licensing or a Studio agency footer path', () => {
    const blob = footerBlob();
    expect(blob.includes('agency licensing')).toBe(false);
    expect(blob.includes('revealui studio (agency)')).toBe(false);
    expect(blob.includes('/pricing#perpetual')).toBe(false);
  });
});
