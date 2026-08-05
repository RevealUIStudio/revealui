import { describe, expect, it } from 'vitest';
import {
  buildAgencyKitArtifact,
  resolveAgencyKitBranding,
  serializeKitArtifactForDownload,
  slugifyCompany,
} from '../kit-stamp-artifact.js';

describe('slugifyCompany', () => {
  it('slugifies company names', () => {
    expect(slugifyCompany('Acme Corp LLC')).toBe('acme-corp-llc');
  });

  it('falls back for empty', () => {
    expect(slugifyCompany('!!!')).toBe('agency-kit');
  });
});

describe('resolveAgencyKitBranding', () => {
  it('uses defaults from email when metadata empty', () => {
    const b = resolveAgencyKitBranding({ email: 'jane.doe@agency.example' });
    expect(b.email).toBe('jane.doe@agency.example');
    expect(b.company.length).toBeGreaterThan(0);
    expect(b.slug.length).toBeGreaterThan(0);
    expect(b.brand).toBe('#1a56db');
  });

  it('keeps valid brand hex and rejects garbage', () => {
    expect(resolveAgencyKitBranding({ email: 'a@b.co', brand: '#ff00aa' }).brand).toBe('#ff00aa');
    expect(resolveAgencyKitBranding({ email: 'a@b.co', brand: 'not-a-color' }).brand).toBe(
      '#1a56db',
    );
  });
});

describe('buildAgencyKitArtifact', () => {
  it('builds thin package with maxSites 10 and no private key material', () => {
    const art = buildAgencyKitArtifact({
      branding: {
        company: 'Buyer Co',
        slug: 'buyer-co',
        brand: '#1a56db',
        email: 'buyer@example.com',
      },
      licenseId: 'lic_test_1',
      livemode: false,
    });
    expect(art.manifest.maxSites).toBe(10);
    expect(art.manifest.tier).toBe('max');
    expect(art.manifest.perpetual).toBe(true);
    expect(art.manifest.licenseId).toBe('lic_test_1');
    expect(art.startHereMarkdown).toContain('Agency Founding Kit');
    expect(art.revforgeJson.licenseMaxSites).toBe(10);
    const blob = JSON.stringify(art);
    expect(blob).not.toMatch(/PRIVATE_KEY|BEGIN PRIVATE/i);
    const download = serializeKitArtifactForDownload(art);
    expect(download).toContain('START-HERE.md');
    expect(download).toContain('revforge.json');
  });
});
