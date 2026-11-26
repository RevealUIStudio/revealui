import { describe, expect, it } from 'vitest';
import { pngFromSvg } from '../kg-diagram-png';

const TINY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#000"/></svg>';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('pngFromSvg', () => {
  it('renders a tiny SVG to a PNG', async () => {
    const encoded = await pngFromSvg(TINY_SVG);
    const bytes = Buffer.from(encoded, 'base64');

    expect(bytes.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
    expect(bytes.length).toBeGreaterThan(PNG_SIGNATURE.length);
  });
});
