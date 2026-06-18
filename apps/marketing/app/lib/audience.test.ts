import { describe, expect, it } from 'vitest';
import { type Audience, audienceHref, DEFAULT_AUDIENCE, selectAudience } from './audience';

const OTHER: Audience = DEFAULT_AUDIENCE === 'technical' ? 'non-technical' : 'technical';

describe('selectAudience', () => {
  it('falls back to the default for missing or unknown params', () => {
    expect(selectAudience('')).toBe(DEFAULT_AUDIENCE);
    expect(selectAudience('?for=bogus')).toBe(DEFAULT_AUDIENCE);
    expect(selectAudience('?hero=foundation')).toBe(DEFAULT_AUDIENCE);
  });

  it('reads explicit audiences', () => {
    expect(selectAudience('?for=technical')).toBe('technical');
    expect(selectAudience('?for=non-technical')).toBe('non-technical');
  });
});

describe('audienceHref', () => {
  it('omits the param for the default audience (canonical URL)', () => {
    expect(audienceHref('', DEFAULT_AUDIENCE)).toBe('/');
  });

  it('sets the param for the non-default audience', () => {
    expect(audienceHref('', OTHER)).toBe(`/?for=${OTHER}`);
  });

  it('preserves other query params', () => {
    const href = audienceHref('?hero=foundation', OTHER);
    expect(href).toContain('hero=foundation');
    expect(href).toContain(`for=${OTHER}`);
  });
});
