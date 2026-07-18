'use client';

import type React from 'react';
import { type LinkBehavior, useLinkBehavior } from '../hooks/use-link-behavior.js';
import { cn } from '../utils/cn.js';
import {
  glowClasses,
  ShineOverlay,
  Spinner,
  shineHostClasses,
  TouchTarget,
} from './_button-shared.js';
import { type ButtonProps, buttonVariants } from './Button.js';

/**
 * LinkButton — a button-styled element that renders as an anchor by default,
 * with optional polymorphic override and provider-based routing-library wiring.
 *
 * Default usage: `<LinkButton href="/contact">Book a call</LinkButton>` renders
 * `<a href="/contact" class="…button…">Book a call</a>` — SSR-safe, zero deps.
 *
 * App-level wiring (recommended for SPAs):
 *   <LinkBehaviorProvider component={MyLink} hrefProp="to">
 *     <App />  // every <LinkButton href="/x"> downstream uses MyLink
 *   </LinkBehaviorProvider>
 *
 * Per-instance override (escape hatch):
 *   <LinkButton as={MyLink} to="/x">…</LinkButton>
 *
 * Shares its visual contract (variant, appearance, size, spinner, glow, shine,
 * transition) with `Button` via `_button-shared.tsx` and `buttonVariants`.
 */
export interface LinkButtonOwnProps {
  /** URL the button navigates to. Required for normal usage; omit only when `as` provides its own URL prop. */
  href?: string;
  /** External link — adds `target="_blank" rel="noopener noreferrer"` and renders a native `<a>` regardless of provider. */
  external?: boolean;
  /** Semantic colour intent (matches `Button` / `buttonVariants`). */
  variant?: ButtonProps['variant'];
  /** Visual weight (matches `Button` / `buttonVariants`). */
  appearance?: ButtonProps['appearance'];
  /** Button size (matches `Button` / `buttonVariants`). */
  size?: ButtonProps['size'];
  /** Show a loading spinner and disable interaction. Sets `aria-busy="true"`. */
  isLoading?: boolean;
  /** Brand-glow halo for emphasis CTAs, driven by the `--rvui-shadow-glow` token. */
  glow?: boolean;
  /** Subtle light sweep across the button on hover. */
  shine?: boolean;
  /** Visually disabled + ARIA-disabled. Anchor's `href` is preserved (semantics unchanged); click is prevented and `tabIndex` set to -1. */
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export type LinkButtonProps<T extends React.ElementType = 'a'> = LinkButtonOwnProps & {
  /** Polymorphic override — render as a different component for this single instance. Drops the provider's `hrefProp` and uses `'href'` instead. */
  as?: T;
} & Omit<React.ComponentPropsWithoutRef<T>, keyof LinkButtonOwnProps | 'as' | 'ref'> & {
    ref?: React.Ref<Element>;
  };

function LinkButton<T extends React.ElementType = 'a'>({
  as,
  href,
  external = false,
  variant,
  appearance,
  size,
  isLoading = false,
  glow = false,
  shine = false,
  disabled = false,
  className,
  children,
  ref,
  ...rest
}: LinkButtonProps<T>) {
  const provided = useLinkBehavior();

  // External opts out of the provider Link entirely — always renders <a>.
  // Per-instance `as` override drops back to 'href' as the URL prop (since
  // the overriding component is unknown to the provider).
  const finalComponent: React.ElementType = external ? 'a' : (as ?? provided.component);
  const finalHrefProp = external || as ? 'href' : provided.hrefProp;

  const externalAttrs = external
    ? { target: '_blank' as const, rel: 'noopener noreferrer' as const }
    : null;

  const interactionLockClass = disabled || isLoading ? 'pointer-events-none' : '';
  const opacityClass = disabled ? 'opacity-50' : '';

  // `disabledAttrs` are applied AFTER `...rest` so they always win when the
  // consumer passes their own `onClick`/`tabIndex`. Disabled means disabled.
  const disabledAttrs = disabled
    ? {
        'aria-disabled': true as const,
        tabIndex: -1,
        onClick: (e: React.MouseEvent) => e.preventDefault(),
      }
    : null;

  const renderProps = {
    ...(href !== undefined ? { [finalHrefProp]: href } : {}),
    ...externalAttrs,
    'aria-busy': isLoading || undefined,
    className: cn(
      buttonVariants({ variant, appearance, size }),
      glow && glowClasses,
      shine && shineHostClasses,
      interactionLockClass,
      opacityClass,
      className,
    ),
    ref,
    ...rest,
    ...disabledAttrs,
  };

  const Component = finalComponent as React.ElementType;
  return (
    <Component {...renderProps}>
      {shine ? <ShineOverlay /> : null}
      {isLoading ? <Spinner /> : null}
      <TouchTarget>{children}</TouchTarget>
    </Component>
  );
}

export type { LinkBehavior };
export { LinkButton };
