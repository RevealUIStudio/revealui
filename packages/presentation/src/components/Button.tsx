import type React from 'react';
import { Slot } from '../primitives/Slot.js';
import { cn, cva, type VariantProps } from '../utils/cn.js';
import { glowClasses, ShineOverlay, Spinner, shineHostClasses } from './_button-shared.js';

/**
 * `Button` — the owned RevealUI action button.
 *
 * Two orthogonal axes: `variant` is the semantic colour intent (brand, neutral,
 * success, warning, danger), `appearance` is the visual weight (solid, outline,
 * ghost, link). Both style from `--rvui-*` design tokens via the semantic
 * bridge, so the button re-themes with the active brand and never carries a
 * fixed palette. States use the browser's native CSS pseudo-classes
 * (`:hover` / `:active` / `:focus-visible` / `:disabled`); the focus ring is the
 * `--ring` token. Interaction motion is collapsed under
 * `prefers-reduced-motion` at the CSS level.
 */

const buttonVariants = cva(
  // `relative` contains the absolutely-positioned descendants this button can
  // render — the `TouchTarget` hit-area expander (used by `LinkButton`) and the
  // `ShineOverlay`. Without it those overlays size against the nearest *other*
  // positioned ancestor (e.g. a `sticky` header), blanket the surrounding UI,
  // and intercept pointer events on touch devices.
  // `gap-2` + the `[&_svg]` rules give icon/spinner children automatic spacing,
  // non-interactivity, and flex-shrink protection without per-call-site margins.
  // The radius, transition, and press-scale read design tokens and honour
  // reduced motion; the focus ring is the `--ring` token via `ring-ring`.
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--rvui-radius-md)] text-sm font-medium ring-offset-background transition-[color,background-color,border-color,box-shadow,transform] duration-[var(--rvui-duration-normal)] ease-[var(--rvui-ease)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-safe:active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    defaultVariants: {
      appearance: 'solid',
      size: 'default',
      variant: 'brand',
    },
    variants: {
      // Colour intent — the actual colour classes live in compoundVariants so
      // each (appearance, variant) pair is explicit and greppable, with no
      // CSS-var overlay indirection.
      variant: {
        brand: '',
        danger: '',
        neutral: '',
        success: '',
        warning: '',
      },
      appearance: {
        ghost: '',
        link: 'items-start justify-start underline-offset-4 hover:underline',
        outline: '',
        solid: '',
      },
      size: {
        clear: '',
        default: 'h-11 px-4 py-2.5',
        icon: 'size-11',
        lg: 'h-12 px-8 py-3',
        sm: 'h-10 px-3 py-2',
      },
    },
    compoundVariants: [
      // Solid — filled surface, ink from the on-fill token.
      {
        appearance: 'solid',
        variant: 'brand',
        class: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md',
      },
      {
        appearance: 'solid',
        variant: 'neutral',
        class: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      },
      {
        appearance: 'solid',
        variant: 'success',
        class:
          'bg-[var(--rvui-success-strong)] text-[var(--rvui-text-on-success)] shadow-sm hover:brightness-95 hover:shadow-md',
      },
      {
        appearance: 'solid',
        variant: 'warning',
        class:
          'bg-[var(--rvui-warning)] text-[var(--rvui-text-on-warning)] shadow-sm hover:brightness-95 hover:shadow-md',
      },
      {
        appearance: 'solid',
        variant: 'danger',
        class:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md',
      },
      // Outline — transparent surface, tokenised border, subtle hover fill.
      {
        appearance: 'outline',
        variant: 'brand',
        class: 'border border-primary/40 text-primary hover:bg-primary/10',
      },
      {
        appearance: 'outline',
        variant: 'neutral',
        class:
          'border border-[var(--border)] bg-background text-foreground shadow-sm hover:bg-muted hover:text-foreground',
      },
      {
        appearance: 'outline',
        variant: 'success',
        class:
          'border border-[var(--rvui-success)] text-[var(--rvui-success)] hover:bg-[var(--rvui-success-subtle)]',
      },
      {
        appearance: 'outline',
        variant: 'warning',
        class:
          'border border-[var(--rvui-warning)] text-[var(--rvui-warning-text)] hover:bg-[var(--rvui-warning-subtle)]',
      },
      {
        appearance: 'outline',
        variant: 'danger',
        class: 'border border-destructive/40 text-destructive hover:bg-destructive/10',
      },
      // Ghost — no surface, coloured ink, subtle hover fill.
      { appearance: 'ghost', variant: 'brand', class: 'text-primary hover:bg-primary/10' },
      {
        appearance: 'ghost',
        variant: 'neutral',
        // Body ink on a muted fill. `accent-foreground` is ink-on-amber
        // (`--rvui-text-on-accent`) and disappears on `--card` in dark theme.
        class: 'text-foreground hover:bg-muted hover:text-foreground',
      },
      {
        appearance: 'ghost',
        variant: 'success',
        class: 'text-[var(--rvui-success)] hover:bg-[var(--rvui-success-subtle)]',
      },
      {
        appearance: 'ghost',
        variant: 'warning',
        class: 'text-[var(--rvui-warning-text)] hover:bg-[var(--rvui-warning-subtle)]',
      },
      { appearance: 'ghost', variant: 'danger', class: 'text-destructive hover:bg-destructive/10' },
      // Link — text only, underline on hover (layout set on appearance.link).
      { appearance: 'link', variant: 'brand', class: 'text-primary' },
      { appearance: 'link', variant: 'neutral', class: 'text-foreground' },
      { appearance: 'link', variant: 'success', class: 'text-[var(--rvui-success)]' },
      { appearance: 'link', variant: 'warning', class: 'text-[var(--rvui-warning-text)]' },
      { appearance: 'link', variant: 'danger', class: 'text-destructive' },
    ],
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
  /** Brand-glow halo for emphasis CTAs, driven by the `--rvui-shadow-glow` token. */
  glow?: boolean;
  /**
   * Subtle light sweep across the button on hover. Requires the native button
   * element, so it is ignored when `asChild` is set.
   */
  shine?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

function Button({
  asChild = false,
  className,
  isLoading,
  glow = false,
  shine = false,
  size,
  variant,
  appearance,
  ref,
  children,
  disabled,
  ...props
}: ButtonProps) {
  if (asChild) {
    // Slot merges props onto a single child, so the shine overlay (an extra
    // sibling) can't be injected — `shine` is intentionally a no-op here.
    return (
      <Slot
        className={cn(
          buttonVariants({ size, variant, appearance }),
          glow && glowClasses,
          className,
        )}
        ref={ref}
        aria-busy={isLoading || undefined}
        data-loading={isLoading ? '' : undefined}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      className={cn(
        buttonVariants({ size, variant, appearance }),
        glow && glowClasses,
        shine && shineHostClasses,
        className,
      )}
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      data-loading={isLoading ? '' : undefined}
      {...props}
    >
      {shine ? <ShineOverlay /> : null}
      {isLoading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export { Button, buttonVariants };
