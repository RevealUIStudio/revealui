import { describe, expect, it } from 'vitest';
import { generatePreviewPath } from '../generatePreviewPath';

describe('generatePreviewPath', () => {
  it('generates preview path with encoded path parameter', () => {
    expect(generatePreviewPath({ path: '/blog/hello-world' })).toBe(
      '/next/preview?path=%2Fblog%2Fhello-world',
    );
  });

  it('encodes special characters in the path', () => {
    expect(generatePreviewPath({ path: '/page?foo=bar&baz=1' })).toBe(
      '/next/preview?path=%2Fpage%3Ffoo%3Dbar%26baz%3D1',
    );
  });

  it('handles root path', () => {
    expect(generatePreviewPath({ path: '/' })).toBe('/next/preview?path=%2F');
  });

  it('handles path with spaces', () => {
    expect(generatePreviewPath({ path: '/my page/title here' })).toBe(
      '/next/preview?path=%2Fmy%20page%2Ftitle%20here',
    );
  });

  it('handles empty path', () => {
    expect(generatePreviewPath({ path: '' })).toBe('/next/preview?path=');
  });
});
