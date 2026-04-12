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
    name: env.REVEALUI_BRAND_NAME ?? 'RevealUI',
    logoUrl: env.REVEALUI_BRAND_LOGO_URL,
    primaryColor: env.REVEALUI_BRAND_PRIMARY_COLOR,
    showPoweredBy: env.REVEALUI_SHOW_POWERED_BY !== 'false',
  };
}
