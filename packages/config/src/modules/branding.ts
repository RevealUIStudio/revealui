/**
 * @revealui/config - Branding Configuration Module
 *
 * Controls white-label branding for RevealUI deployments.
 * Enterprise tier unlocks full white-label customization.
 *
 * Default: "Built with RevealUI" badge shown in admin footer.
 * Enterprise: All branding fields are customizable; badge hidden when
 *   REVEALUI_SHOW_POWERED_BY=false.
 */

import type { EnvConfig } from '../schema.js';

export interface BrandingConfig {
  /** Product name shown in admin UI and emails (default: 'RevealUI') */
  name: string;
  /** URL of the logo image (default: undefined  -  uses bundled RevealUI logo) */
  logoUrl?: string;
  /** Primary brand color as a hex value (default: undefined  -  uses RevealUI palette) */
  primaryColor?: string;
  /** Whether to show "Built with RevealUI" badge in admin footer (default: true) */
  showPoweredBy: boolean;
}

export function getBrandingConfig(env: EnvConfig): BrandingConfig {
  return {
    // `||` not `??`: Compose `${VAR:-}` interpolation delivers unset vars as
    // empty strings, which must fall through (optional fields normalize ''
    // to undefined so consumers' truthy checks behave).
    name: env.REVEALUI_BRAND_NAME || env.REVEALUI_TENANT_NAME || 'RevealUI',
    logoUrl: env.REVEALUI_BRAND_LOGO_URL || undefined,
    primaryColor: env.REVEALUI_BRAND_PRIMARY_COLOR || env.REVEALUI_TENANT_BRAND || undefined,
    showPoweredBy: env.REVEALUI_SHOW_POWERED_BY !== 'false',
  };
}
