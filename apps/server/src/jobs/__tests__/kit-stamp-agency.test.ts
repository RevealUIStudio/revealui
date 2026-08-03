import { describe, expect, it } from 'vitest';
import {
  buildThinKitPackage,
  resolveKitBranding,
  resolveKitStampMode,
} from '../kit-stamp-agency-lib.js';

describe('resolveKitStampMode', () => {
  it('defaults to thin (P2-A)', () => {
    expect(resolveKitStampMode({})).toBe('thin');
  });

  it('accepts full for P2-B path', () => {
    expect(resolveKitStampMode({ REVEALUI_KIT_STAMP_MODE: 'full' })).toBe('full');
  });
});

describe('resolveKitBranding', () => {
  it('builds slug and company from email when branding omitted', () => {
    const b = resolveKitBranding({
      customerId: 'cus_abc12345',
      buyerEmail: 'jane.ops@agency.example',
    });
    expect(b.email).toBe('jane.ops@agency.example');
    expect(b.slug).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    expect(b.brand).toBe('#1a56db');
    expect(b.company.length).toBeGreaterThan(0);
  });

  it('prefers explicit branding fields', () => {
    const b = resolveKitBranding({
      customerId: 'cus_x',
      branding: {
        company: 'Acme Agency',
        slug: 'acme-agency',
        brand: '#112233',
        email: 'ops@acme.test',
      },
    });
    expect(b).toEqual({
      company: 'Acme Agency',
      slug: 'acme-agency',
      brand: '#112233',
      email: 'ops@acme.test',
    });
  });
});

describe('buildThinKitPackage', () => {
  it('emits Agency Founding Kit P2-A package without private keys', () => {
    const pkg = buildThinKitPackage({
      branding: {
        company: 'Acme',
        slug: 'acme',
        brand: '#1a56db',
        email: 'a@acme.test',
      },
      licenseId: 'lic-1',
      customerId: 'cus-1',
    });
    expect(pkg.product).toBe('agency-founding-kit');
    expect(pkg.tier).toBe('max');
    expect(pkg.maxSites).toBe(10);
    expect(pkg.perpetual).toBe(true);
    expect(pkg.revforgeConfig.licenseTier).toBe('max');
    expect(pkg.revforgeConfig.licensePerpetual).toBe(true);
    expect(pkg.startHere).toContain('REVEALUI_LICENSE_KEY');
    expect(pkg.startHere).not.toMatch(/BEGIN PRIVATE KEY/i);
    const json = JSON.stringify(pkg);
    expect(json).not.toMatch(/PRIVATE KEY/i);
  });
});
