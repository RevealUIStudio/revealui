import type React from 'react';
import { cn } from '../utils/cn.js';

export interface SplitAuthLayoutProps {
  /** Form content rendered in the right panel (desktop) / bottom panel (mobile). */
  children: React.ReactNode;
  /** Brand content rendered in the left panel (desktop) / top panel (mobile). Typically logo + name + optional tagline. */
  brand: React.ReactNode;
  /** Optional footer slot inside the brand panel. Consumer wraps with `hidden lg:block` if it should only show on desktop. */
  brandFooter?: React.ReactNode;
  /** Optional footer slot inside the form panel. Consumer wraps with `lg:hidden` if it should only show on mobile. */
  formFooter?: React.ReactNode;
  /**
   * Background surface for the brand panel.
   * - `tenant` (default): uses `--tenant-brand` CSS var with `--rvui-surface-3` token fallback.
   * - `surface-3`: uses the neutral surface token unconditionally (no brand binding).
   * - `surface-0`: midnight page token. The panel sets `data-theme="dark"` so
   *   the token stays midnight even when the form column is in light mode.
   */
  brandSurface?: 'tenant' | 'surface-3' | 'surface-0';
}

/**
 * Two-column auth shell — mobile-first, split on `lg:` (1024px+) breakpoint.
 *
 * Used by sign-in / sign-up / reset-password / mfa / rotate-password / setup pages
 * in the admin app and (via stamping) in customer Fleet kits.
 *
 * Layout:
 * - Mobile: brand panel stacks on top (full width), form panel below.
 * - Desktop (`lg:`+): brand panel takes left half, form panel takes right half.
 *
 * Theming:
 * - Brand background pulls from `--tenant-brand` CSS var (set by the consuming app
 * at the root level — see `apps/admin/src/app/(frontend)/layout.tsx`), with a
 * neutral `--rvui-surface-3` token fallback when no tenant brand is configured.
 * - Brand text color pulls from `--tenant-brand-on` CSS var. When unset, falls
 * back to `--foreground` (dark in light mode, light in dark mode) so the panel
 * is legible regardless of the surface it renders on. Customers with a custom
 * brand color SHOULD set `--tenant-brand-on` explicitly to guarantee contrast
 * — no automatic luminance computation by design (avoids FOUC + browser-compat
 * issues with color-mix / relative luminance).
 * - Form panel uses `--background` token so dark/light mode flips correctly.
 *
 * Companion centered variant: see `AuthLayout` for single-column non-branded shells.
 */
export function SplitAuthLayout({
  children,
  brand,
  brandFooter,
  formFooter,
  brandSurface = 'tenant',
}: SplitAuthLayoutProps) {
  const brandBgClass =
    brandSurface === 'tenant'
      ? 'bg-[var(--tenant-brand,var(--rvui-surface-3))]'
      : brandSurface === 'surface-0'
        ? 'bg-[var(--rvui-surface-0)]'
        : 'bg-[var(--rvui-surface-3)]';
  const brandTextClass =
    brandSurface === 'surface-0'
      ? 'text-[var(--rvui-text-0)]'
      : 'text-[var(--tenant-brand-on,var(--foreground))]';

  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      <aside
        data-theme={brandSurface === 'surface-0' ? 'dark' : undefined}
        className={cn(
          'flex min-h-[40vh] flex-col items-center justify-center gap-6 px-6 py-12 lg:min-h-dvh lg:w-1/2 lg:gap-8 lg:py-16',
          brandBgClass,
          brandTextClass,
        )}
      >
        {brand}
        {brandFooter ? <div className="mt-auto pt-8">{brandFooter}</div> : null}
      </aside>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 bg-[var(--rvui-surface-1)] px-6 py-10 lg:py-16">
        {children}
        {formFooter ? <div className="pt-2">{formFooter}</div> : null}
      </section>
    </main>
  );
}
