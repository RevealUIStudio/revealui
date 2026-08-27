import { BuiltWithRevealUI, Heading, SplitAuthLayout } from '@revealui/presentation/server';
import type React from 'react';

/**
 * Admin-side configuration shim for `SplitAuthLayout`.
 *
 * Reads tenant identity from env vars (set by RevForge stamping or by revealui.com's
 * own SaaS deployment) and composes the generic `SplitAuthLayout` primitive's
 * brand + footer slots. No tenant-specific code paths — every Fleet customer
 * consumes the same shell, only their env-driven bindings differ.
 *
 * Env vars consumed:
 * - `REVEALUI_TENANT_NAME` (or legacy `REVEALUI_BRAND_NAME`) — heading + logo alt text
 * - `REVEALUI_TENANT_HIDE_NAME` — `'true'` hides the visible heading text (useful when
 *   the logo already contains the company wordmark, e.g. "acmeinc"); alt
 *   text on the logo stays for screen-reader accessibility regardless
 * - `REVEALUI_TENANT_TAGLINE` — optional subline; suppressed if unset
 * - `REVEALUI_BRAND_LOGO_URL` — optional tenant logo src; when unset, the canonical
 *   Circuit-R master (`/revealui-logo.svg`, ≥96px) is rendered
 * - `REVEALUI_SHOW_POWERED_BY` — `'false'` hides the "Built with RevealUI" badge
 *   (kit-default false; revealui.com SaaS-default true)
 *
 * Tenant brand color is consumed via the `--tenant-brand` / `--tenant-brand-on` CSS
 * vars injected at the root in `apps/admin/src/app/(frontend)/layout.tsx`.
 * When no tenant color is set, the brand column uses midnight (`surface-0`) so
 * the Circuit-R master stays on its designed navy surface.
 */
export function BrandedAuthLayout({ children }: { children: React.ReactNode }) {
  // `||` not `??`: Compose `${VAR:-}` interpolation delivers unset vars as
  // empty strings, which must fall through. tagline/logoUrl below are
  // truthy-guarded in JSX, so empty strings are already safe there.
  const name = process.env.REVEALUI_BRAND_NAME || process.env.REVEALUI_TENANT_NAME || 'RevealUI';
  const hideName = process.env.REVEALUI_TENANT_HIDE_NAME === 'true';
  const tagline = process.env.REVEALUI_TENANT_TAGLINE;
  const logoUrl = process.env.REVEALUI_BRAND_LOGO_URL;
  const showPoweredBy = process.env.REVEALUI_SHOW_POWERED_BY !== 'false';
  const hasTenantBrand = Boolean(
    process.env.REVEALUI_BRAND_PRIMARY_COLOR || process.env.REVEALUI_TENANT_BRAND,
  );

  const brand = (
    <>
      {logoUrl ? (
        // biome-ignore lint/performance/noImgElement: static tenant branding image; Next.js Image overkill for one logo
        <img
          src={logoUrl}
          alt={name}
          className="max-h-24 w-auto max-w-xs object-contain lg:max-h-40 lg:max-w-sm"
        />
      ) : (
        // biome-ignore lint/performance/noImgElement: canonical circuit master from gen-brand-assets; ≥96px
        <img
          src="/revealui-logo.svg"
          alt=""
          width={160}
          height={160}
          className="h-28 w-28 lg:h-40 lg:w-40"
        />
      )}
      {hideName ? null : (
        <Heading
          as="h1"
          size="2xl"
          className="text-center font-extrabold tracking-tight lg:text-3xl"
          style={{
            fontFamily: 'var(--rvui-font-display, "Inter Tight", "Inter", system-ui, sans-serif)',
          }}
        >
          {name}
        </Heading>
      )}
      {tagline ? (
        <p className="max-w-[30ch] text-center text-sm text-[var(--rvui-text-1)] lg:text-base">
          {tagline}
        </p>
      ) : null}
    </>
  );

  return (
    <SplitAuthLayout
      brand={brand}
      brandSurface={hasTenantBrand ? 'tenant' : 'surface-0'}
      brandFooter={
        showPoweredBy ? (
          <div className="hidden lg:block">
            <BuiltWithRevealUI colorScheme="dark" />
          </div>
        ) : null
      }
      formFooter={
        showPoweredBy ? (
          <div className="lg:hidden">
            <BuiltWithRevealUI colorScheme="light" />
          </div>
        ) : null
      }
    >
      {children}
    </SplitAuthLayout>
  );
}
