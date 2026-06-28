/**
 * Site branding for white-labeled deployments.
 *
 * Forge Stamp customers and self-hosters override `NEXT_PUBLIC_SITE_NAME` and
 * `NEXT_PUBLIC_SITE_OPERATOR` to swap user-visible "RevealUI" branding for
 * their own. Defaults match the canonical revealui.com install.
 */

// `||` not `??`: Compose `${VAR:-}` interpolation delivers unset vars as
// empty strings, which must fall through to the canonical defaults.
export const SITE_NAME: string = process.env.NEXT_PUBLIC_SITE_NAME || 'RevealUI';

export const SITE_OPERATOR: string =
  process.env.NEXT_PUBLIC_SITE_OPERATOR || 'REVEALUI STUDIO L.L.C.';

/** True when running with default (canonical) branding — used to gate
 * platform-specific copy that shouldn't appear in white-labeled deployments. */
export const IS_CANONICAL_BRANDING: boolean = !process.env.NEXT_PUBLIC_SITE_NAME;
