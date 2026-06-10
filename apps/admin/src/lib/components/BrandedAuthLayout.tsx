import {
  BuiltWithRevealUI,
  Heading,
  RevealUIMark,
  SplitAuthLayout,
} from '@revealui/presentation/server';
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
 * - `REVEALUI_BRAND_LOGO_URL` — optional tenant logo src; when unset, the inline
 *   RevealUI mark is rendered (inherits `--tenant-brand-on` for guaranteed contrast)
 * - `REVEALUI_SHOW_POWERED_BY` — `'false'` hides the "Built with RevealUI" badge
 *   (kit-default false; revealui.com SaaS-default true)
 *
 * Tenant brand color is consumed via the `--tenant-brand` / `--tenant-brand-on` CSS
 * vars injected at the root in `apps/admin/src/app/(frontend)/layout.tsx`.
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

  const brand = (
    <>
      {logoUrl ? (
        // biome-ignore lint/performance/noImgElement: static tenant branding image; Next.js Image overkill for one logo
        <img
          src={logoUrl}
          alt={name}
          className="max-h-24 w-auto max-w-xs object-contain lg:max-h-48 lg:max-w-sm"
        />
      ) : (
        <RevealUIMark title={name} className="h-24 w-24 lg:h-32 lg:w-32" />
      )}
      {hideName ? null : (
        <Heading as="h1" size="2xl" className="text-center tracking-tight lg:text-3xl">
          {name}
        </Heading>
      )}
      {tagline ? (
        <p className="max-w-[30ch] text-center text-sm opacity-80 lg:text-base">{tagline}</p>
      ) : null}
    </>
  );

  return (
    <SplitAuthLayout
      brand={brand}
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
