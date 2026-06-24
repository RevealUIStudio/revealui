import type React from 'react';
import { Slot } from '../primitives/Slot.js';
import { cn, cva, type VariantProps } from '../utils/cn.js';
import {
  buttonTransitionStyle,
  glowClasses,
  ShineOverlay,
  Spinner,
  shineHostClasses,
} from './_button-shared.js';

/**
 * `Button` (exported as `ButtonCVA`) — the brand-token-driven button.
 *
 * This is the canonical button used across the marketing, admin, and docs apps.
 * Its variants reference semantic design tokens (`bg-primary`,
 * `text-primary-foreground`, …), so it re-themes automatically with the active
 * brand. For the Catalyst-style, `color`-prop button (20 fixed palettes, used
 * internally by Dropdown) see `button-headless.tsx`, exported as bare `Button`.
 * The `*CVA` suffix is an intentional package-wide convention — see README.
 */

const primaryButtonClasses =
  'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md';

const buttonVariants = cva(
  // `relative` contains the absolutely-positioned descendants this button can
  // render — the `TouchTarget` hit-area expander (used by `LinkButton`) and the
  // `ShineOverlay`. Without it those overlays size against the nearest *other*
  // positioned ancestor (e.g. a `sticky` header), blanket the surrounding UI,
  // and intercept pointer events on touch devices — which is what stopped the
  // marketing mobile hamburger (a sibling of the signup `LinkButton`) from
  // opening. The headless `Button` already carries `relative isolate`.
  // `gap-2` + the `[&_svg]` rules give icon/spinner children automatic spacing,
  // non-interactivity, and flex-shrink protection without per-call-site margins.
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        clear: '',
        default: 'h-11 px-4 py-2.5',
        icon: 'size-11',
        lg: 'h-12 rounded px-8 py-3',
        sm: 'h-10 rounded px-3 py-2',
      },
      variant: {
        default: primaryButtonClasses,
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm hover:shadow-md',
        ghost: 'hover:bg-card hover:text-accent-foreground',
        link: 'text-primary items-start justify-start underline-offset-4 hover:underline',
        outline:
          'border border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-background hover:bg-card hover:text-accent-foreground shadow-sm',
        primary: primaryButtonClasses,
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      },
    },
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
        className={cn(buttonVariants({ size, variant }), glow && glowClasses, className)}
        style={buttonTransitionStyle}
        ref={ref}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      className={cn(
        buttonVariants({ size, variant }),
        glow && glowClasses,
        shine && shineHostClasses,
        className,
      )}
      style={buttonTransitionStyle}
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {shine ? <ShineOverlay /> : null}
      {isLoading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export { Button, buttonVariants };
