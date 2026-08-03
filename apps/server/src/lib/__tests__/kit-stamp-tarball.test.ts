import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buildAgencyKitArtifact } from '../kit-stamp-artifact.js';
import { buildAgencyKitPackageTarGz, buildUstarHeader, packUstar } from '../kit-stamp-tarball.js';

describe('buildUstarHeader', () => {
  it('writes a 512-byte block with path and size', () => {
    const h = buildUstarHeader('START-HERE.md', 42, 1_700_000_000);
    expect(h.length).toBe(512);
    expect(h.subarray(0, 13).toString('utf8')).toBe('START-HERE.md');
    expect(h.subarray(257, 263).toString('utf8')).toBe('ustar\0');
  });
});

describe('packUstar + buildAgencyKitPackageTarGz', () => {
  it('packs thin kit files into a gunzippable archive with no private keys', () => {
    const art = buildAgencyKitArtifact({
      branding: {
        company: 'Buyer Co',
        slug: 'buyer-co',
        brand: '#1a56db',
        email: 'buyer@example.com',
      },
      licenseId: 'lic_1',
      livemode: false,
      packageFormat: 'tar.gz',
    });
    const tarGz = buildAgencyKitPackageTarGz(art, { mtimeSec: 1_700_000_000 });
    expect(tarGz.length).toBeGreaterThan(100);
    const raw = gunzipSync(tarGz);
    const asText = raw.toString('utf8');
    expect(asText).toContain('START-HERE.md');
    expect(asText).toContain('revforge.json');
    expect(asText).toContain('manifest.json');
    expect(asText).toContain('Buyer Co');
    expect(asText).not.toMatch(/PRIVATE_KEY|BEGIN PRIVATE/i);
  });

  it('pads file data to 512-byte blocks', () => {
    const ustar = packUstar([{ path: 'a.txt', data: 'hi' }], 0);
    // header + "hi" + pad + 2 end blocks
    expect(ustar.length % 512).toBe(0);
    expect(ustar.length).toBeGreaterThanOrEqual(512 * 4);
  });
});
