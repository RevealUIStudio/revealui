import { describe, expect, it } from 'vitest';
import {
  ALL_MIME_TYPES,
  extensionForMimeType,
  IMAGE_MIME_TYPES,
  isAllowedMimeType,
  sanitizeFilename,
  verifyMagicBytes,
} from '../../entities/media.js';

const bytes = (...b: number[]): Uint8Array => new Uint8Array(b);
const ascii = (s: string): Uint8Array => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe('media MIME allowlist', () => {
  it('excludes image/svg+xml (stored-XSS vector)', () => {
    expect(IMAGE_MIME_TYPES as readonly string[]).not.toContain('image/svg+xml');
    expect(ALL_MIME_TYPES as readonly string[]).not.toContain('image/svg+xml');
    expect(isAllowedMimeType('image/svg+xml')).toBe(false);
  });
});

describe('verifyMagicBytes', () => {
  it('accepts files whose leading bytes match the declared type', () => {
    expect(
      verifyMagicBytes('image/png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe(true);
    expect(verifyMagicBytes('image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
    expect(verifyMagicBytes('image/gif', ascii('GIF89a'))).toBe(true);
    expect(verifyMagicBytes('application/pdf', ascii('%PDF-1.7'))).toBe(true);
    expect(
      verifyMagicBytes(
        'image/webp',
        new Uint8Array([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')]),
      ),
    ).toBe(true);
  });

  it('rejects content-type spoofing (HTML/SVG bytes declared as an image)', () => {
    const html = ascii('<svg onload=alert(1)>');
    expect(verifyMagicBytes('image/png', html)).toBe(false);
    expect(verifyMagicBytes('image/jpeg', html)).toBe(false);
    expect(verifyMagicBytes('image/webp', html)).toBe(false);
  });

  it('rejects an unknown / unverifiable declared type (fail-closed)', () => {
    expect(verifyMagicBytes('image/svg+xml', ascii('<svg/>'))).toBe(false);
    expect(verifyMagicBytes('text/html', ascii('<html>'))).toBe(false);
  });

  it('rejects truncated headers without throwing', () => {
    expect(verifyMagicBytes('image/png', bytes(0x89))).toBe(false);
    expect(verifyMagicBytes('image/webp', ascii('RIFF'))).toBe(false); // missing WEBP tag
  });
});

describe('extensionForMimeType', () => {
  it('maps verified types to a safe extension', () => {
    expect(extensionForMimeType('image/jpeg')).toBe('jpg');
    expect(extensionForMimeType('image/png')).toBe('png');
    expect(extensionForMimeType('application/pdf')).toBe('pdf');
  });

  it('falls back to bin for unknown types', () => {
    expect(extensionForMimeType('application/x-evil')).toBe('bin');
  });
});

describe('sanitizeFilename', () => {
  it('strips path separators and control characters', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('....etcpasswd');
    expect(sanitizeFilename('a\\b/c.png')).toBe('abc.png');
    const withControls = `a${String.fromCharCode(0)}b${String.fromCharCode(31)}.png`;
    expect(sanitizeFilename(withControls)).toBe('ab.png');
  });

  it('clamps length and falls back when empty', () => {
    expect(sanitizeFilename('/'.repeat(10))).toBe('upload');
    expect(sanitizeFilename('a'.repeat(300)).length).toBe(255);
  });
});
