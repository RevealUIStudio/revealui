/**
 * @revealui/config - Branding Configuration Module
 *
 * Controls white-label branding for RevealUI deployments.
 * Enterprise tier unlocks full white-label customization.
 *
 * Default: "Built with RevealUI" badge shown in admin footer.
 * Enterprise: All branding fields are customizable; badge hidden when
 *   REVEALUI_SHOW_POWERED_BY=false.
 *
 * Brand colors and the tenant font that are written into HTML come from
 * Zod-validated tokens only. Invalid values are omitted (fail closed).
 */

import type { EnvConfig } from '../schema.js';
import { cssHexColorSchema, tenantBrandOnValueSchema, tenantFontValueSchema } from '../schema.js';

const brandHexSchema = cssHexColorSchema('#ea580c');

/** CSS family names for the self-hosted @fontsource-variable faces. */
const TENANT_FONT_CSS: Record<'Inter' | 'Inter Tight', string> = {
  Inter: 'Inter Variable',
  'Inter Tight': 'Inter Tight Variable',
};

const SAFE_FONT_FAMILIES = new Set<string>(Object.values(TENANT_FONT_CSS));
const SAFE_BRAND_ON_KEYWORDS = new Set<string>(['white', 'black']);

/** Hardcoded on-color used when brand-on is unset or a truthy boolean/`on`. */
const BRAND_ON_DEFAULT = 'white';

export interface BrandingConfig {
  /** Product name shown in admin UI and emails (default: 'RevealUI') */
  name: string;
  /** URL of the logo image (default: undefined  -  uses bundled RevealUI logo) */
  logoUrl?: string;
  /** Primary brand color as a hex value (default: undefined  -  uses RevealUI palette) */
  primaryColor?: string;
  /**
   * CSS color for text on the brand fill. `white` when a primary color is set
   * and brand-on is unset or truthy. A validated hex or `black` when those
   * tokens are configured. Omitted when the value is invalid or explicitly off.
   */
  brandOnColor?: string;
  /** Allowlisted self-hosted font family (Variable face). Omitted when invalid. */
  fontFamily?: string;
  /** Whether to show "Built with RevealUI" badge in admin footer (default: true) */
  showPoweredBy: boolean;
}

export interface TenantBrandStyle {
  primaryColor?: string;
  brandOnColor?: string;
  fontFamily?: string;
}

export interface TenantBrandStyleSource {
  REVEALUI_BRAND_PRIMARY_COLOR?: string;
  REVEALUI_TENANT_BRAND?: string;
  REVEALUI_TENANT_BRAND_ON?: string | boolean;
  REVEALUI_TENANT_FONT?: string;
}

type HexRead = { status: 'unset' } | { status: 'invalid' } | { status: 'ok'; value: string };

function readHex(value: unknown): HexRead {
  if (value === undefined || value === null) return { status: 'unset' };
  if (typeof value !== 'string') return { status: 'invalid' };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { status: 'unset' };
  const parsed = brandHexSchema.safeParse(trimmed);
  if (!parsed.success) return { status: 'invalid' };
  return { status: 'ok', value: parsed.data };
}

function firstHex(primary: unknown, tenant: unknown): string | undefined {
  const fromPrimary = readHex(primary);
  if (fromPrimary.status === 'ok') return fromPrimary.value;
  const fromTenant = readHex(tenant);
  if (fromTenant.status === 'ok') return fromTenant.value;
  return undefined;
}

/**
 * Resolve the on-color. Unset (with a primary color) and truthy boolean/`on`
 * use the constant `white`. Falsy boolean/`off` and invalid tokens omit it.
 * Validated hex and the keywords `white` / `black` pass through as themselves.
 */
function resolveBrandOnColor(value: unknown, hasPrimary: boolean): string | undefined {
  if (!hasPrimary) return undefined;
  if (value === undefined || value === null) return BRAND_ON_DEFAULT;
  if (value === true) return BRAND_ON_DEFAULT;
  if (value === false) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return BRAND_ON_DEFAULT;
  const parsed = tenantBrandOnValueSchema.safeParse(trimmed);
  if (!parsed.success) return undefined;
  if (parsed.data === true) return BRAND_ON_DEFAULT;
  if (parsed.data === false) return undefined;
  return parsed.data;
}

function resolveFontFamily(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const parsed = tenantFontValueSchema.safeParse(trimmed);
  if (!parsed.success) return undefined;
  return TENANT_FONT_CSS[parsed.data];
}

/**
 * Read brand CSS inputs from raw or already-parsed env. Invalid colors and
 * fonts are dropped. Nothing returned here is safe to concatenate until
 * `renderTenantBrandStyle` checks it again.
 */
export function readTenantBrandStyle(env: TenantBrandStyleSource): TenantBrandStyle {
  const primaryColor = firstHex(env.REVEALUI_BRAND_PRIMARY_COLOR, env.REVEALUI_TENANT_BRAND);
  return {
    primaryColor,
    brandOnColor: resolveBrandOnColor(env.REVEALUI_TENANT_BRAND_ON, primaryColor !== undefined),
    fontFamily: resolveFontFamily(env.REVEALUI_TENANT_FONT),
  };
}

function cssColorToken(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (SAFE_BRAND_ON_KEYWORDS.has(value)) return value;
  const parsed = brandHexSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function cssFontFamily(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return SAFE_FONT_FAMILIES.has(value) ? value : undefined;
}

/**
 * Build the admin `:root` style block. Returns undefined when there is
 * nothing valid to emit. Only Zod-checked hex, the constants `white`/`black`,
 * and the allowlisted font families can appear in the result.
 */
export function renderTenantBrandStyle(style: TenantBrandStyle): string | undefined {
  const primaryColor = cssColorToken(style.primaryColor);
  const brandOnColor = cssColorToken(style.brandOnColor);
  const fontFamily = cssFontFamily(style.fontFamily);
  const declarations: string[] = [];

  if (primaryColor) {
    declarations.push(`--tenant-brand: ${primaryColor};`);
    declarations.push('--primary: var(--tenant-brand);');
    if (brandOnColor) {
      declarations.push(`--tenant-brand-on: ${brandOnColor};`);
    }
  }
  if (fontFamily) {
    declarations.push(`--tenant-font: '${fontFamily}';`);
  }
  if (declarations.length === 0) return undefined;

  const root = `:root { ${declarations.join(' ')} }`;
  const body = fontFamily
    ? ` body { font-family: var(--tenant-font), 'Inter Variable', system-ui, -apple-system, sans-serif; }`
    : '';
  const css = `${root}${body}`;
  if (css.includes('<') || css.includes('>')) return undefined;
  return css;
}

export function getBrandingConfig(env: EnvConfig): BrandingConfig {
  const style = readTenantBrandStyle(env);
  return {
    // `||` not `??`: Compose `${VAR:-}` interpolation delivers unset vars as
    // empty strings, which must fall through (optional fields normalize ''
    // to undefined so consumers' truthy checks behave).
    name: env.REVEALUI_BRAND_NAME || env.REVEALUI_TENANT_NAME || 'RevealUI',
    logoUrl: env.REVEALUI_BRAND_LOGO_URL || undefined,
    primaryColor: style.primaryColor,
    brandOnColor: style.brandOnColor,
    fontFamily: style.fontFamily,
    showPoweredBy: env.REVEALUI_SHOW_POWERED_BY !== 'false',
  };
}
