/**
 * Landing-page audience selector. Reads `?for=technical|non-technical` from the
 * URL search string, so the choice is SSR-rendered per request (no flash),
 * shareable, and SEO-clean. Mirrors selectHomeHero() in hero-variant.ts — the
 * same URL-param seam, generalized from "hero A/B" to "audience corpus".
 *
 * DEFAULT_AUDIENCE is the single place the default lives. It is 'non-technical':
 * the broadest top-of-funnel audience, plain language, no terminal command in
 * the first viewport. The bare canonical URL (`/`) serves non-technical;
 * `/?for=technical` serves the developer corpus. audienceHref()'s canonical-URL
 * logic inverts automatically off this constant.
 */

export type Audience = 'technical' | 'non-technical';

export const AUDIENCE_PARAM = 'for';

export const DEFAULT_AUDIENCE: Audience = 'non-technical';

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
