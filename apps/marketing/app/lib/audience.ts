/**
 * Landing-page audience selector. Reads `?for=technical|non-technical` from the
 * URL search string, so the choice is SSR-rendered per request (no flash),
 * shareable, and SEO-clean. Mirrors selectHomeHero() in hero-variant.ts — the
 * same URL-param seam, generalized from "hero A/B" to "audience corpus".
 *
 * DEFAULT_AUDIENCE is the single place the default lives. It is 'technical'
 * during PR 1 (hero toggle only): the page body is still technical-only, so a
 * non-technical default would render a non-technical hero on a technical body.
 * It flips to 'non-technical' in PR 2, when the non-technical body lands — the
 * canonical-URL logic in audienceHref() inverts automatically off this constant.
 */

export type Audience = 'technical' | 'non-technical';

export const AUDIENCE_PARAM = 'for';

export const DEFAULT_AUDIENCE: Audience = 'technical';

export function selectAudience(search: string): Audience {
  const value = new URLSearchParams(search).get(AUDIENCE_PARAM);
  return value === 'technical' || value === 'non-technical' ? value : DEFAULT_AUDIENCE;
}

/**
 * Href for a given audience, preserving any other query params. The default
 * audience gets the bare canonical URL (param omitted); the non-default audience
 * carries `?for=…`. Inverts automatically when DEFAULT_AUDIENCE flips.
 */
export function audienceHref(search: string, audience: Audience): string {
  const params = new URLSearchParams(search);
  if (audience === DEFAULT_AUDIENCE) {
    params.delete(AUDIENCE_PARAM);
  } else {
    params.set(AUDIENCE_PARAM, audience);
  }
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}
